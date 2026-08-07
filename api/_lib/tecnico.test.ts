// Test offline del match tolerante del nombre del técnico (riesgo n°1 del CLAUDE.md raíz: el
// Concat_Nombre_Apellido lo escriben las dos apps con fórmulas distintas — "Apellido, Nombre" en
// la mobile y "Nombre Apellido" en la escritorio, que además lo reescribe en CADA update de
// usuario. Con `eq` exacto de OData, el técnico se quedaba sin stock personal).
// Correr:  npx tsx api/_lib/tecnico.test.ts
import assert from "node:assert";
import {
  concatNombreApellido,
  mismoTecnico,
  variantesNombreTecnico,
  variantesODataNombre,
  odataOrNombre,
  filtrarPorTecnico,
} from "./tecnico.js";

// El caso reportado desde producción (Emiliano Henriquez).
const CONCAT_MOBILE = "Henriquez, Emiliano"; // como está guardado en 99.ABMRepuestos_Tecnico
const CONCAT_DESKTOP = "Emiliano Henriquez"; // como queda tras editarlo desde la escritorio

// ── mismoTecnico: los dos formatos son la misma persona ────────────────────────────────
assert.equal(mismoTecnico(CONCAT_MOBILE, CONCAT_DESKTOP), true);
assert.equal(mismoTecnico(CONCAT_DESKTOP, CONCAT_MOBILE), true);
assert.equal(mismoTecnico(CONCAT_MOBILE, CONCAT_MOBILE), true);
assert.equal(mismoTecnico(CONCAT_DESKTOP, CONCAT_DESKTOP), true);

// ── Drift de espacios, capitalización y tildes ─────────────────────────────────────────
assert.equal(mismoTecnico("  Henriquez,  Emiliano ", CONCAT_DESKTOP), true);
assert.equal(mismoTecnico("HENRIQUEZ, EMILIANO", CONCAT_DESKTOP), true);
assert.equal(mismoTecnico("Henriquez,Emiliano", CONCAT_DESKTOP), true);
assert.equal(mismoTecnico("Rodríguez, Martín", "Martin Rodriguez"), true);
assert.equal(mismoTecnico("Rodriguez, Martin", "Martín Rodríguez"), true);

// Nombres/apellidos compuestos: el giro es alrededor de la coma, no token por token.
assert.equal(
  mismoTecnico("Perez Garcia, Juan Carlos", "Juan Carlos Perez Garcia"),
  true,
);

// La ñ pasa por el mismo NFD que las tildes (la parte en "n" + U+0303), así que un "Munoz"
// tipeado sin ñ desde la escritorio matchea el "Muñoz" guardado. Va explícito porque es el
// tipo de apellido más probable del padrón real, y el que rompería si alguien acotara el
// rango de diacríticos que se strippean.
assert.equal(mismoTecnico("Muñoz, José", "Jose Munoz"), true);
assert.equal(mismoTecnico("Munoz, Jose", "José Muñoz"), true);

// Espacios que NO son el espacio ASCII: el NBSP (U+00A0) es lo que deja un copy/paste desde
// Excel/Word a una columna de texto de SharePoint, y \t/\n sobreviven a un pegado sucio.
// `\s` de JS los cubre a todos, y eso es lo que se fija acá.
// Se escriben con escape a propósito: a ojo son indistinguibles de un espacio normal, así que
// un editor o un formatter que "limpie" el archivo dejaría el test en verde pero sin probar
// nada. El assert.ok de abajo es el canario de esa degradación.
const NBSP: string = " ";
assert.ok(NBSP !== " ", "el NBSP se degradó a espacio ASCII: el test dejó de probar nada");
assert.equal(mismoTecnico(`Henriquez,${NBSP}Emiliano`, CONCAT_DESKTOP), true);
assert.equal(mismoTecnico(`${NBSP}Henriquez, Emiliano${NBSP}`, CONCAT_DESKTOP), true);
assert.equal(mismoTecnico("Henriquez,\tEmiliano\n", CONCAT_DESKTOP), true);

// Mismo nombre en NFC (í precompuesta, U+00ED) y en NFD (i + U+0301): Graph puede devolver
// cualquiera de las dos y a ojo son idénticas. Sin el .normalize("NFD") esto daría false.
// Mismo motivo que arriba para el escape: en NFD el archivo se ve igual que en NFC.
const NFC: string = "Rodríguez, Martín";
const NFD: string = "Rodríguez, Martín";
assert.ok(NFC !== NFD, "las dos formas quedaron idénticas: el test dejó de probar nada");
assert.equal(mismoTecnico(NFC, NFD), true);

// ── No matchea de más ──────────────────────────────────────────────────────────────────
assert.equal(mismoTecnico("Henriquez, Emiliano", "Henriquez, Ezequiel"), false);
assert.equal(mismoTecnico("Henriquez, Emiliano", "Gomez, Emiliano"), false);
// Vacío nunca matchea: una fila sin técnico no es de nadie.
assert.equal(mismoTecnico("", CONCAT_DESKTOP), false);
assert.equal(mismoTecnico(CONCAT_MOBILE, ""), false);
assert.equal(mismoTecnico("   ", "   "), false);
// Sin coma no se reordenan tokens: dos personas distintas no se confunden.
assert.equal(mismoTecnico("Emiliano Henriquez", "Henriquez Emiliano"), false);
// Un apellido suelto NO matchea a la persona completa: sin esto, un Concat a medio escribir
// se llevaría el stock de todos los que comparten apellido.
assert.equal(mismoTecnico("Gomez", "Gomez, Lucas"), false);
assert.equal(mismoTecnico("Henriquez", CONCAT_MOBILE), false);

// El backend puede recibir un valor sin normalizar desde Graph (columna ausente en la fila).
// Está tipado como string, pero en runtime llega undefined/null: no tiene que explotar ni
// matchear. Los casts son deliberados — es exactamente lo que TypeScript no cubre acá.
assert.equal(mismoTecnico(undefined as unknown as string, CONCAT_DESKTOP), false);
assert.equal(mismoTecnico(null as unknown as string, CONCAT_DESKTOP), false);

// ── variantesNombreTecnico ─────────────────────────────────────────────────────────────
assert.deepEqual(variantesNombreTecnico("Henriquez, Emiliano"), [
  "henriquez emiliano",
  "emiliano henriquez",
]);
assert.deepEqual(variantesNombreTecnico("Emiliano Henriquez"), [
  "emiliano henriquez",
]);
assert.deepEqual(variantesNombreTecnico(""), []);
// Dos comas NO generan giro: con más de una coma no se sabe dónde parte el apellido, y las
// dos fórmulas conocidas producen 1 coma (mobile) o 0 (escritorio), así que un valor así es
// una anomalía de carga, no drift de formato. Se cae al lado conservador (no matchea) en vez
// de inventar una permutación. Queda fijado para que nadie lo "arregle" ordenando tokens.
assert.deepEqual(variantesNombreTecnico("Perez, Juan, Carlos"), ["perez juan carlos"]);
assert.equal(mismoTecnico("Perez, Juan, Carlos", "Juan Carlos Perez"), false);

// ── variantesODataNombre: lo que SÍ se puede preguntar en el $filter ───────────────────
// A diferencia de variantesNombreTecnico, éstas van al `eq` de OData: tienen que salir con el
// texto TAL CUAL (con tildes y mayúsculas), porque SharePoint compara contra el string guardado.
assert.deepEqual(variantesODataNombre(CONCAT_MOBILE), [
  "Henriquez, Emiliano",
  "Emiliano Henriquez",
]);
assert.deepEqual(variantesODataNombre(CONCAT_DESKTOP), [
  "Emiliano Henriquez",
  "Henriquez, Emiliano",
]);
// Las tildes NO se tocan: normalizarlas acá dejaría un `eq` que no matchea nada.
assert.deepEqual(variantesODataNombre("Rodríguez, Martín"), [
  "Rodríguez, Martín",
  "Martín Rodríguez",
]);
// Espacios colapsados/trim: es cosmético para el filtro, no cambia a quién matchea.
assert.deepEqual(variantesODataNombre("  Henriquez,  Emiliano "), [
  "Henriquez, Emiliano",
  "Emiliano Henriquez",
]);
// Sin coma y con 3 tokens no se sabe dónde parte el apellido → se emiten los dos cortes. Un `or`
// de más es inofensivo (filtrarPorTecnico descarta después); uno de menos deja al técnico sin datos.
assert.deepEqual(variantesODataNombre("Juan Carlos Perez"), [
  "Juan Carlos Perez",
  "Carlos Perez, Juan",
  "Perez, Juan Carlos",
]);
// Vacío no genera ningún término: un `eq ''` se llevaría las filas SIN técnico.
assert.deepEqual(variantesODataNombre(""), []);
assert.deepEqual(variantesODataNombre("   "), []);
assert.deepEqual(variantesODataNombre(undefined as unknown as string), []);
// Nombre absurdamente largo: no se explota el filtro con N-1 giros (tope MAX_TOKENS_GIRO).
assert.deepEqual(variantesODataNombre("a b c d e f"), ["a b c d e f"]);
// El giro que emite tiene que volver a matchear con mismoTecnico (los dos lados coherentes).
for (const v of variantesODataNombre(CONCAT_DESKTOP)) {
  assert.equal(mismoTecnico(v, CONCAT_DESKTOP), true);
}

// ── odataOrNombre: el fragmento de $filter ─────────────────────────────────────────────
// Un `or` sobre UNA sola columna (no un `and` contra otra): eso es lo que evita el 400 de
// SharePoint sobre columnas no indexadas y lo que deja aprovechable el índice futuro.
const esc = (s: string) => s.replace(/'/g, "''");
assert.equal(
  odataOrNombre("TecnicoAsignado_EV", CONCAT_MOBILE, esc),
  "(fields/TecnicoAsignado_EV eq 'Henriquez, Emiliano' or fields/TecnicoAsignado_EV eq 'Emiliano Henriquez')",
);
// La comilla simple se escapa con el escape que le pasa el llamador (escapeODataValue).
assert.equal(
  odataOrNombre("Tecnico_RT", "O'Brien, Ana", esc),
  "(fields/Tecnico_RT eq 'O''Brien, Ana' or fields/Tecnico_RT eq 'Ana O''Brien')",
);
// Sin nombre devuelve "" para que el llamador NO concatene nada (y no filtre por `eq ''`).
assert.equal(odataOrNombre("TecnicoAsignado_IN", "", esc), "");

// ── filtrarPorTecnico: es lo que reemplaza al `eq` del $filter ─────────────────────────
interface Fila {
  Tecnico_RT?: string;
  Codigo: string;
}
const filas: Fila[] = [
  { Tecnico_RT: "Henriquez, Emiliano", Codigo: "R-001" }, // vieja (formato mobile)
  { Tecnico_RT: "Emiliano Henriquez", Codigo: "R-002" }, // nueva (formato escritorio)
  { Tecnico_RT: "Gomez, Lucas", Codigo: "R-003" },
  { Tecnico_RT: "", Codigo: "R-004" },
];
const col = (f: Fila) => f.Tecnico_RT ?? "";

// Convivencia de los DOS formatos en la misma lista: se traen las dos filas, cualquiera sea el
// formato con el que el técnico esté logueado. Es el caso que un `or` de OData de dos valores
// tampoco resolvería sin conocer las dos formas.
assert.deepEqual(
  filtrarPorTecnico(filas, CONCAT_DESKTOP, col, "test").map((f) => f.Codigo),
  ["R-001", "R-002"],
);
assert.deepEqual(
  filtrarPorTecnico(filas, CONCAT_MOBILE, col, "test").map((f) => f.Codigo),
  ["R-001", "R-002"],
);
// Otro técnico no se lleva nada de más.
assert.deepEqual(
  filtrarPorTecnico(filas, "Lucas Gomez", col, "test").map((f) => f.Codigo),
  ["R-003"],
);
// Sin match no explota ni devuelve las filas sin técnico.
assert.deepEqual(filtrarPorTecnico(filas, "Perez, Ana", col, "test"), []);
// Un técnico vacío (sesión sin nombre) no se lleva la lista entera.
assert.deepEqual(filtrarPorTecnico(filas, "", col, "test"), []);

// No muta la tanda que le entra: los call sites (stock, circuitos, edificios a visitar) siguen
// usando la lista cruda después de refinar.
const antes = JSON.stringify(filas);
filtrarPorTecnico(filas, CONCAT_DESKTOP, col, "test");
assert.equal(JSON.stringify(filas), antes);

// ── filtrarPorTecnico con VARIAS identidades (Concat + login) ──────────────────────────
// 10.Incidentes: TecnicoAsignado_IN guarda normalmente el Concat, pero hay altas viejas con el
// login. El refinado tiene que aceptar las dos sin que el login se lleve nombres ajenos.
const filasInc: Fila[] = [
  { Tecnico_RT: "Henriquez, Emiliano", Codigo: "I-001" }, // Concat formato mobile
  { Tecnico_RT: "Emiliano Henriquez", Codigo: "I-002" }, // Concat formato escritorio
  { Tecnico_RT: "Ehenriquez", Codigo: "I-003" }, // login guardado en la columna
  { Tecnico_RT: "Gomez, Lucas", Codigo: "I-004" },
];
assert.deepEqual(
  filtrarPorTecnico(filasInc, [CONCAT_DESKTOP, "Ehenriquez"], col, "test").map(
    (f) => f.Codigo,
  ),
  ["I-001", "I-002", "I-003"],
);
// El login NO es un comodín: no se lleva las filas de otro técnico.
assert.deepEqual(
  filtrarPorTecnico(filasInc, ["Gomez, Lucas", "Lgomez"], col, "test").map((f) => f.Codigo),
  ["I-004"],
);
// Una identidad vacía (sesión sin Concat) se ignora, no habilita todo.
assert.deepEqual(
  filtrarPorTecnico(filasInc, ["", "Ehenriquez"], col, "test").map((f) => f.Codigo),
  ["I-003"],
);
assert.deepEqual(filtrarPorTecnico(filasInc, ["", ""], col, "test"), []);
// Compatibilidad: el string suelto sigue funcionando igual que antes.
assert.deepEqual(
  filtrarPorTecnico(filasInc, CONCAT_MOBILE, col, "test").map((f) => f.Codigo),
  ["I-001", "I-002"],
);

// Fila cuya columna llega undefined desde Graph: se descarta, no rompe el refinado.
assert.deepEqual(
  filtrarPorTecnico(
    [{ Codigo: "R-005" } as Fila],
    CONCAT_DESKTOP,
    (f) => f.Tecnico_RT as unknown as string,
    "test",
  ),
  [],
);

console.log("tecnico.test.ts OK");

// ── Colisión de homónimos: el giro NO se aplica si los dos valores traen coma ──────────
// Regresión de un bug que tuvo el primer parche: dos personas distintas cuyos (apellido, nombre)
// son permutación una de la otra colapsaban en la misma identidad. Con apellidos que también son
// nombres (Martin, Perez, Simon) no es hipotético, y cruzar el stock entre dos técnicos es PEOR
// que el bug original: el stock vacío se ve, el cruzado no.
assert.equal(mismoTecnico("Perez, Martin", "Martin, Perez"), false);
assert.equal(mismoTecnico("Simon, Gabriel", "Gabriel, Simon"), false);
// Pero el giro SÍ corresponde cuando hay una convención de cada lado (es para lo que existe).
assert.equal(mismoTecnico("Martin, Perez", "Perez Martin"), true);
assert.equal(mismoTecnico("Perez Martin", "Martin, Perez"), true);
// Y el caso real que motivó todo sigue andando.
assert.equal(mismoTecnico("Henriquez, Emiliano", "Emiliano Henriquez"), true);

console.log("ok — mismoTecnico() no colapsa homónimos permutados");

// ── concatNombreApellido(): la forma CANÓNICA, la de PowerApps ────────────────────────
// Proper(apellido) & ", " & Proper(nombre) (Screen_ABM.pa.yaml). Las dos apps la escriben igual;
// antes la escritorio la hacía invertida ("Nombre Apellido") y cada edición de usuario le cambiaba
// la identidad al técnico.
assert.equal(concatNombreApellido("emiliano", "henriquez"), "Henriquez, Emiliano");
assert.equal(concatNombreApellido("EMILIANO", "HENRIQUEZ"), "Henriquez, Emiliano");
assert.equal(concatNombreApellido("  juan  carlos ", " de luca "), "De Luca, Juan Carlos");
// compuestos: guion y apóstrofe también llevan mayúscula después
assert.equal(concatNombreApellido("ana", "saenz-peña"), "Saenz-Peña, Ana");
assert.equal(concatNombreApellido("maria", "o'brien"), "O'Brien, Maria");
// faltantes: no deja comas colgando
assert.equal(concatNombreApellido("", "perez"), "Perez");
assert.equal(concatNombreApellido("juan", ""), "Juan");
assert.equal(concatNombreApellido("", ""), "");
// y lo que produce es reconocible por el matcher contra la forma vieja de la escritorio
assert.equal(mismoTecnico(concatNombreApellido("emiliano", "henriquez"), "Emiliano Henriquez"), true);

console.log("ok — concatNombreApellido() es la forma canónica de PowerApps");
