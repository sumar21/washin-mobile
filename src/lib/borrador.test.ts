// Test offline de la parte PURA de los borradores de formulario (src/lib/borrador.ts).
// No toca DOM, ni localStorage, ni IndexedDB, ni SharePoint.
// Correr:  npx tsx src/lib/borrador.test.ts
import assert from "node:assert";
import {
  PREFIJO_BORRADOR,
  TTL_BORRADOR_MS,
  VERSION_SOBRE,
  cantidadContraStock,
  claveBorrador,
  clavesAPodar,
  describirAntiguedad,
  desempaquetar,
  empaquetar,
  esClaveBorrador,
  estaVencido,
  partesDeClave,
  type BorradorScope,
} from "./borrador.js";

const AHORA = 1_770_000_000_000; // epoch fijo para que el test sea determinista

// ── claveBorrador: SCOPING (criterio no negociable) ────────────────────────────────────────
// Dos técnicos en el mismo celular NO pueden compartir borrador.
const kTec1 = claveBorrador("ventilacion", 55, 7);
const kTec2 = claveBorrador("ventilacion", 55, 9);
assert.ok(kTec1 && kTec2);
assert.notEqual(kTec1, kTec2, "mismo registro + distinto técnico = claves distintas");

// Dos registros del mismo técnico tampoco.
assert.notEqual(claveBorrador("ventilacion", 55, 7), claveBorrador("ventilacion", 56, 7));

// Distinto scope, mismo id numérico: no colisionan (ventilación 55 vs incidente 55).
assert.notEqual(claveBorrador("ventilacion", 55, 7), claveBorrador("incidente", 55, 7));

// Sin técnico o sin id NO se persiste (null = hook inerte). Es el caso del checklist "manual".
assert.equal(claveBorrador("checklist", "abc", null), null);
assert.equal(claveBorrador("checklist", "abc", undefined), null);
assert.equal(claveBorrador("checklist", null, 7), null);
assert.equal(claveBorrador("checklist", "", 7), null);
assert.equal(claveBorrador("checklist", "   ", 7), null);
assert.equal(claveBorrador("checklist", "abc", "  "), null);

// Prefijo común, para que el barrido de poda las encuentre todas.
assert.ok(kTec1!.startsWith(PREFIJO_BORRADOR));
assert.equal(esClaveBorrador(kTec1!), true);
assert.equal(esClaveBorrador("washinn-session"), false);
assert.equal(esClaveBorrador("washinn:checklist:U-1"), false); // clave vieja: NO es nuestra

// ── partesDeClave: ida y vuelta, incluso con caracteres raros en el id ──────────────────────
const kRaro = claveBorrador("checklist", "V-2026:07:01/EDIF 12", 7)!;
assert.deepEqual(partesDeClave(kRaro), {
  scope: "checklist",
  usuarioId: "7",
  id: "V-2026:07:01/EDIF 12",
});
assert.equal(partesDeClave("otra-cosa"), null);
assert.equal(partesDeClave(`${PREFIJO_BORRADOR}solo-dos:partes`), null);

// ── empaquetar / desempaquetar ─────────────────────────────────────────────────────────────
interface Valor {
  obs: string;
  n: number;
}
const raw = empaquetar<Valor>(
  "ventilacion",
  { obs: "limpieza de conductos", n: 3 },
  { ahora: AHORA, appVersion: "v20260820_1.0.0", tieneFoto: true },
);
const ok = desempaquetar<Valor>(raw, AHORA + 60_000);
assert.equal(ok.estado, "ok");
if (ok.estado === "ok") {
  assert.equal(ok.sobre.v, VERSION_SOBRE);
  assert.equal(ok.sobre.scope, "ventilacion");
  assert.equal(ok.sobre.tieneFoto, true);
  assert.equal(ok.sobre.appVersion, "v20260820_1.0.0");
  assert.deepEqual(ok.sobre.valor, { obs: "limpieza de conductos", n: 3 });
}

// LA FOTO NO VA ADENTRO DEL SOBRE: el sobre solo declara que existe.
assert.ok(!raw.includes("data:image"), "el sobre nunca lleva la foto");

// ── Estados degradados ─────────────────────────────────────────────────────────────────────
assert.equal(desempaquetar(null, AHORA).estado, "vacio");
assert.equal(desempaquetar("", AHORA).estado, "vacio");
assert.equal(desempaquetar("{no es json", AHORA).estado, "corrupto");
assert.equal(desempaquetar("[1,2,3]", AHORA).estado, "corrupto");
assert.equal(desempaquetar('"texto"', AHORA).estado, "corrupto");
assert.equal(
  desempaquetar(JSON.stringify({ v: 99, guardadoEn: AHORA, valor: {} }), AHORA).estado,
  "corrupto",
  "sobre de otro formato = corrupto",
);
assert.equal(
  desempaquetar(JSON.stringify({ v: VERSION_SOBRE, valor: {} }), AHORA).estado,
  "corrupto",
  "sin guardadoEn no se puede evaluar el TTL",
);
assert.equal(
  desempaquetar(JSON.stringify({ v: VERSION_SOBRE, guardadoEn: AHORA }), AHORA).estado,
  "corrupto",
  "sin valor no hay nada que restaurar",
);

// ── TTL: un borrador de anteayer no se restaura ────────────────────────────────────────────
assert.equal(estaVencido(AHORA, AHORA, TTL_BORRADOR_MS), false);
assert.equal(estaVencido(AHORA, AHORA + TTL_BORRADOR_MS, TTL_BORRADOR_MS), false); // borde exacto
assert.equal(estaVencido(AHORA, AHORA + TTL_BORRADOR_MS + 1, TTL_BORRADOR_MS), true);
// Reloj del celular mal al guardar: un sobre "del futuro" también caduca (si no, nunca vencería).
assert.equal(estaVencido(AHORA, AHORA - TTL_BORRADOR_MS - 1, TTL_BORRADOR_MS), true);

const viejo = desempaquetar<Valor>(raw, AHORA + TTL_BORRADOR_MS + 1);
assert.equal(viejo.estado, "vencido");
if (viejo.estado === "vencido") assert.equal(viejo.guardadoEn, AHORA);

// TTL configurable (los tests no dependen de las 12 h reales).
assert.equal(desempaquetar(raw, AHORA + 5_000, 1_000).estado, "vencido");

// ── clavesAPodar ───────────────────────────────────────────────────────────────────────────
const kVivo = claveBorrador("incidente", "nuevo", 7)!;
const kVencido = claveBorrador("incidente", 12, 7)!;
const kOtroTecnico = claveBorrador("incidente", 13, 99)!;
const kCorrupto = claveBorrador("incidente", 14, 7)!;
const disco: Record<string, string> = {
  "washinn-session": "{}", // ajena al sistema: NUNCA se toca
  [kVivo]: empaquetar("incidente", { a: 1 }, { ahora: AHORA, appVersion: "x", tieneFoto: false }),
  [kVencido]: empaquetar(
    "incidente",
    { a: 1 },
    { ahora: AHORA - TTL_BORRADOR_MS - 1, appVersion: "x", tieneFoto: false },
  ),
  [kOtroTecnico]: empaquetar(
    "incidente",
    { a: 1 },
    { ahora: AHORA, appVersion: "x", tieneFoto: false },
  ),
  [kCorrupto]: "{{{",
  [`${PREFIJO_BORRADOR}malformada`]: "{}",
};
const leer = (k: string) => disco[k] ?? null;

// Sin usuarioId: solo poda vencidos / corruptos / malformados.
const podaSinUsuario = clavesAPodar(Object.keys(disco), leer, AHORA);
assert.deepEqual(podaSinUsuario.sort(), [kCorrupto, kVencido, `${PREFIJO_BORRADOR}malformada`].sort());
assert.ok(!podaSinUsuario.includes("washinn-session"), "no toca claves ajenas");
assert.ok(!podaSinUsuario.includes(kOtroTecnico));

// Con usuarioId: además barre lo de otros técnicos (celular compartido).
const podaConUsuario = clavesAPodar(Object.keys(disco), leer, AHORA, { usuarioId: 7 });
assert.ok(podaConUsuario.includes(kOtroTecnico));
assert.ok(!podaConUsuario.includes(kVivo), "el borrador vivo del técnico logueado sobrevive");
assert.ok(!podaConUsuario.includes("washinn-session"));

// ── describirAntiguedad ────────────────────────────────────────────────────────────────────
assert.equal(describirAntiguedad(0), "recién");
assert.equal(describirAntiguedad(-500), "recién"); // reloj corrido: nunca negativo
assert.equal(describirAntiguedad(59_000), "recién");
assert.equal(describirAntiguedad(60_000), "hace 1 minuto");
assert.equal(describirAntiguedad(5 * 60_000), "hace 5 minutos");
assert.equal(describirAntiguedad(59 * 60_000), "hace 59 minutos");
assert.equal(describirAntiguedad(60 * 60_000), "hace 1 hora");
assert.equal(describirAntiguedad(4 * 60 * 60_000), "hace 4 horas");

// ── ESCENARIOS DE RESTAURACIÓN ─────────────────────────────────────────────────────────────
// Espejo PURO de la decisión que toma el hook (use-borrador.ts:133-140): arma la clave, lee ESA
// clave del disco y desempaqueta. Se reproduce acá sin React ni localStorage porque es donde
// vive el riesgo de verdad: restaurar en el formulario equivocado es PEOR que perder el
// borrador — en ventilaciones la observación se escribe en SharePoint y no se deshace desde la
// mobile (ScreenVentilaciones.tsx:109-116).
type Disco = Record<string, string>;
type Restauracion = { estado: string; valor?: unknown };

function restaurar(
  disco: Disco,
  scope: BorradorScope,
  id: string | number | null | undefined,
  usuarioId: string | number | null | undefined,
  ahora: number,
): Restauracion {
  const k = claveBorrador(scope, id, usuarioId);
  if (!k) return { estado: "inerte" }; // sin contexto completo el hook no lee ni escribe
  const r = desempaquetar<unknown>(disco[k] ?? null, ahora);
  return r.estado === "ok" ? { estado: "ok", valor: r.sobre.valor } : { estado: r.estado };
}

const TEC = 7;
const OTRO_TEC = 9;
const guardado = { descripcion: "pierde agua por la manguera", categoria: "Mecanico" };
const discoR: Disco = {
  [claveBorrador("incidente", 482, TEC)!]: empaquetar("incidente", guardado, {
    ahora: AHORA,
    appVersion: "v20260820_1.0.0",
    tieneFoto: true,
  }),
};

// Caso feliz: mismo técnico, mismo incidente, dentro del TTL.
assert.deepEqual(restaurar(discoR, "incidente", 482, TEC, AHORA + 60_000), {
  estado: "ok",
  valor: guardado,
});

// 1. LA CLAVE LLEVA EL CONTEXTO: dos incidentes distintos NO comparten borrador.
//    Sin esto, el técnico abre la OT 483 y se le carga sola la descripción de la 482.
assert.deepEqual(restaurar(discoR, "incidente", 483, TEC, AHORA + 60_000), { estado: "vacio" });
//    Tampoco cruzan formularios distintos con el mismo id numérico.
assert.deepEqual(restaurar(discoR, "ventilacion", 482, TEC, AHORA + 60_000), { estado: "vacio" });
assert.deepEqual(restaurar(discoR, "resolver", 482, TEC, AHORA + 60_000), { estado: "vacio" });
//    Ni el alta ("nuevo") con la revisión de una OT existente.
assert.deepEqual(restaurar(discoR, "incidente", "nuevo", TEC, AHORA + 60_000), { estado: "vacio" });
//    Y el id se compara como string: "482" y 482 son el MISMO registro (`id` de useParams()
//    llega string en /incidentes/:id/revisar, y numérico desde la card).
assert.deepEqual(restaurar(discoR, "incidente", "482", TEC, AHORA + 60_000), {
  estado: "ok",
  valor: guardado,
});

// 2. UN BORRADOR DE OTRO TÉCNICO NO SE RESTAURA (celular compartido / cambio de turno).
assert.deepEqual(restaurar(discoR, "incidente", 482, OTRO_TEC, AHORA + 60_000), { estado: "vacio" });
//    …y la poda con el técnico logueado lo saca del disco, no queda ahí esperando.
assert.deepEqual(
  clavesAPodar(Object.keys(discoR), (k) => discoR[k] ?? null, AHORA + 60_000, {
    usuarioId: OTRO_TEC,
  }),
  [claveBorrador("incidente", 482, TEC)!],
);

// 3. UN BORRADOR VENCIDO NO SE RESTAURA (el hook además lo borra, use-borrador.ts:137).
assert.deepEqual(restaurar(discoR, "incidente", 482, TEC, AHORA + TTL_BORRADOR_MS + 1), {
  estado: "vencido",
});
//    Justo en el borde todavía sirve (el TTL es inclusivo).
assert.equal(
  restaurar(discoR, "incidente", 482, TEC, AHORA + TTL_BORRADOR_MS).estado,
  "ok",
);
//    Reloj del celular adelantado al guardar: el sobre "del futuro" también caduca, si no
//    nunca vencería por sí solo.
assert.deepEqual(restaurar(discoR, "incidente", 482, TEC, AHORA - TTL_BORRADOR_MS - 1), {
  estado: "vencido",
});

// 4. SIN CONTEXTO EL HOOK QUEDA INERTE (no lee ni escribe): checklist sin visita en curso,
//    ventilación sin `finalizar`, diálogo de resolver sin incidente.
assert.deepEqual(restaurar(discoR, "checklist", null, TEC, AHORA), { estado: "inerte" });
assert.deepEqual(restaurar(discoR, "incidente", 482, null, AHORA), { estado: "inerte" });

// ── IDA Y VUELTA: qué sobrevive al JSON y qué no ───────────────────────────────────────────
// El sobre viaja por JSON.stringify/parse, así que la fidelidad NO es total. Lo que sigue fija
// exactamente qué se conserva, porque de eso depende que los cuatro `aplicar` lean bien.
interface ValorReal {
  resp: Record<number, { ok: boolean; obs: string }>;
  descripcion: string;
  repuestos: { item: string; cantidad: number }[];
  sinValor: null;
}
const valorReal: ValorReal = {
  // Igual que el checklist (`Record<number, ChecklistResponse>`, ScreenCheckList.tsx:50) y que
  // las ediciones de líneas del resolver (`Record<number, …>`, ResolverIncidenteDialog.tsx:51).
  resp: { 1: { ok: true, obs: "" }, 42: { ok: false, obs: 'se "traba" al centrifugar\nrevisar' } },
  // Texto libre del técnico: acentos, ñ y emoji tienen que volver intactos.
  descripcion: "Ventilación piso 3 — cañería obstruida ✅",
  repuestos: [{ item: "Correa", cantidad: 2 }],
  sinValor: null,
};
const ida = empaquetar("checklist", valorReal, {
  ahora: AHORA,
  appVersion: "v20260820_1.0.0",
  tieneFoto: false,
});
const vuelta = desempaquetar<ValorReal>(ida, AHORA);
assert.equal(vuelta.estado, "ok");
if (vuelta.estado === "ok") {
  const v = vuelta.sobre.valor;
  assert.deepEqual(v, valorReal, "ida y vuelta sin perder campos");
  assert.equal(v.descripcion, valorReal.descripcion, "acentos y emoji intactos");
  assert.equal(v.resp[42].obs, valorReal.resp[42].obs, "comillas y saltos de línea intactos");
  // CLAVE NUMÉRICA: el JSON las devuelve como STRING, pero el acceso por número sigue andando
  // porque JS coacciona el índice. De esto dependen `resp[item.ID]` (ScreenCheckList) y
  // `ed[l.lineId]` (ResolverIncidenteDialog.tsx:163). Si alguna vez se pasa a Map, se rompe.
  assert.deepEqual(Object.keys(v.resp), ["1", "42"], "las claves numéricas vuelven como string");
  assert.equal(v.resp[42].ok, false, "…pero el acceso por número sigue resolviendo");
  assert.equal(v.sinValor, null, "null sobrevive (≠ campo ausente)");
}

// `undefined` NO sobrevive: JSON.stringify borra la propiedad entera. Por eso TODOS los
// `aplicar` leen con default (`v.maquina ?? ""`, ScreenIncidenteForm.tsx:161-169;
// `v.obsFin ?? ""`, ScreenVentilaciones.tsx:128; `v.todos !== false`,
// ResolverIncidenteDialog.tsx:176). No es un bug: es el contrato.
const conUndefined = empaquetar(
  "incidente",
  { maquina: undefined, categoria: "Placa" },
  { ahora: AHORA, appVersion: "x", tieneFoto: false },
);
const rUndef = desempaquetar<{ maquina?: string; categoria: string }>(conUndefined, AHORA);
assert.equal(rUndef.estado, "ok");
if (rUndef.estado === "ok") {
  assert.equal("maquina" in (rUndef.sobre.valor as object), false, "undefined desaparece");
  assert.equal(rUndef.sobre.valor.maquina ?? "", "", "el default del `aplicar` lo cubre");
  assert.equal(rUndef.sobre.valor.categoria, "Placa");
}

// Un `valor` no serializable HACE LANZAR a empaquetar(). No se atrapa acá a propósito: el hook
// se adelanta con `serializar()` (use-borrador.ts:82-88), que devuelve null y corta antes de
// llegar a empaquetar. Este assert deja constancia de que ese guard es LOAD-BEARING: si alguien
// lo saca, una referencia cíclica en el estado del formulario tira la pantalla entera.
const ciclico: Record<string, unknown> = { a: 1 };
ciclico.yo = ciclico;
assert.throws(
  () => empaquetar("incidente", ciclico, { ahora: AHORA, appVersion: "x", tieneFoto: false }),
  "empaquetar() no protege: el guard de serializar() en el hook es obligatorio",
);

// ── cantidadContraStock: el borrador restaurado vs el stock de AHORA ───────────────────────
// Un borrador puede tener horas. Si el técnico consumió ese repuesto en otro incidente mientras
// tanto, la cantidad guardada quedó por encima del stock real.
assert.equal(cantidadContraStock(3, 5), 3, "si hay stock de sobra, se respeta lo elegido");
assert.equal(
  cantidadContraStock(3, 1),
  1,
  "el stock bajó mientras el borrador esperaba: se clampea. Tiene que aplicarse también a lo " +
    "que MUESTRA el Stepper: si el técnico ve 3 y se descargan 2, anota una cosa y " +
    "99.ABM_Repuestos_Tecnico descuenta otra",
);
assert.equal(
  cantidadContraStock(3, 0),
  0,
  "stock agotado → 0. La línea en 0 NO se envía: sería una fila fantasma con Cantidad_RI '0' " +
    "en 13.RepuestosIncidentes que igual pasa la validación de `repuestos.length === 0`",
);
assert.equal(cantidadContraStock(undefined, 5), 0, "sin selección no hay línea");
assert.equal(cantidadContraStock(2, undefined), 0, "sin stock conocido no se descarga nada");
assert.equal(cantidadContraStock(-4, 5), 0, "cantidad negativa (borrador corrupto) colapsa a 0");
assert.equal(cantidadContraStock(Number.NaN, 5), 0, "NaN colapsa a 0, no rompe el render");
assert.equal(cantidadContraStock(2.7, 5), 2, "cantidades enteras: SharePoint recibe un string");

console.log("✓ borrador.test.ts OK");
