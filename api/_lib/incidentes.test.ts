// Test offline del desempate de máquinas en 08.DetalleMaquina (bug del cambio de máquina: la
// máquina RETIRADA llega en clave de MODELO — ConcatMaquina_DM, cardinalidad N — y findMaquinaDM
// devolvía `byDM[0]`. Sin $orderby, Graph ordena por item-id ascendente, así que era SIEMPRE la
// misma unidad para cualquier incidente/edificio/técnico: el mail mostraba una máquina ajena y el
// PATCH a DEPOSITO se aplicaba sobre ella).
// Correr:  npx tsx api/_lib/incidentes.test.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  construirPatchResolucion,
  desempatarMaquinaDM,
  esModoResuelto,
  estabaEnDeposito,
  estaDadaDeBaja,
  elegirFilaStock,
  nombreStockMaquina,
  swapCompleto,
  type MaqDMFields,
  type ResolverIncidenteInput,
  type ResolverModo,
  type StockFields,
} from "./incidentes.js";
import type { ListItem } from "./sharepoint.js";

// Helper de fixture: el item-id es lo que ordena Graph, por eso va explícito.
const maq = (
  id: string,
  f: MaqDMFields,
): ListItem<MaqDMFields> => ({ id, fields: f });

// ── Fixture: tres unidades del MISMO modelo, en tres consorcios distintos ──────────────
// Reproduce los datos reales del bug: la de menor item-id (IDMaquina 1639, serie JU56XW201295)
// es la que salía en los dos mails del 27/07, sin importar de qué incidente se tratara.
const CONCAT_MODELO = "Lavarropas - Whirlpool - LAV-8KG";

const M1639 = maq("101", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1639",
  NroSerie_DM: "JU56XW201295",
  CodigoEdificio_DM: "C-2800",
  Edificio_DM: "Torre Huergo",
  Status_DM: "INSTALADA",
});
const M1545 = maq("204", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1545",
  NroSerie_DM: "JU56XW201180",
  CodigoEdificio_DM: "C-2276",
  Edificio_DM: "Dorrego 1865",
  Status_DM: "INSTALADA",
});
const M1877 = maq("377", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1877",
  NroSerie_DM: "JU56XW201410",
  CodigoEdificio_DM: "C-3120",
  Edificio_DM: "Rivadavia 4400",
  Status_DM: "INSTALADA",
});
const MODELO = [M1639, M1545, M1877];

// ── desempatarMaquinaDM() ─────────────────────────────────────────────────────────────

// EL TEST DEL BUG: con la identidad real del incidente (IDMaquina + CodigoEdificio) sale la 1877.
// Antes del parche esto devolvía la 1639 (la de menor item-id) y el PATCH a DEPOSITO se comía una
// máquina sana de otro consorcio.
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "1877", codigoEdificio: "C-3120" }),
  M1877,
);
assert.notStrictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "1877", codigoEdificio: "C-3120" }),
  M1639,
);
// misma prueba para las otras dos: no hay una unidad "privilegiada" por su item-id
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "1545", codigoEdificio: "C-2276" }),
  M1545,
);
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "1639", codigoEdificio: "C-2800" }),
  M1639,
);

// EL CORAZÓN DEL PARCHE: sin identidad no se elige nada. Antes devolvía la 1639.
assert.strictEqual(desempatarMaquinaDM(MODELO, undefined), null);
assert.strictEqual(desempatarMaquinaDM(MODELO, {}), null);
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "", codigoEdificio: "" }),
  null,
);

// hint que no matchea nada (dato viejo) → sigue ambiguo → null, nunca pool[0]
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: "9999", codigoEdificio: "C-0001" }),
  null,
);

// sólo el edificio (el incidente no trae IDMaquina_IN) alcanza para desempatar
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { codigoEdificio: "C-2276" }),
  M1545,
);
// sólo el IDMaquina también, porque acá es único dentro del modelo
assert.strictEqual(desempatarMaquinaDM(MODELO, { idMaquina: "1877" }), M1877);

// NO-REGRESIÓN: el camino de la máquina INSTALADA llega en clave unitaria (cardinalidad 1) y no
// cambia — con una sola candidata se devuelve esa, con o sin hint.
const UNICA = maq("512", {
  ConcatMaquinaIncidente_DM: "Lavarropas - Whirlpool - LAV-8KG - JU56XW209999 - 2001",
  IDMaquina_DM: "2001",
  NroSerie_DM: "JU56XW209999",
  CodigoEdificio_DM: "C-4040",
  Status_DM: "INSTALADA",
});
assert.strictEqual(desempatarMaquinaDM([UNICA], undefined), UNICA);
assert.strictEqual(desempatarMaquinaDM([UNICA], {}), UNICA);
// hint que no coincide: igual la devuelve (no hay contra qué desempatar, es la única)
assert.strictEqual(
  desempatarMaquinaDM([UNICA], { idMaquina: "1639", codigoEdificio: "C-2800" }),
  UNICA,
);
// sin candidatas → null
assert.strictEqual(desempatarMaquinaDM([], { idMaquina: "1639" }), null);

// una ELIMINADA + una viva → la viva, sin necesidad de hint
const ELIMINADA = maq("88", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1400",
  CodigoEdificio_DM: "C-1111",
  Status_DM: "ELIMINADA",
});
assert.strictEqual(desempatarMaquinaDM([ELIMINADA, M1877], undefined), M1877);
// la ELIMINADA tiene el item-id más bajo: es exactamente el caso que rompía antes
assert.notStrictEqual(
  desempatarMaquinaDM([ELIMINADA, M1877], undefined),
  ELIMINADA,
);
// si TODAS están eliminadas el criterio no discrimina (pool intacto) y hay que desempatar por identidad
const ELIM2 = maq("99", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1401",
  CodigoEdificio_DM: "C-2222",
  Status_DM: "ELIMINADA",
});
assert.strictEqual(desempatarMaquinaDM([ELIMINADA, ELIM2], undefined), null);
assert.strictEqual(
  desempatarMaquinaDM([ELIMINADA, ELIM2], { idMaquina: "1401" }),
  ELIM2,
);

// IDMaquina NO es único entre edificios (la identidad real es IDMaquina + CodigoEdificio):
// dos filas con el mismo IDMaquina en consorcios distintos → desempata el código de edificio.
const DUP_A = maq("601", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1639",
  NroSerie_DM: "JU56XW201295",
  CodigoEdificio_DM: "C-2800",
  Status_DM: "INSTALADA",
});
const DUP_B = maq("602", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1639",
  NroSerie_DM: "JU56XW300777",
  CodigoEdificio_DM: "C-2276",
  Status_DM: "INSTALADA",
});
assert.strictEqual(
  desempatarMaquinaDM([DUP_A, DUP_B], { idMaquina: "1639", codigoEdificio: "C-2276" }),
  DUP_B,
);
assert.strictEqual(
  desempatarMaquinaDM([DUP_A, DUP_B], { idMaquina: "1639", codigoEdificio: "C-2800" }),
  DUP_A,
);
// mismo IDMaquina y sin edificio → ambiguo → null (no se mueve nada)
assert.strictEqual(
  desempatarMaquinaDM([DUP_A, DUP_B], { idMaquina: "1639" }),
  null,
);

// EL EDIFICIO ES RESTRICCIÓN DURA, Y VA ANTES QUE EL ID. Caso real de drift: la fila del edificio
// del incidente quedó con IDMaquina_DM vacío, y otra unidad del mismo modelo —en otro consorcio—
// sí tiene ese ID. Si el ID se aplicara primero dejaría el pool en 1 y cortaría antes de mirar el
// edificio: se mandaría a DEPOSITO (y se sumaría al stock) una máquina sana de C-2800.
const SIN_ID_C3120 = maq("101", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "",
  CodigoEdificio_DM: "C-3120",
  Status_DM: "INSTALADA",
});
const CON_ID_AJENA = maq("204", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1877",
  CodigoEdificio_DM: "C-2800",
  Status_DM: "INSTALADA",
});
assert.strictEqual(
  desempatarMaquinaDM([SIN_ID_C3120, CON_ID_AJENA], {
    idMaquina: "1877",
    codigoEdificio: "C-3120",
  }),
  SIN_ID_C3120,
);
assert.notStrictEqual(
  desempatarMaquinaDM([SIN_ID_C3120, CON_ID_AJENA], {
    idMaquina: "1877",
    codigoEdificio: "C-3120",
  }),
  CON_ID_AJENA,
);
// Ninguna candidata puede estar en el edificio del incidente → null (no se mueve nada), aunque el
// ID matchee: una unidad de otro consorcio NUNCA es la máquina retirada.
assert.strictEqual(
  desempatarMaquinaDM([SIN_ID_C3120, CON_ID_AJENA], {
    idMaquina: "1877",
    codigoEdificio: "C-9000",
  }),
  null,
);
// `edificioDuro` (lo prende SOLO la búsqueda por clave de MODELO): una única unidad del modelo, en
// otro consorcio, NO es la del incidente. Sin el flag —clave unitaria, que ya trae la serie— el
// atajo de "candidata única" sigue mandando.
assert.strictEqual(
  desempatarMaquinaDM([CON_ID_AJENA], { idMaquina: "1877", codigoEdificio: "C-3120" }, { edificioDuro: true }),
  null,
);
assert.strictEqual(
  desempatarMaquinaDM([CON_ID_AJENA], { idMaquina: "1877", codigoEdificio: "C-3120" }),
  CON_ID_AJENA,
);
// Con el flag pero sin hint de edificio no hay nada que exigir: vuelve el atajo.
assert.strictEqual(
  desempatarMaquinaDM([CON_ID_AJENA], { idMaquina: "1877" }, { edificioDuro: true }),
  CON_ID_AJENA,
);
// Y la unidad del edificio correcto se elige igual con el flag prendido.
assert.strictEqual(
  desempatarMaquinaDM([SIN_ID_C3120], { codigoEdificio: "C-3120" }, { edificioDuro: true }),
  SIN_ID_C3120,
);
// Dos filas del edificio correcto, una con el ID: el ID desempata DENTRO del edificio.
const OTRA_C3120 = maq("305", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1901",
  CodigoEdificio_DM: "C-3120",
  Status_DM: "INSTALADA",
});
assert.strictEqual(
  desempatarMaquinaDM([SIN_ID_C3120, OTRA_C3120, CON_ID_AJENA], {
    idMaquina: "1901",
    codigoEdificio: "C-3120",
  }),
  OTRA_C3120,
);
// Filas SIN código (drift) conviven con la del edificio: gana la que tiene el código exacto.
const SIN_COD = maq("50", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1500",
  CodigoEdificio_DM: "",
  Status_DM: "INSTALADA",
});
assert.strictEqual(
  desempatarMaquinaDM([SIN_COD, SIN_ID_C3120], { codigoEdificio: "C-3120" }),
  SIN_ID_C3120,
);
// …pero si NINGUNA trae el código, las vacías siguen siendo candidatas y desempata el ID.
const SIN_COD_2 = maq("51", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1501",
  CodigoEdificio_DM: "",
  Status_DM: "INSTALADA",
});
assert.strictEqual(
  desempatarMaquinaDM([SIN_COD, SIN_COD_2], {
    idMaquina: "1501",
    codigoEdificio: "C-3120",
  }),
  SIN_COD_2,
);
assert.strictEqual(
  desempatarMaquinaDM([SIN_COD, SIN_COD_2], { codigoEdificio: "C-3120" }),
  null,
);

// Normalización (trim + mayúsculas): el drift de espacios/capitalización no rompe el desempate.
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { idMaquina: " 1877 ", codigoEdificio: " c-3120 " }),
  M1877,
);
assert.strictEqual(
  desempatarMaquinaDM(MODELO, { codigoEdificio: "c-2276" }),
  M1545,
);
// y del lado de la fila: Status con espacios/minúsculas sigue siendo "eliminada"
const ELIM_RARA = maq("70", {
  ConcatMaquina_DM: CONCAT_MODELO,
  IDMaquina_DM: "1402",
  CodigoEdificio_DM: "C-3333",
  Status_DM: "  eliminada ",
});
assert.strictEqual(desempatarMaquinaDM([ELIM_RARA, M1877], undefined), M1877);

// ── estabaEnDeposito() ────────────────────────────────────────────────────────────────
// Guarda de idempotencia del +1 a 04.Stock (misma que `veniaDeDeposito` de la escritorio).

assert.equal(estabaEnDeposito({ Status_DM: "INSTALADA" }), false);
assert.equal(estabaEnDeposito({ Status_DM: "DEPOSITO" }), true);
assert.equal(estabaEnDeposito({ Status_DM: " deposito " }), true);
assert.equal(estabaEnDeposito({}), false);
// el OR: filas viejas que sólo traen el edificio
assert.equal(estabaEnDeposito({ Edificio_DM: "Wash Inn" }), true);
assert.equal(estabaEnDeposito({ Edificio_DM: "  wash inn  " }), true);
assert.equal(
  estabaEnDeposito({ Status_DM: "INSTALADA", Edificio_DM: "Torre Huergo" }),
  false,
);
// una unidad recién mandada a depósito (la escritorio/mobile escriben los dos campos juntos)
assert.equal(
  estabaEnDeposito({ Status_DM: "DEPOSITO", Edificio_DM: "Wash Inn" }),
  true,
);
// campos vacíos no cuentan como depósito
assert.equal(estabaEnDeposito({ Status_DM: "", Edificio_DM: "" }), false);
// el código de edificio es la señal MÁS confiable (código, no nombre tipeado): alcanza solo
assert.equal(estabaEnDeposito({ CodigoEdificio_DM: "C-9999" }), true);
assert.equal(estabaEnDeposito({ CodigoEdificio_DM: " c-9999 " }), true);
assert.equal(estabaEnDeposito({ CodigoEdificio_DM: "C-2800" }), false);
// el caso que la escritorio NO detectaba: comparaba `Edificio_DM.trim() === 'Wash Inn'` exacto
assert.equal(estabaEnDeposito({ Edificio_DM: "WASH INN" }), true);

// ── estaDadaDeBaja() ──────────────────────────────────────────────────────────────────
// Descarta unidades muertas al desempatar. Depende de un literal que SOLO escribe la escritorio,
// así que el descarte es tolerante a variantes en vez de comparar contra un string exacto.

assert.equal(estaDadaDeBaja({ Status_DM: "ELIMINADA" }), true);
assert.equal(estaDadaDeBaja({ Status_DM: "eliminada" }), true);
assert.equal(estaDadaDeBaja({ Status_DM: " ELIMINADO " }), true);
assert.equal(estaDadaDeBaja({ Status_DM: "ELIMINADAS" }), true);
assert.equal(estaDadaDeBaja({ Status_DM: "BAJA" }), true);
assert.equal(estaDadaDeBaja({ Status_DM: "INSTALADA" }), false);
assert.equal(estaDadaDeBaja({ Status_DM: "DEPOSITO" }), false);
assert.equal(estaDadaDeBaja({}), false);

// ── CANARIO CROSS-REPO ────────────────────────────────────────────────────────────────
// Los dos repos no comparten código ni tipos y no hay tests de integración entre ellos: una
// divergencia de literales se descubre en producción. Este test lee el fuente de la escritorio y
// falla si dejó de escribir un estado que `estaDadaDeBaja` reconozca.
// Se SALTEA (no falla) si el repo hermano no está clonado al lado, para no romper un clone suelto.
{
  const fuenteEscritorio = new URL(
    "../../../washin-desktop/api/_lib/maquinaMoves.ts",
    import.meta.url,
  );
  let src: string | null = null;
  try {
    src = readFileSync(fuenteEscritorio, "utf8");
  } catch {
    console.log("  (canario cross-repo salteado: washin-desktop no está al lado)");
  }
  if (src !== null) {
    const escritos = [...src.matchAll(/Status_DM:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.ok(
      escritos.length > 0,
      "canario: no encontré ningún Status_DM escrito en maquinaMoves.ts de la escritorio — cambió la forma del archivo, revisá este test",
    );
    const bajas = escritos.filter((s) => estaDadaDeBaja({ Status_DM: s }));
    assert.ok(
      bajas.length > 0,
      `canario: la escritorio ya no escribe ningún estado de baja que estaDadaDeBaja() reconozca. ` +
        `Escribe: ${JSON.stringify(escritos)}. Si renombraron el literal, actualizá PREFIJOS_BAJA ` +
        `en api/_lib/incidentes.ts — si no, el desempate deja de descartar las unidades dadas de baja.`,
    );
    // Y el contrato inverso: los estados vivos que escribe la escritorio NO deben leerse como baja.
    for (const vivo of ["INSTALADA", "DEPOSITO"]) {
      assert.equal(
        estaDadaDeBaja({ Status_DM: vivo }),
        false,
        `canario: '${vivo}' se está leyendo como baja — PREFIJOS_BAJA quedó demasiado amplio`,
      );
    }
  }
}

// ── nombreStockMaquina() ──────────────────────────────────────────────────────────────
// Con qué nombre se acredita la unidad retirada en 04.Stock. Réplica de `stockKeyOf` de la
// escritorio (api/_lib/maquinaMoves.ts:24-26): sin esto, el +1 de una cargadora/encendedora/
// expendedora buscaba una fila `Lodge_ST = 'Cargadora - Maytag - MC-40'` que no existe.

const CONCAT_CARGADORA = "Cargadora - Maytag - MC-40";
assert.strictEqual(
  nombreStockMaquina({ Segmentp_DM: "Cargadora", ConcatMaquina_DM: CONCAT_CARGADORA }),
  "Cargadora",
);
assert.strictEqual(
  nombreStockMaquina({ Segmentp_DM: " encendedora ", ConcatMaquina_DM: "X" }),
  "encendedora",
);
assert.strictEqual(nombreStockMaquina({ Segmentp_DM: "Encendedor", ConcatMaquina_DM: "X" }), "Encendedor");
assert.strictEqual(nombreStockMaquina({ Segmentp_DM: "Expendedora", ConcatMaquina_DM: "X" }), "Expendedora");
// Las seriadas (lavarropas/secarropas) siguen contándose por el concat del MODELO.
assert.strictEqual(
  nombreStockMaquina({ Segmentp_DM: "Lavarropas", ConcatMaquina_DM: CONCAT_MODELO }),
  CONCAT_MODELO,
);
// Sin segmento (fila vieja) → concat, como antes.
assert.strictEqual(nombreStockMaquina({ ConcatMaquina_DM: CONCAT_MODELO }), CONCAT_MODELO);
assert.strictEqual(nombreStockMaquina({}), "");

// ── elegirFilaStock() ─────────────────────────────────────────────────────────────────
// 04.Stock tiene VARIAS filas con el mismo Lodge_ST (una por Tipo_ST); la escritorio solo cuenta
// las Activo. Acreditar en `items[0]` (menor item-id) sumaba a una fila dada de baja y el mail
// igual anunciaba "quedó disponible en stock".

const st = (id: string, f: StockFields): ListItem<StockFields> => ({ id, fields: f });

// El caso del review: la fila vieja de REPUESTO llega primero por item-id; la que cuenta gerencia
// es la de ENCENDEDORA. (Las dos llegan acá: el $filter server-side ya trae solo las Activo.)
const ST_REPUESTO = st("41", { Lodge_ST: "Encendedora", Tipo_ST: "REPUESTO", Cantidad_ST: "1" });
const ST_ENCENDEDORA = st("120", { Lodge_ST: "Encendedora", Tipo_ST: "ENCENDEDORA", Cantidad_ST: "3" });
const STOCK = [ST_REPUESTO, ST_ENCENDEDORA];
assert.strictEqual(elegirFilaStock(STOCK, "Encendedora", "Encendedora"), ST_ENCENDEDORA);
assert.strictEqual(elegirFilaStock(STOCK, "Encendedora", "Repuesto"), ST_REPUESTO);
// Sin tipo no se puede elegir → null (no se patchea nada, mismo criterio blando que el desempate).
assert.strictEqual(elegirFilaStock(STOCK, "Encendedora"), null);
// Tipo que no matchea ninguna (dato viejo sin Tipo_ST) → criterio no discriminante → sigue ambiguo.
assert.strictEqual(elegirFilaStock(STOCK, "Encendedora", "Lavarropas"), null);

// Match trim + case-insensitive de los DOS lados (el `eq` de OData era sensible; la escritorio
// matchea con trim+lowercase → un mismo ítem pegaba en un repo y no en el otro).
const ST_CORREA = st("7", { Lodge_ST: "  Correa Motor ", Tipo_ST: "REPUESTO", Cantidad_ST: "2" });
assert.strictEqual(elegirFilaStock([ST_CORREA], "correa motor", "Repuesto"), ST_CORREA);
assert.strictEqual(elegirFilaStock([ST_CORREA], "CORREA MOTOR "), ST_CORREA);
// Una sola candidata por nombre: se acredita aunque el tipo no coincida (no hay contra qué elegir).
assert.strictEqual(elegirFilaStock([ST_CORREA], "Correa Motor", "Encendedora"), ST_CORREA);
// Sin fila / sin nombre → null (el llamador devuelve false y el mail avisa el ajuste manual).
assert.strictEqual(elegirFilaStock([], "Correa Motor", "Repuesto"), null);
assert.strictEqual(elegirFilaStock(STOCK, "Cargadora", "Cargadora"), null);
assert.strictEqual(elegirFilaStock(STOCK, "", "Repuesto"), null);
// Dos filas del MISMO tipo y nombre: ambiguo → null, nunca la primera por item-id.
const DUP_ST = st("200", { Lodge_ST: "Encendedora", Tipo_ST: "ENCENDEDORA", Cantidad_ST: "9" });
assert.strictEqual(elegirFilaStock([ST_ENCENDEDORA, DUP_ST], "Encendedora", "Encendedora"), null);

// ── swapCompleto() ────────────────────────────────────────────────────────────────────
// Decide el `swap` que ve el técnico: solo "ok" si se escribieron las TRES cosas. Si alguna unidad
// no se identificó no se movió nada de ese lado, y el mail (condicional y best-effort) no puede ser
// el único canal que lo diga.
assert.equal(swapCompleto({ instalada: true, deposito: true, stock: true }), true);
assert.equal(swapCompleto({ instalada: false, deposito: true, stock: true }), false);
assert.equal(swapCompleto({ instalada: true, deposito: false, stock: false }), false);
assert.equal(swapCompleto({ instalada: true, deposito: true, stock: false }), false);

// ── construirPatchResolucion() ────────────────────────────────────────────────────────
// Regresión de M2: el "Continuar" dejaba TecnicoAsignado_IN intacto cuando el incidente quedaba
// "Pendiente", así que el técnico que ya no lo podía tocar seguía figurando como asignado y el
// reclamo no volvía al pool de gerencia (no aparecía en "Sin asignar" ni en el KPI del Home de la
// escritorio). PA escribía la columna SIEMPRE, con las dos ramas (Screen_Incidentes.pa.yaml:1110):
//   TecnicoAsignado_IN:If(cmbox_estadoCont.Selected.Value = "Resuelto",NombreUser,Blank())
const AUTH = { nombre: "Henriquez, Emiliano" };
const RELOJ = { totalRep: 0, fecha: "07/08/2026", hora: "10:30" };
const patchDe = (modo: ResolverModo, extra: Partial<ResolverIncidenteInput> = {}) =>
  construirPatchResolucion(
    { id: 1, modo, descripcion: "obs", ...extra },
    AUTH,
    RELOJ,
  );

// Los DOS modos que NO cierran: "Pendiente" + técnico BORRADO ("" porque la columna es TEXTO).
for (const modo of [
  "Requiere Repuesto",
  "Cambio de Maquina",
  "Problema del Complejo",
] as const) {
  const p = patchDe(modo);
  assert.strictEqual(p.Status_IN, "Pendiente", modo);
  assert.strictEqual(p.Resuelto_IN, "NO", modo);
  assert.strictEqual(p.TecnicoAsignado_IN, "", modo);
  // La observación del que revisó va a Descripcion_IN, no a DescripcionResuelto_IN.
  assert.strictEqual(p.Descripcion_IN, "obs", modo);
  assert.strictEqual(p.DescripcionResuelto_IN, undefined, modo);
  // Sin cierre no se pisa la versión de resolución ni las fechas de cierre.
  assert.strictEqual(p.VersionResuelto_IN, undefined, modo);
  assert.strictEqual(p.FechaResuelto_IN, undefined, modo);
}
// La clave está PRESENTE en el patch (patchItemFields manda solo lo que está en el objeto: si
// faltara, SharePoint conservaría el técnico viejo — que es exactamente el bug).
assert.ok("TecnicoAsignado_IN" in patchDe("Requiere Repuesto"));

// Los DOS modos que cierran: "Resuelto" + el técnico que resolvió.
for (const modo of ["Cambio Repuesto", "Resuelto Sin Repuesto"] as const) {
  const p = patchDe(modo);
  assert.strictEqual(p.Status_IN, "Resuelto", modo);
  assert.strictEqual(p.Resuelto_IN, "SI", modo);
  assert.strictEqual(p.TecnicoAsignado_IN, AUTH.nombre, modo);
  assert.strictEqual(p.DescripcionResuelto_IN, "obs", modo);
  assert.strictEqual(p.Descripcion_IN, undefined, modo);
  assert.strictEqual(p.FechaResuelto_IN, RELOJ.fecha, modo);
  assert.strictEqual(p.HoraResuelto_IN, RELOJ.hora, modo);
}

// El resto del patch no se movió con la extracción a función pura.
assert.strictEqual(patchDe("Cambio Repuesto").CantidadRepuestos_IN, "-");
assert.strictEqual(
  construirPatchResolucion({ id: 1, modo: "Cambio Repuesto", descripcion: "x" }, AUTH, {
    ...RELOJ,
    totalRep: 3,
  }).CantidadRepuestos_IN,
  "3",
);
// MaquinaAsignada_IN: solo en "Cambio de Maquina" (deja constancia; el swap lo hace el "Resolver").
assert.strictEqual(
  patchDe("Cambio de Maquina", { maquinaAsignada: "Lavarropas - X" }).MaquinaAsignada_IN,
  "Lavarropas - X",
);
assert.strictEqual(
  patchDe("Cambio Repuesto", { maquinaAsignada: "Lavarropas - X" }).MaquinaAsignada_IN,
  undefined,
);

// esModoResuelto(): una sola definición para el alta, el "Continuar" y el armado del patch.
assert.equal(esModoResuelto("Cambio Repuesto"), true);
assert.equal(esModoResuelto("Resuelto Sin Repuesto"), true);
assert.equal(esModoResuelto("Requiere Repuesto"), false);
assert.equal(esModoResuelto("Cambio de Maquina"), false);

// ── "Problema del Complejo" y StatusMaquina_IN ────────────────────────────────────────
// El técnico fue, revisó, y el problema es del edificio (tablero, agua, gas), no de la máquina.
// NO cierra la OT desde la mobile —la cierra gerencia de un click— y sobre todo NO puede consumir
// repuestos ni pedir reemplazo: si `esModoResuelto` lo diera por cerrado, el incidente se marcaría
// Resuelto sin que nadie de gerencia lo revise.
assert.equal(esModoResuelto("Problema del Complejo"), false);
assert.equal(esModoResuelto("Cambio Repuesto"), true);
assert.equal(esModoResuelto("Resuelto Sin Repuesto"), true);
assert.equal(esModoResuelto("Cambio de Maquina"), false);
assert.equal(esModoResuelto("Requiere Repuesto"), false);

// Un "Problema del Complejo" nunca escribe máquina asignada ni estado de máquina: no hay cambio.
{
  const p = patchDe("Problema del Complejo", {
    maquinaAsignada: "Lavadora - X - 123 - 9",
    statusMaquina: "Maquina Fuera de Servicio",
  });
  assert.strictEqual(p.NoResuelto_IN, "Problema del Complejo");
  assert.strictEqual(p.MaquinaAsignada_IN, undefined, "no hay máquina de reemplazo que pedir");
  assert.strictEqual(
    p.StatusMaquina_IN,
    undefined,
    "el estado de la máquina sólo aplica a un cambio de máquina",
  );
}

// StatusMaquina_IN se escribe SOLO en "Cambio de Maquina", y sólo con un valor del catálogo:
// la columna es TEXTO libre y un valor inventado rompería el tag de la escritorio en silencio.
{
  const ok = patchDe("Cambio de Maquina", { statusMaquina: "Funcionando Provisoriamente" });
  assert.strictEqual(ok.StatusMaquina_IN, "Funcionando Provisoriamente");

  const fuera = patchDe("Cambio de Maquina", {
    statusMaquina: "Rota" as unknown as "Maquina Fuera de Servicio",
  });
  assert.strictEqual(fuera.StatusMaquina_IN, undefined, "valor fuera del catálogo: no se escribe");

  const sinDato = patchDe("Cambio de Maquina");
  assert.strictEqual(sinDato.StatusMaquina_IN, undefined, "sin dato no se escribe la columna");

  // Y en un modo que SÍ cierra tampoco, aunque venga el dato de arrastre del formulario.
  const cerrado = patchDe("Cambio Repuesto", { statusMaquina: "Maquina Fuera de Servicio" });
  assert.strictEqual(cerrado.StatusMaquina_IN, undefined);
}

console.log(
  "ok — desempatarMaquinaDM(): el edificio es restricción dura y la identidad elige la unidad; " +
    "sin identidad devuelve null en vez de la primera por item-id. estabaEnDeposito(): guarda el +1 " +
    "con las 3 señales normalizadas (mismo contrato que la escritorio). " +
    "estaDadaDeBaja() + canario cross-repo: el descarte de unidades muertas no depende de un literal exacto. " +
    "elegirFilaStock()/nombreStockMaquina(): el reingreso a 04.Stock cae en la fila correcta o en ninguna. " +
    "swapCompleto(): un swap a medias no se reporta como 'ok'. " +
    "construirPatchResolucion(): un incidente que queda 'Pendiente' se va SIN técnico (PA :1110). " +
    "\"Problema del Complejo\" no cierra la OT y StatusMaquina_IN sólo se escribe en un cambio de máquina.",
);
