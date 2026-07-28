// Test offline de las plantillas de mail de incidentes (funciones puras, sin Graph).
// Cubre el bug reportado por el cliente: el mail de cambio de máquina mostraba UNA sola
// máquina (la retirada) y no se podía saber cuál quedó instalada.
// Correr:  npx tsx api/_lib/mail-incidentes.test.ts
import assert from "node:assert";
import { htmlCambioMaquina, htmlIncidenteResuelto } from "./mail-incidentes.js";

const VIEJA = "Lavarropas LR-100 S/N 111";
const NUEVA = "Lavarropas LR-200 S/N 222";

const html = htmlCambioMaquina({
  id: 4321,
  edificio: "Edificio Belgrano",
  maquinaVieja: VIEJA,
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "14:35",
  tecnico: "Perez, Juan",
  observaciones: "Motor quemado, no reparable en sitio.",
});

// Las DOS máquinas aparecen, cada una con su rótulo.
assert.ok(html.includes(VIEJA), "falta la máquina retirada");
assert.ok(html.includes(NUEVA), "falta la máquina instalada");
assert.ok(html.includes("Máquina retirada"), "falta el rótulo 'Máquina retirada'");
assert.ok(html.includes("Máquina instalada"), "falta el rótulo 'Máquina instalada'");
// La retirada va antes que la instalada (el swap se lee en orden).
assert.ok(html.indexOf(VIEJA) < html.indexOf(NUEVA), "el orden del swap está invertido");
// El preheader lleva el swap, para verlo desde la bandeja sin abrir el mail.
assert.ok(html.includes(`${VIEJA} → ${NUEVA}`), "el preheader no muestra el swap");
// Contexto del incidente + observaciones del técnico.
assert.ok(html.includes("N° 4321") && html.includes("Edificio Belgrano"));
assert.ok(html.includes("Motor quemado"), "faltan las observaciones");

// Sin observaciones → no se renderiza la fila vacía.
const sinObs = htmlCambioMaquina({
  id: 1,
  edificio: "E",
  maquinaVieja: VIEJA,
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "T",
});
assert.ok(!sinObs.includes("Observaciones"), "renderiza Observaciones vacías");

// Campos faltantes (camino de reconstrucción desde SharePoint) → placeholders, no huecos.
const vacio = htmlCambioMaquina({
  id: 2,
  edificio: "",
  maquinaVieja: "",
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "",
});
assert.ok(vacio.includes("—"), "sin placeholder para los campos vacíos");
assert.ok(vacio.includes(NUEVA), "se perdió la máquina instalada");

// --- Destino de la máquina retirada: el mail reporta lo que se escribió, no lo que se esperaba ---
// Antes de este parche la frase "La máquina retirada volvió al depósito Wash Inn y quedó disponible
// en stock" era FIJA: salía en todos los mails, incluso cuando findMaquinaDM no lograba identificar
// la unidad y a propósito no se tocaba ni 08.DetalleMaquina ni 04.Stock. Los asserts de acá abajo
// fallan contra ese código: los casos con `movimiento` piden textos que no existían, y los
// llamadores sin `movimiento` exigen silencio justo donde antes había una afirmación.
const DEPOSITO_OK = "volvió al depósito";
const STOCK_OK = "quedó disponible en stock";
const SIN_STOCK = "no se pudo actualizar el stock";
const NO_MOVIDA = "no se movió al depósito";
const ATENCION = "ATENCIÓN";
const MANUAL = "a mano desde el escritorio";

// ¿El mail dice ALGO sobre el destino de la vieja? Ninguna de estas palabras aparece en el resto
// de la plantilla ni en el shell (el wordmark/footer usan "WASH INN" y "Wash-Inn", con guion).
const afirmaDestino = (h: string): boolean =>
  h.includes("depósito") || h.includes("stock") || h.includes(ATENCION) || h.includes("Wash Inn");

const base = {
  id: 7,
  edificio: "E",
  maquinaVieja: VIEJA,
  maquinaNueva: NUEVA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "T",
};

// ASSERT CLAVE — los llamadores VIEJOS (los tres fixtures de arriba, ninguno pasa `movimiento`)
// siguen verdes y, sobre todo, MUDOS: el modo de falla de quien se olvide de pasar el dato tiene
// que ser "no dice nada", nunca "afirma sin saber".
for (const [nombre, h] of [
  ["completo", html],
  ["sinObs", sinObs],
  ["vacio", vacio],
  ["explícito", htmlCambioMaquina({ ...base })],
] as const) {
  assert.ok(
    !afirmaDestino(h),
    `${nombre}: sin \`movimiento\` el mail afirma algo del depósito o del stock`,
  );
}

// Swap completo: la unidad pasó a DEPOSITO y el stock general quedó correcto.
const completo = htmlCambioMaquina({
  ...base,
  movimiento: { deposito: true, stock: true },
});
assert.ok(completo.includes(DEPOSITO_OK), "no confirma el regreso al depósito");
assert.ok(completo.includes(STOCK_OK), "no confirma el stock");
assert.ok(completo.includes("Wash Inn"), "no nombra el depósito Wash Inn");
assert.ok(!completo.includes(ATENCION), "alerta un problema inexistente");
assert.ok(!completo.includes(SIN_STOCK), "mezcla el aviso de stock no actualizado");
assert.ok(!completo.includes(NO_MOVIDA), "mezcla el aviso de máquina no movida");
// El destino se lee entre el swap y la ficha de datos (la ficha repite los rótulos al final).
assert.ok(
  completo.indexOf("Máquina instalada") < completo.indexOf(DEPOSITO_OK) &&
    completo.indexOf(DEPOSITO_OK) < completo.lastIndexOf("Máquina retirada"),
  "el destino de la retirada quedó fuera de lugar",
);

// Se movió al depósito pero el +1 a 04.Stock no se pudo escribir (no hay fila con ese Lodge_ST).
const sinStock = htmlCambioMaquina({
  ...base,
  movimiento: { deposito: true, stock: false },
});
assert.ok(sinStock.includes("se envió al depósito"), "no menciona el envío a depósito");
assert.ok(sinStock.includes(SIN_STOCK), "no avisa que el stock quedó sin actualizar");
assert.ok(sinStock.includes(MANUAL), "no pide el ajuste manual");
assert.ok(!sinStock.includes(STOCK_OK), "afirma un stock que no se escribió");
assert.ok(!sinStock.includes(DEPOSITO_OK), "afirma un stock que no se escribió");
assert.ok(!sinStock.includes(NO_MOVIDA), "niega un movimiento que sí ocurrió");

// La unidad retirada no se identificó → NO se movió nada. Tono de atención + acción manual.
const noMovida = htmlCambioMaquina({
  ...base,
  movimiento: { deposito: false, stock: false },
});
assert.ok(noMovida.includes(ATENCION), "falta el aviso de atención");
assert.ok(noMovida.includes("no se pudo identificar"), "no explica por qué no se movió");
assert.ok(noMovida.includes(NO_MOVIDA), "no dice que no se movió");
assert.ok(noMovida.includes(MANUAL), "no pide la salida manual");
assert.ok(!noMovida.includes(DEPOSITO_OK), "afirma un movimiento que no ocurrió");
assert.ok(!noMovida.includes(STOCK_OK), "afirma un stock que no se acreditó");
assert.ok(!noMovida.includes(SIN_STOCK), "usa el aviso equivocado (sí se movió)");

// Combinación que hoy no se produce (no se movió, pero el stock "está bien"): no puede degradar en
// una confirmación. Manda el aviso de ATENCIÓN, que es el lado seguro.
const raro = htmlCambioMaquina({
  ...base,
  movimiento: { deposito: false, stock: true },
});
assert.ok(raro.includes(ATENCION), "el caso sin depósito no alerta");
assert.ok(!raro.includes(DEPOSITO_OK) && !raro.includes(STOCK_OK), "confirma sin haber movido");

// --- La máquina de reemplazo tampoco se identificó → el edificio quedó SIN esa máquina ---
// Caso simétrico al de la retirada: antes el mail decía "Máquina instalada: <concat>" igual, y si
// la vieja sí se había encontrado, además confirmaba el regreso al depósito. El swap se afirmaba
// entero cuando se había hecho la mitad.
const NO_INSTALADA = "no quedó registrada en el edificio";
const sinInstalar = htmlCambioMaquina({
  ...base,
  movimiento: { instalada: false, deposito: true, stock: true },
});
assert.ok(sinInstalar.includes(ATENCION), "falta el aviso de atención por la máquina no instalada");
assert.ok(sinInstalar.includes(NO_INSTALADA), "no dice que la nueva no quedó en el edificio");
assert.ok(sinInstalar.includes("a mano desde el escritorio"), "no pide la instalación manual");
// El destino de la RETIRADA es independiente: acá sí se movió, y se sigue informando.
assert.ok(sinInstalar.includes(DEPOSITO_OK), "pierde el destino de la retirada");
// El aviso de la instalación va antes del destino de la retirada (mismo orden que el swap).
assert.ok(
  sinInstalar.indexOf(NO_INSTALADA) < sinInstalar.indexOf(DEPOSITO_OK),
  "el aviso de la instalación quedó fuera de lugar",
);

// Las dos identificaciones fallaron: los dos avisos, ningún "quedó disponible".
const nadaSeMovio = htmlCambioMaquina({
  ...base,
  movimiento: { instalada: false, deposito: false, stock: false },
});
assert.ok(nadaSeMovio.includes(NO_INSTALADA) && nadaSeMovio.includes(NO_MOVIDA));
assert.ok(!nadaSeMovio.includes(DEPOSITO_OK) && !nadaSeMovio.includes(STOCK_OK));

// `instalada: true` no agrega ruido: el mail no habla de la instalación cuando salió bien.
assert.ok(
  !htmlCambioMaquina({ ...base, movimiento: { instalada: true, deposito: true, stock: true } })
    .includes(NO_INSTALADA),
  "avisa un problema de instalación inexistente",
);
// Y los llamadores que no pasan `instalada` (dato opcional) siguen mudos sobre la instalación.
assert.ok(!completo.includes(NO_INSTALADA), "sin `instalada` el mail igual afirma algo de la instalación");

// Los cuatro mensajes son excluyentes: cada mail dice exactamente una cosa del destino.
for (const [nombre, h] of [
  ["completo", completo],
  ["sinStock", sinStock],
  ["noMovida", noMovida],
  ["raro", raro],
  ["sinInstalar", sinInstalar],
  ["nadaSeMovio", nadaSeMovio],
] as const) {
  const dichos = [DEPOSITO_OK, SIN_STOCK, NO_MOVIDA].filter((f) => h.includes(f));
  assert.strictEqual(dichos.length, 1, `${nombre}: el mail da ${dichos.length} versiones del destino`);
}

// El mail de resolución sigue mostrando una sola máquina (no lo tocamos).
const resuelto = htmlIncidenteResuelto({
  id: 9,
  edificio: "E",
  maquina: VIEJA,
  fecha: "21/07",
  hora: "10:00",
  tecnico: "T",
  repuestos: [{ repuesto: "Correa", cantidad: 2 }],
});
assert.ok(resuelto.includes("Incidente resuelto") && resuelto.includes("Correa"));

console.log(
  "ok — htmlCambioMaquina muestra retirada → instalada, solo afirma el movimiento que ocurrió " +
    "y calla cuando no le pasan `movimiento`",
);
