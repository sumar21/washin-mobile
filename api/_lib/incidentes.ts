// Incidentes (10.Incidentes). Ref: docs/powerapps/incidentes.md + Screen_Incidentes.pa.yaml.
// Fase 1 (core): listar (por estado, scopeado por técnico), crear (alta de técnico) y anular.
// Fase 2 (pendiente): resolver transaccional (stock/cambio de máquina), crear-ventilación, mails.
import {
  resolveListId,
  getListItemsFiltered,
  getListItem,
  createItem,
  patchItemFields,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";
import { todayAr, nowTimeAr, arParts, APP_VERSION } from "./time.js";
import { sendMail, mailEnabled } from "./mail.js";
import { listEmails } from "./abm.js";
import {
  htmlIncidenteAnulado,
  htmlIncidenteResuelto,
  htmlCambioMaquina,
} from "./mail-incidentes.js";

const L = "10.Incidentes";
const L_REP_INC = "13.RepuestosIncidentes"; // repuestos usados/pedidos por incidente
const L_STOCK_TEC = "99.ABMRepuestos_Tecnico"; // stock personal del técnico
const L_REP_CAT = "11.Respuestos"; // catálogo general de repuestos
const L_FOTO_INC = "12.FotoIncidentes"; // fotos del incidente
const L_STOCK_GRAL = "04.Stock"; // stock general (reingreso de repuestos no usados / máquina a depósito)
const L_MAQUINAS_DM = "08.DetalleMaquina"; // máquinas (cambio de máquina al resolver)

// Depósito Wash Inn: destino de la máquina reemplazada (paridad PA: Edificio "Wash Inn", código "C-9999").
const DEPOSITO_EDIFICIO = "Wash Inn";
const DEPOSITO_CODIGO = "C-9999";

// Mails configurados por módulo en 99.ABM_Emails (para notificaciones del flujo de incidentes).
async function mailsPorModulo(
  modulo: string,
): Promise<{ sumar: string; washinn: string }> {
  const all = await listEmails();
  const row = all.find(
    (e) => e.Modulo.trim().toLowerCase() === modulo.trim().toLowerCase(),
  );
  return { sumar: row?.MailSumar ?? "", washinn: row?.MailWashinn ?? "" };
}

// Quita el prefijo data-url ("data:image/png;base64,") y deja el base64 puro (como guarda PowerApps).
function stripDataUrl(s: string): string {
  return s.replace(/^data:[^;]+;base64,/, "");
}

interface IncFields {
  IDMaquina_IN?: string;
  ConcatMaquina_IN?: string;
  CodigoEdifcio_IN?: string;
  NombreEdificio_IN?: string;
  TecnicoAsignado_IN?: string;
  Descripcion_IN?: string;
  DescripcionCarga_IN?: string;
  NoResuelto_IN?: string;
  MaquinaAsignada_IN?: string;
  Categoria_IN?: string;
  Fecha_IN?: string;
  Status_IN?: string;
  Resuelto_IN?: string;
  User_IN?: string; // login del que cargó el incidente (alta completa NO setea TecnicoAsignado_IN si no está Resuelto)
}

export interface Incidente {
  ID: number;
  IDIncidente: number; // 10.Incidentes no tiene columna propia → usamos el id del ítem
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  TecnicoAsignado_IN: string;
  Descripcion_IN: string;
  DescripcionCarga_IN: string; // observación del alta rápida (A Revisar)
  NoResuelto_IN: string;
  MaquinaAsignada_IN: string;
  Categoria_IN: string;
  Fecha_IN: string;
  Status_IN: string;
  Resuelto_IN: string;
}

const FIELDS = [
  "IDMaquina_IN",
  "ConcatMaquina_IN",
  "CodigoEdifcio_IN",
  "NombreEdificio_IN",
  "TecnicoAsignado_IN",
  "Descripcion_IN",
  "DescripcionCarga_IN",
  "NoResuelto_IN",
  "MaquinaAsignada_IN",
  "Categoria_IN",
  "Fecha_IN",
  "Status_IN",
  "Resuelto_IN",
  "User_IN",
];

function mapIncidente(it: ListItem<IncFields>): Incidente {
  const f = it.fields;
  // PA (txt_maquinaIncidente): cuando el incidente se reportó sin máquina, mostrar el fallback.
  const concatMaquina = (f.ConcatMaquina_IN ?? "").trim() || "Maquina No Especificada";
  return {
    ID: Number(it.id),
    IDIncidente: Number(it.id),
    IDMaquina_IN: f.IDMaquina_IN ?? "",
    ConcatMaquina_IN: concatMaquina,
    CodigoEdifcio_IN: f.CodigoEdifcio_IN ?? "",
    NombreEdificio_IN: f.NombreEdificio_IN ?? "",
    TecnicoAsignado_IN: f.TecnicoAsignado_IN ?? "",
    // El alta guarda en DescripcionCarga_IN; la lista cae a Descripcion_IN si existe.
    Descripcion_IN: f.Descripcion_IN || f.DescripcionCarga_IN || "",
    DescripcionCarga_IN: f.DescripcionCarga_IN ?? "",
    NoResuelto_IN: f.NoResuelto_IN ?? "",
    MaquinaAsignada_IN: f.MaquinaAsignada_IN ?? "",
    Categoria_IN: f.Categoria_IN ?? "",
    Fecha_IN: f.Fecha_IN ?? "",
    Status_IN: f.Status_IN ?? "",
    Resuelto_IN: f.Resuelto_IN ?? "",
  };
}

// Un incidente por id (scopeado por técnico, para abrir la pantalla de revisión en reload).
export async function getIncidente(
  id: number,
  auth: { rol: string; usuario: string; nombre: string },
): Promise<Incidente | null> {
  const listId = await resolveListId(L);
  const it = await getListItem<IncFields>(listId, String(id), FIELDS);
  if (!it) return null;
  const inc = mapIncidente(it);
  if (auth.rol === "Tecnico") {
    // Paridad PA (galerías de Screen_Incidentes): TecnicoAsignado_IN = NombreUser (Concat)
    // Or User_IN = VarUsuario (login). El alta completa "No Resuelto" deja TecnicoAsignado_IN
    // vacío y solo setea User_IN → sin el match por User_IN el creador no vería su propio incidente.
    const ok =
      inc.TecnicoAsignado_IN === auth.usuario ||
      inc.TecnicoAsignado_IN === auth.nombre ||
      (it.fields.User_IN ?? "") === auth.usuario;
    if (!ok) return null;
  }
  return inc;
}

// Lista por estado de resolución (activos `NO` por defecto). Técnico → solo los suyos.
export async function listIncidentes({
  rol,
  usuario,
  nombre,
  resuelto = "NO",
  meses,
}: {
  rol: string;
  usuario: string;
  nombre: string;
  resuelto?: "SI" | "NO";
  // Filtra por mes-año (FechaMesAno_IN = "mm/yyyy"). Se usa en "Cerrados" para no traer TODO
  // el histórico (lento). Vacío/undefined = sin filtro de mes.
  meses?: string[];
}): Promise<Incidente[]> {
  const listId = await resolveListId(L);
  let filter = `fields/Resuelto_IN eq '${resuelto}'`;
  if (meses && meses.length) {
    const ors = meses
      .map((m) => `fields/FechaMesAno_IN eq '${escapeODataValue(m)}'`)
      .join(" or ");
    filter += ` and (${ors})`;
  }
  if (rol === "Tecnico") {
    const u = escapeODataValue(usuario);
    const n = escapeODataValue(nombre);
    // El técnico ve SOLO lo que tiene ASIGNADO (TecnicoAsignado_IN), no lo que reportó para otro.
    // Antes se incluía `or User_IN = VarUsuario`, que le mostraba incidentes reportados desde el
    // módulo aunque estuvieran asignados a otro técnico. Se matchea TecnicoAsignado_IN contra el
    // Concat (n, lo normal) y contra el login (u) por si en algún alta se guardó el login.
    // (Los "Pendiente"/"Aprobada" sin asignar quedan en la app de escritorio; el front ya los oculta.)
    filter +=
      ` and (fields/TecnicoAsignado_IN eq '${u}'` +
      ` or fields/TecnicoAsignado_IN eq '${n}')`;
  }
  const items = await getListItemsFiltered<IncFields>(listId, FIELDS, filter);
  return items.map(mapIncidente).sort((a, b) => b.ID - a.ID);
}

export interface CrearIncidenteInput {
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  TecnicoAsignado_IN: string;
  Descripcion: string;
  Categoria?: string;
}

// Alta de incidente por técnico. Replica el payload de bt_saveReportarIncidente
// (Status="A Revisar", NoResuelto="Reportado Por Tecnico", Resuelto="NO").
// NO asigna técnico: el reporte crea un "A Revisar" SIN asignar; la asignación vive en la
// app de escritorio. PA seteaba TecnicoAsignado_IN al técnico elegido, pero como la mobile
// defaultea ese combo al usuario logueado, el reportante se auto-asignaba y el incidente le
// aparecía en "sus" incidentes (listIncidentes filtra por TecnicoAsignado_IN). El técnico
// elegido (input.TecnicoAsignado_IN) se usa solo para el aviso por WhatsApp en el front.
export async function crearIncidente(
  input: CrearIncidenteInput,
  auth: { usuario: string },
): Promise<{ id: string }> {
  const listId = await resolveListId(L);
  const hoy = todayAr(); // dd/mm/yyyy
  const [, mm, yyyy] = hoy.split("/");
  return createItem(listId, {
    Title: "Wash Inn",
    IDMaquina_IN: input.IDMaquina_IN,
    ConcatMaquina_IN: input.ConcatMaquina_IN,
    Categoria_IN: input.Categoria || "Agua",
    NoResuelto_IN: "Reportado Por Tecnico",
    DescripcionCarga_IN: input.Descripcion,
    Status_IN: "A Revisar",
    Fecha_IN: hoy,
    FechaMesAno_IN: `${mm}/${yyyy}`,
    FechaAno_IN: yyyy,
    Hora_IN: nowTimeAr(),
    // Versión del bundle que corría el técnico al REPORTAR (PA bt_saveReportarIncidente,
    // Screen_Incidentes.pa.yaml:3520 → `Version_IN:VarVersion`).
    Version_IN: APP_VERSION,
    User_IN: auth.usuario,
    CodigoEdifcio_IN: input.CodigoEdifcio_IN,
    NombreEdificio_IN: input.NombreEdificio_IN,
    Resuelto_IN: "NO",
    AppOrigen_IN: "WashinnMobile",
  });
}

// Anular: patch + mail de anulación. PA hardcodea el To (paul.risau@…) — eso es un bug de
// PowerApps (docs/powerapps/incidentes.md): NO lo copiamos. Tomamos el destinatario del módulo
// "Incidentes" de 99.ABM_Emails (MailWashinn, fallback MailSumar) y mantenemos el Bcc al MailSumar.
export async function anularIncidente(
  id: number,
  motivo: string,
): Promise<void> {
  const listId = await resolveListId(L);
  // Leemos el técnico antes del patch para el cuerpo del mail.
  const prev = await getListItem<IncFields>(listId, String(id), [
    "TecnicoAsignado_IN",
  ]);
  await patchItemFields(listId, String(id), {
    Status_IN: "Anulado",
    Resuelto_IN: "SI",
    DescripcionAnulado_IN: motivo,
  });
  if (mailEnabled()) {
    try {
      const { sumar, washinn } = await mailsPorModulo("Incidentes");
      const to = washinn || sumar; // destinatario del módulo (no el hardcode de PA)
      if (to) {
        await sendMail({
          to,
          subject: `Incidente N: ${id} Anulado`,
          html: htmlIncidenteAnulado({
            tecnico: prev?.fields.TecnicoAsignado_IN ?? "",
            id,
            observaciones: motivo,
          }),
          bcc: sumar || undefined,
        });
      }
    } catch (err) {
      console.error(
        "[incidentes] mail anulación falló:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// --- Stock personal del técnico (99.ABMRepuestos_Tecnico) ---
interface StockTecFields {
  Concat_RT?: string;
  Repuesto_RT?: string;
  Cantidad_RT?: string | number;
  Codigo_RT?: string;
  Status_RT?: string;
  Tecnico_RT?: string;
}

export interface StockTecnico {
  ID: number;
  Repuesto: string; // Concat_RT — clave que se guarda como Repuesto_RI al usarlo
  Codigo: string;
  Cantidad: number;
}

// El stock del técnico logueado (solo activos y con cantidad > 0, como el picker de PowerApps).
export async function listStockTecnico(tecnico: string): Promise<StockTecnico[]> {
  const listId = await resolveListId(L_STOCK_TEC);
  const filter =
    `fields/Tecnico_RT eq '${escapeODataValue(tecnico)}'` +
    ` and fields/Status_RT eq 'Activo'`;
  const items = await getListItemsFiltered<StockTecFields>(
    listId,
    ["Concat_RT", "Repuesto_RT", "Cantidad_RT", "Codigo_RT", "Status_RT", "Tecnico_RT"],
    filter,
  );
  return items
    .map((it: ListItem<StockTecFields>) => ({
      ID: Number(it.id),
      Repuesto: it.fields.Concat_RT || it.fields.Repuesto_RT || "",
      Codigo: it.fields.Codigo_RT ?? "",
      Cantidad: Number(it.fields.Cantidad_RT ?? 0) || 0,
    }))
    .filter((s) => s.Cantidad > 0)
    .sort((a, b) => a.Repuesto.localeCompare(b.Repuesto));
}

// --- Catálogo general de repuestos (11.Respuestos) — para el modo "Requiere Repuesto". ---
interface RepCatFields {
  ConcatRepuesto_RP?: string;
  Nombre_RP?: string;
  Codigo_RP?: string;
  Marca_RP?: string;
  Status_RP?: string;
}

export interface RepuestoCatalogo {
  ID: number;
  Nombre: string; // ConcatRepuesto_RP
  Codigo: string;
  Marca: string;
}

export async function listRepuestosCatalogo(): Promise<RepuestoCatalogo[]> {
  const listId = await resolveListId(L_REP_CAT);
  const items = await getListItemsFiltered<RepCatFields>(
    listId,
    ["ConcatRepuesto_RP", "Nombre_RP", "Codigo_RP", "Marca_RP", "Status_RP"],
    `fields/Status_RP eq 'Activo'`,
  );
  return items
    .map((it: ListItem<RepCatFields>) => ({
      ID: Number(it.id),
      Nombre: it.fields.ConcatRepuesto_RP || it.fields.Nombre_RP || "",
      Codigo: it.fields.Codigo_RP ?? "",
      Marca: it.fields.Marca_RP ?? "",
    }))
    .filter((r) => r.Nombre)
    .sort((a, b) => a.Nombre.localeCompare(b.Nombre));
}

// --- Resolver incidente (transacción multi-lista, replica los 4 modos de PowerApps) ---
//   Cambio Repuesto      → Resuelto + consume stock del técnico + crea 13.RepuestosIncidentes
//   Resuelto Sin Repuesto→ Resuelto sin repuestos
//   Requiere Repuesto    → NO resuelto + crea 13.RepuestosIncidentes pendientes (NO consume stock)
//   Cambio de Maquina    → NO resuelto + marca MaquinaAsignada_IN
export type ResolverModo =
  | "Cambio Repuesto"
  | "Resuelto Sin Repuesto"
  | "Requiere Repuesto"
  | "Cambio de Maquina";

export interface RepuestoUsado {
  stockId?: number; // id en 99.ABMRepuestos_Tecnico (solo "Cambio Repuesto" → consume)
  repuesto: string; // Concat_RT / ConcatRepuesto_RP
  cantidad: number;
}

export interface ResolverIncidenteInput {
  id: number;
  modo: ResolverModo;
  descripcion: string;
  categoria?: string;
  maquinaAsignada?: string; // "Cambio de Maquina"
  repuestos?: RepuestoUsado[];
  // "Continuar" (revisar un A-Revisar): además setea la máquina, guarda foto y notifica por mail.
  concatMaquina?: string;
  idMaquina?: string;
  nombreEdificio?: string;
  fotoBase64?: string;
  notificar?: boolean; // default true
}

// Una fila por repuesto en 13.RepuestosIncidentes (salvo "Resuelto Sin Repuesto").
async function escribirRepuestosIncidente(
  idIncidente: string,
  repuestos: RepuestoUsado[],
  modo: ResolverModo,
  mesAno: string,
): Promise<void> {
  if (!repuestos.length || modo === "Resuelto Sin Repuesto") return;
  const repListId = await resolveListId(L_REP_INC);
  for (const r of repuestos) {
    await createItem(repListId, {
      Title: "Wash Inn",
      IDIncidente_IN: idIncidente,
      Repuesto_RI: r.repuesto,
      Cantidad_RI: String(r.cantidad),
      Status_RI: "Pendiente",
      FechaMes_RI: mesAno,
    });
  }
}

// Descuenta del stock del técnico: nueva Cantidad_RT = max(0, actual - usado). Patch, nunca Remove.
async function descontarStockTecnico(repuestos: RepuestoUsado[]): Promise<void> {
  const stockListId = await resolveListId(L_STOCK_TEC);
  for (const r of repuestos) {
    if (!r.stockId) continue;
    const item = await getListItem<{ Cantidad_RT?: string | number }>(
      stockListId,
      String(r.stockId),
      ["Cantidad_RT"],
    );
    if (!item) continue;
    const actual = Number(item.fields.Cantidad_RT ?? 0) || 0;
    const nueva = Math.max(0, actual - (Number(r.cantidad) || 0));
    await patchItemFields(stockListId, String(r.stockId), {
      Cantidad_RT: String(nueva),
    });
  }
}

// Guarda la foto del incidente (base64) en 12.FotoIncidentes.
async function escribirFotoIncidente(
  idIncidente: string,
  fotoBase64: string,
): Promise<void> {
  const listId = await resolveListId(L_FOTO_INC);
  await createItem(listId, {
    Title: "Wash Inn",
    IDIncidente_FI: idIncidente,
    Foto_FI: stripDataUrl(fotoBase64),
  });
}

// Foto BEST-EFFORT: nunca rompe la resolución/alta que ya se escribió.
// La foto es OPCIONAL y es la escritura más pesada y frágil del cierre (base64 de ~380KB contra
// 12.FotoIncidentes). Siempre va ÚLTIMA, después de patchear el incidente, mover máquinas y tocar
// stock: si tiraba, el endpoint devolvía 502 con todo eso YA hecho y el técnico reintentaba →
// segundo +1 en 04.Stock / segundo juego de líneas en 13.RepuestosIncidentes. Se loguea y se sigue.
async function escribirFotoBestEffort(
  idIncidente: string,
  fotoBase64?: string,
): Promise<void> {
  if (!fotoBase64) return;
  try {
    await escribirFotoIncidente(idIncidente, fotoBase64);
  } catch (err) {
    console.error("[incidentes] no se pudo guardar la foto (se ignora):", {
      id: idIncidente,
      error: err instanceof Error ? err.message : err,
    });
  }
}

export async function resolverIncidente(
  input: ResolverIncidenteInput,
  auth: { nombre: string },
): Promise<{ ok: true; resuelto: boolean }> {
  const listId = await resolveListId(L);
  const resuelto =
    input.modo === "Cambio Repuesto" || input.modo === "Resuelto Sin Repuesto";
  const repuestos = (input.repuestos ?? []).filter(
    (r) => r.repuesto && Number(r.cantidad) > 0,
  );
  const totalRep = repuestos.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);
  const hoy = arParts(new Date());

  // 1) Patch del incidente según el modo.
  const patch: Record<string, unknown> = {
    NoResuelto_IN: input.modo,
    Status_IN: resuelto ? "Resuelto" : "Pendiente",
    Resuelto_IN: resuelto ? "SI" : "NO",
    // Sin repuestos → "-" (no "0"): es lo que muestran el mail/detalle externos. PA escribía Sum()=0.
    CantidadRepuestos_IN: totalRep > 0 ? String(totalRep) : "-",
  };
  if (input.categoria) patch.Categoria_IN = input.categoria;
  if (resuelto) {
    patch.DescripcionResuelto_IN = input.descripcion;
    patch.TecnicoAsignado_IN = auth.nombre;
    patch.FechaResuelto_IN = hoy.fecha;
    patch.HoraResuelto_IN = nowTimeAr();
    // Versión del bundle con el que se RESOLVIÓ. PA: `VersionResuelto_IN:If(...= "Resuelto",
    // VarVersion)` (Screen_Incidentes.pa.yaml:1110) — si queda "Pendiente" no se toca, así
    // conserva la del cierre real cuando el incidente se resuelva más adelante.
    patch.VersionResuelto_IN = APP_VERSION;
  } else if (input.descripcion) {
    patch.Descripcion_IN = input.descripcion;
  }
  if (input.modo === "Cambio de Maquina" && input.maquinaAsignada) {
    patch.MaquinaAsignada_IN = input.maquinaAsignada;
  }
  // "Continuar": el técnico fija/confirma la máquina del incidente.
  if (input.concatMaquina) patch.ConcatMaquina_IN = input.concatMaquina;
  if (input.idMaquina) patch.IDMaquina_IN = input.idMaquina;
  await patchItemFields(listId, String(input.id), patch);

  // 2) Líneas de repuestos en 13.RepuestosIncidentes (salvo "Resuelto Sin Repuesto").
  await escribirRepuestosIncidente(
    String(input.id),
    repuestos,
    input.modo,
    hoy.mesAno,
  );

  // 3) Consumo del stock del técnico SOLO si resolvió usando repuestos ("Cambio Repuesto").
  if (resuelto && input.modo === "Cambio Repuesto") {
    await descontarStockTecnico(repuestos);
  }

  // 4) Foto (solo si Resuelto, como PowerApps). Best-effort: el stock del técnico ya se descontó.
  if (resuelto) {
    await escribirFotoBestEffort(String(input.id), input.fotoBase64);
  }

  // 5) Mail "Incidente Resuelto" (solo Resuelto + Cambio Repuesto + notificar), como PowerApps.
  if (resuelto && input.modo === "Cambio Repuesto" && input.notificar !== false) {
    await enviarMailIncidenteResuelto({
      id: input.id,
      edificio: input.nombreEdificio ?? "",
      maquina: input.concatMaquina ?? "",
      idMaquina: input.idMaquina,
      fecha: hoy.fecha,
      tecnico: auth.nombre,
      repuestos,
    });
  }

  return { ok: true, resuelto };
}

// --- Resolver un incidente YA ASIGNADO (flujo "Resolver", distinto de "Revisar") ---
//   PowerApps (Screen_Incidentes OnSelect ~L1499, btn "Confirmar reparación"): el técnico NO elige
//   resuelto/no ni modo; los repuestos ya vienen asignados (13.RepuestosIncidentes). Solo confirma
//   cuánto usó (toggle "Todos los repuestos" = usó todo; o edita/elimina líneas) y agrega
//   observación + foto (opcional). Marca el incidente Resuelto.
//   ponytail: NO devuelve unidades no usadas a 04.Stock (stock general = app de escritorio). Solo
//   ajusta las líneas de 13.RepuestosIncidentes (Cantidad_RI / Status_RI) y marca el incidente.
export interface ResolverAsignadoLinea {
  lineId: number; // id de ítem en 13.RepuestosIncidentes
  repuesto: string;
  cantidad: number; // usado final (0 = no usado → línea Anulada)
}

export interface ResolverAsignadoCambioMaquina {
  concatMaquinaVieja: string; // incidente.ConcatMaquina_IN (la que se saca)
  concatMaquinaNueva: string; // incidente.MaquinaAsignada_IN (la que entra)
  codigoEdificio: string; // incidente.CodigoEdifcio_IN (destino de la nueva)
  nombreEdificio: string; // incidente.NombreEdificio_IN
  idMaquinaVieja?: string; // incidente.IDMaquina_IN — desempata la unidad retirada (el concat viejo es de MODELO)
  // Fila exacta en 08.DetalleMaquina, resuelta por el front con la clave UNITARIA. Es el camino de
  // PowerApps (PA L1443 resolvía el ID, L1499 patcheaba por `ID = MaquinaVieja`): sin lookup por
  // concat no hay ambigüedad posible. Opcionales porque no siempre llegan —bundle PWA viejo,
  // incidente con la clave de modelo guardada, o el camino que reconstruye el cambio desde
  // SharePoint—, y ahí se cae al desempate.
  idFilaVieja?: number;
  idFilaNueva?: number;
}

export interface ResolverAsignadoInput {
  id: number;
  descripcion: string;
  fotoBase64?: string;
  lineas?: ResolverAsignadoLinea[];
  cambioMaquina?: ResolverAsignadoCambioMaquina; // presente = flujo "Cambio de Maquina"
  nombreEdificio?: string;
  concatMaquina?: string;
  notificar?: boolean;
}

// Fila de 04.Stock (Item_ST tiene el nombre interno Lodge_ST).
export interface StockFields {
  Lodge_ST?: string;
  Cantidad_ST?: string | number;
  Tipo_ST?: string;
}

const normST = (s?: string): string => (s ?? "").trim().toLowerCase();

// Elige LA fila de 04.Stock a la que se le acredita el reingreso. PURA (sin I/O): el refinado va
// SIEMPRE en memoria porque Lodge_ST/Tipo_ST NO están indexadas y `and` entre dos no indexadas da 400.
//
// 04.Stock tiene VARIAS filas con el mismo Lodge_ST a propósito: la escritorio crea una por
// combinación Tipo_ST + Item_ST y solo cuenta las `Status_ST eq 'Activo'` (api/stock/index.ts:86-94).
// Quedarse con la primera que devuelve Graph (orden por item-id) acreditaba la unidad en una fila
// dada de baja o de otro tipo, y el mail igual anunciaba "quedó disponible en stock".
//
// Además el match es trim+lowercase de los DOS lados, como la escritorio: el `eq` de OData es
// sensible a mayúsculas y espacios (riesgo #2 del CLAUDE.md raíz) y acá ya tiene consecuencia de
// escritura. Si queda ambiguo (0 o >1 candidatas) devolvemos null y NO se patchea nada.
export function elegirFilaStock(
  items: ListItem<StockFields>[],
  nombre: string,
  tipo?: string,
): ListItem<StockFields> | null {
  const n = normST(nombre);
  if (!n) return null;
  let pool = items.filter((i) => normST(i.fields.Lodge_ST) === n);
  if (!pool.length) return null;
  // El tipo solo ACOTA (si no matchea ninguna se lo considera no discriminante: hay filas viejas
  // sin Tipo_ST). Con una sola candidata no hace falta y sería un motivo más para no acreditar.
  const t = normST(tipo);
  if (pool.length > 1 && t) {
    const porTipo = pool.filter((i) => normST(i.fields.Tipo_ST) === t);
    if (porTipo.length) pool = porTipo;
  }
  return pool.length === 1 ? pool[0] : null;
}

// Reingresa `cantidad` unidades al stock general (04.Stock) para el ítem `nombre` (Item_ST = Lodge_ST).
// `tipo` (Tipo_ST: REPUESTO / LAVADORA / …) desempata cuando hay varias filas con ese mismo nombre.
// Si no se puede identificar UNA fila no patchea nada (paridad PA: LookUp sin match no patchea) y
// devuelve `false`: el llamador necesita saberlo para no ANUNCIAR un movimiento de stock que nunca
// ocurrió (el mail de cambio de máquina lo afirmaba como texto fijo). La rama de repuestos ignora
// el retorno a propósito.
async function reingresarStockGeneral(
  nombre: string,
  cantidad: number,
  tipo?: string,
): Promise<boolean> {
  const n = Number(cantidad) || 0;
  if (!nombre || n <= 0) return false;
  const listId = await resolveListId(L_STOCK_GRAL);
  // Status_ST SÍ está indexada (misma query que usa la escritorio: api/stock/index.ts:85-89); el
  // resto se refina en memoria con `elegirFilaStock`.
  const items = await getListItemsFiltered<StockFields>(
    listId,
    ["Lodge_ST", "Cantidad_ST", "Tipo_ST"],
    `fields/Status_ST eq 'Activo'`,
  );
  const it = elegirFilaStock(items, nombre, tipo);
  if (!it) {
    console.warn(
      "[incidentes] reingreso a 04.Stock omitido: no hay UNA fila activa para ese ítem.",
      { item: nombre, tipo: tipo ?? "", cantidad: n },
    );
    return false;
  }
  const actual = Number(it.fields.Cantidad_ST ?? 0) || 0;
  await patchItemFields(listId, String(it.id), {
    Cantidad_ST: String(actual + n),
  });
  return true;
}

// Máquina de 08.DetalleMaquina por su Concat. PA matchea por ConcatMaquinaIncidente_DM; caemos a
// ConcatMaquina_DM por compatibilidad con incidentes creados desde la mobile.
// Columnas de 08.DetalleMaquina que necesita el swap. Compartidas por los dos caminos de lectura
// (por ID de fila y por concat) para que la fila venga igual de completa por cualquiera de los dos.
const COLS_DM = [
  "ConcatMaquina_DM",
  "ConcatMaquinaIncidente_DM",
  "Encendido_DM",
  "NroSerie_DM",
  "IDMaquina_DM",
  "CodigoEdificio_DM",
  "Status_DM",
  "Edificio_DM",
  "Segmentp_DM",
];
export interface MaqDMFields {
  ConcatMaquina_DM?: string;
  ConcatMaquinaIncidente_DM?: string;
  Encendido_DM?: string;
  NroSerie_DM?: string;
  IDMaquina_DM?: string;
  CodigoEdificio_DM?: string;
  Status_DM?: string;
  Edificio_DM?: string;
  Segmentp_DM?: string; // = Segmento_DM (typo real en el tenant); define la clave de 04.Stock
}

// Status_DM con el que la escritorio da de baja una máquina (`applyMaquinaBaja`,
// washin-desktop/api/_lib/maquinaMoves.ts). La mobile NUNCA lo escribe, solo lo lee para descartar
// unidades muertas al desempatar.
//
// DEPENDENCIA CRUZADA DECLARADA: si allá renombran el literal, acá el desempate se degradaría en
// silencio (las bajas volverían a competir como candidatas). Dos defensas:
//   1. `api/_lib/incidentes.test.ts` tiene un test canario que lee el fuente de la escritorio y
//      falla si el literal dejó de aparecer (se saltea solo si el repo hermano no está clonado).
//   2. El descarte es TOLERANTE: se acepta cualquier variante que empiece con "ELIMINAD"
//      (ELIMINADA / ELIMINADO / ELIMINADAS) y también "BAJA", que es como lo nombran las pantallas.
// Y aunque las dos defensas fallaran, el modo de degradación es SEGURO: una candidata de más deja
// el pool ambiguo → `desempatarMaquinaDM` devuelve null → no se mueve nada. Nunca se elige la fila
// equivocada, que era el bug original.
export const PREFIJOS_BAJA = ["ELIMINAD", "BAJA"] as const;
export function estaDadaDeBaja(fields: MaqDMFields): boolean {
  const s = normDM(fields.Status_DM);
  return PREFIJOS_BAJA.some((p) => s.startsWith(p));
}

// Segmentos que en 04.Stock se cuentan por el NOMBRE DEL SEGMENTO y no por ConcatMaquina_DM
// (no son seriados: van como cantidad simple). DUPLICADO A PROPÓSITO de la escritorio
// (`STOCK_BY_SEGMENT` + `stockKeyOf`, washin-desktop/api/_lib/maquinaMoves.ts:16,24-26): los repos
// no comparten código. Si cambia allá, hay que cambiarlo acá — está anotado en §6 del CLAUDE.md raíz.
const STOCK_POR_SEGMENTO = new Set([
  "encendedora",
  "encendedor",
  "cargadora",
  "expendedora",
]);

// Con qué nombre se acredita esta máquina en 04.Stock (Item_ST = Lodge_ST). PURA (sin I/O).
// Reingresar siempre por ConcatMaquina_DM dejaba a esos cuatro segmentos sin fila que actualizar, y
// el desbalance era doble: la escritorio, al reinstalar la unidad desde el depósito, RESTA por
// `stockKeyOf` una unidad que nunca se sumó.
export function nombreStockMaquina(fields: MaqDMFields): string {
  const seg = (fields.Segmentp_DM ?? "").trim();
  if (seg && STOCK_POR_SEGMENTO.has(seg.toLowerCase())) return seg;
  return fields.ConcatMaquina_DM ?? "";
}

// Identidad real de una máquina = IDMaquina + CodigoEdificio (docs/incidentes-por-maquina.md).
// Se usa para desempatar cuando el concat que trae el incidente es de MODELO (cardinalidad N).
export interface MaquinaUnidadHint {
  idMaquina?: string;
  codigoEdificio?: string;
}

const normDM = (s?: string): string => (s ?? "").trim().toUpperCase();

// Elige UNA fila de 08.DetalleMaquina entre las candidatas de un mismo concat. PURA (sin I/O):
// el desempate va SIEMPRE en memoria — nunca `and` entre columnas no indexadas en el $filter.
//
// ConcatMaquina_DM es la clave de MODELO (la misma que Item_ST de 04.Stock) → N filas por consulta,
// una por unidad física de ese modelo en TODO el parque. Devolver la primera (que Graph ordena por
// item-id ascendente, sin $orderby) siempre daba la MISMA unidad para cualquier incidente: el mail
// mostraba una máquina ajena y, peor, el PATCH a DEPOSITO se aplicaba sobre ella.
//
// Criterios, del más barato al más específico. Los "blandos" solo ACOTAN: si no matchean ninguna
// candidata se los considera no discriminantes (dato viejo/vacío) y se sigue con el pool anterior.
// El edificio es la excepción: es restricción DURA (ver abajo). Si al final el pool no tiene
// exactamente una fila devolvemos null → el llamador no mueve nada (variante blanda: no mover es
// reversible a mano; mover la unidad equivocada corrompe dos edificios y el stock).
export function desempatarMaquinaDM(
  cands: ListItem<MaqDMFields>[],
  unidad?: MaquinaUnidadHint,
  // `edificioDuro`: lo prende SOLO el llamador que buscó por la clave de MODELO. Ver más abajo.
  opts?: { edificioDuro?: boolean },
): ListItem<MaqDMFields> | null {
  if (!cands.length) return null;

  // 1) CodigoEdificio_DM: VA PRIMERO y es restricción DURA. La máquina retirada está, por
  //    definición, en el edificio del incidente, así que una candidata de OTRO consorcio nunca es
  //    la buscada — y mandarla a DEPOSITO es exactamente la corrupción que este desempate evita.
  //    Si fuera un criterio blando más, un ID que dejara el pool en 1 cortaría antes de mirarlo
  //    (IDMaquina no es único entre edificios) y podría elegir una unidad ajena. Por lo mismo se
  //    aplica ANTES del atajo de "candidata única": con la clave de MODELO, que el parque tenga una
  //    sola unidad de ese modelo no significa que sea la del incidente.
  //    Las filas con CodigoEdificio_DM vacío sobreviven (drift real del dato): no se sabe que sean
  //    de otro edificio, y el ID de abajo termina de decidir.
  const wantedCod = normDM(unidad?.codigoEdificio);
  const duro = !!opts?.edificioDuro && !!wantedCod;
  // Con la clave UNITARIA (Segmento - Marca - Serie - ID) el concat YA identifica la unidad: una
  // sola candidata es la respuesta aunque el edificio no coincida (traslado/renombre sin reflejar
  // en el incidente). Por eso el atajo sigue vivo salvo que el llamador exija el edificio.
  if (cands.length === 1 && !duro) return cands[0];

  let pool = cands;
  const acotar = (
    pred: (m: ListItem<MaqDMFields>) => boolean,
  ): ListItem<MaqDMFields> | null => {
    const next = pool.filter(pred);
    if (next.length) pool = next; // 0 matches = criterio no discriminante → se mantiene el pool
    return pool.length === 1 ? pool[0] : null;
  };

  if (wantedCod) {
    pool = pool.filter((m) => {
      const cod = normDM(m.fields.CodigoEdificio_DM);
      return !cod || cod === wantedCod;
    });
    if (!pool.length) return null; // ninguna candidata puede estar en ese edificio
    // Si hay match exacto, las de código vacío dejan de ser candidatas.
    const exactas = pool.filter(
      (m) => normDM(m.fields.CodigoEdificio_DM) === wantedCod,
    );
    if (exactas.length) pool = exactas;
    if (pool.length === 1) return pool[0];
  }

  // 2) Las dadas de baja no son la unidad de un incidente vivo.
  let unica = acotar((m) => !estaDadaDeBaja(m.fields));
  if (unica) return unica;

  // 3) IDMaquina_DM contra el hint del incidente (IDMaquina_IN), ya dentro del edificio correcto.
  const wantedId = normDM(unidad?.idMaquina);
  if (wantedId) {
    unica = acotar((m) => normDM(m.fields.IDMaquina_DM) === wantedId);
    if (unica) return unica;
  }

  return null; // sigue ambiguo → NUNCA pool[0]
}

async function findMaquinaDM(
  maqListId: string,
  concat: string,
  unidad?: MaquinaUnidadHint,
): Promise<ListItem<MaqDMFields> | null> {
  if (!concat) return null;
  const c = escapeODataValue(concat);
  // NroSerie_DM/IDMaquina_DM: para enriquecer los mails de incidente (serie/ID de la máquina).
  // CodigoEdificio_DM/Status_DM: para desempatar en memoria cuando el concat es de modelo.
  // Edificio_DM: para la guarda de idempotencia del reingreso a 04.Stock (estabaEnDeposito).
  // Segmentp_DM (sic, = Segmento_DM): define con qué nombre se acredita en 04.Stock.
  const cols = COLS_DM;
  // Primario: ConcatMaquinaIncidente_DM (el que trae la serie; es lo que guarda el incidente en
  // ConcatMaquina_IN / MaquinaAsignada_IN — validado contra datos reales). Fallback a ConcatMaquina_DM.
  const byInc = await getListItemsFiltered<MaqDMFields>(
    maqListId,
    cols,
    `fields/ConcatMaquinaIncidente_DM eq '${c}'`,
  );
  // Si el concat pegó en la clave unitaria no bajamos a la de modelo: sería una clave estrictamente
  // peor. Con una sola fila el resultado es idéntico al de siempre.
  if (byInc.length) return desempatarMaquinaDM(byInc, unidad);
  const byDM = await getListItemsFiltered<MaqDMFields>(
    maqListId,
    cols,
    `fields/ConcatMaquina_DM eq '${c}'`,
  );
  // Clave de MODELO: acá el edificio del incidente es restricción DURA (una unidad de otro
  // consorcio nunca es la del incidente), incluso si el modelo tiene una sola unidad en el parque.
  return desempatarMaquinaDM(byDM, unidad, { edificioDuro: true });
}

// ¿La fila de 08.DetalleMaquina YA estaba en el depósito? PURA (sin I/O), para testear offline.
// Gatea el +1 a 04.Stock: una máquina que ya está en depósito no vuelve a sumar stock.
//
// CONTRATO CRUZADO — esta función y `veniaDeDeposito` de la escritorio
// (washin-desktop/api/_lib/maquinaMoves.ts) tienen que decidir IGUAL sobre la misma fila. Si
// divergen, la mobile suma un +1 que la escritorio no resta (o al revés) y el desbalance queda
// tapado por el `Math.max(0, …)` del ajuste de stock, o sea: invisible. Los dos repos miran las
// TRES señales, normalizadas con trim + uppercase:
//   1. CodigoEdificio_DM === 'C-9999'  → la más confiable: es un código, no un nombre tipeado.
//   2. Status_DM === 'DEPOSITO'
//   3. Edificio_DM === 'Wash Inn'
// Se miran las tres —y no solo una— porque el dato real llega por caminos distintos: la escritorio
// escribe las tres al transferir a depósito, la mobile también desde el swap, pero quedan filas
// viejas cargadas por la PowerApp original con solo una de las tres. Comparar exacto y
// case-sensitive contra un nombre de edificio (lo que hacía la escritorio) fallaba con
// 'WASH INN' o 'Wash inn'.
export function estabaEnDeposito(fields: MaqDMFields): boolean {
  return (
    normDM(fields.CodigoEdificio_DM) === normDM(DEPOSITO_CODIGO) ||
    normDM(fields.Status_DM) === "DEPOSITO" ||
    normDM(fields.Edificio_DM) === normDM(DEPOSITO_EDIFICIO)
  );
}

// Trae la fila de 08.DetalleMaquina de una unidad del swap.
//
// PRIMER camino, el de PowerApps: si el front mandó el ID de fila, se pide ESA fila por clave
// primaria y listo. PA hacía exactamente esto —resolvía el ID contra `CollectMaquinas` por la clave
// unitaria y después patcheaba `LookUp('08.DetalleMaquina', ID = MaquinaVieja)`—, así que nunca
// tuvo un lookup ambiguo. El port a React lo reemplazó por "volver a buscar por concat" y ahí nació
// el bug de mandar al depósito la máquina de otro consorcio.
//
// SEGUNDO camino, el fallback: cuando el ID no llega (bundle PWA viejo, incidente que guardó la
// clave de modelo, o el camino que reconstruye el cambio desde SharePoint) se busca por concat y se
// desempata. Es lógica que PA no necesitaba; existe solo para tolerar los datos que quedaron mal.
async function traerMaquinaDM(
  maqListId: string,
  idFila: number | undefined,
  concat: string,
  unidad?: MaquinaUnidadHint,
): Promise<ListItem<MaqDMFields> | null> {
  if (idFila != null) {
    try {
      return await getListItem<MaqDMFields>(maqListId, String(idFila), COLS_DM);
    } catch (err) {
      // La fila pudo haberse borrado entre que el front cargó el parque y el técnico resolvió.
      // No se aborta: se cae al concat, que es lo que veníamos haciendo.
      console.warn("[incidentes] no se pudo leer la máquina por ID de fila, voy por concat:", {
        idFila,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  return findMaquinaDM(maqListId, concat, unidad);
}

// NOTA — por qué no hay marca de reintento en la fila de la máquina:
// distinguir "esta unidad ya estaba en depósito de antes" de "la mandó este mismo incidente y el
// crédito a 04.Stock quedó a medias" necesitaría escribir un marcador en 08.DetalleMaquina. La
// única columna de texto libre disponible es `Motivo_DM`, y la escritorio la usa como TAG en su
// grilla, así que ensuciarla rompe esa vista. Queda pendiente hasta tener una columna propia
// (requiere Sites.Manage.All, que la app no tiene). Mientras tanto el caso se denuncia por log.

// Swap de máquinas al resolver un "Cambio de Maquina" (paridad PA L1499):
//   nueva → INSTALADA en el edificio del incidente (hereda Encendido_DM del edificio),
//   vieja → DEPOSITO en Wash Inn (C-9999) y su unidad reingresa a 04.Stock.
interface MaqIdSerie {
  serie: string;
  id: string;
}
// Qué se llegó a escribir realmente del swap. Se DEVUELVE (antes se descartaba) porque el mail lo
// afirmaba como texto fijo: cuando una unidad no se identificaba, avisaba movimientos que nunca
// ocurrieron. Es además lo que decide el `swap` que ve el técnico (ver `swapCompleto`).
//   instalada → se patcheó la fila de la NUEVA a INSTALADA en el edificio del incidente.
//   deposito  → se patcheó la fila de la VIEJA a DEPOSITO / Wash Inn / C-9999.
//   stock     → el stock general quedó correcto (ver el comentario del cálculo, más abajo).
export interface MovimientoCambioMaquina {
  instalada: boolean;
  deposito: boolean;
  stock: boolean;
}

// ¿El swap quedó completo? Si no, el incidente igual queda Resuelto (no se revierte: lo que se
// escribió, escrito está) pero el front tiene que decirle al técnico que avise a la oficina en vez
// de darle el visto bueno. Sin esto, el ÚNICO canal era el mail — que es triplemente condicional
// (notificar !== false, mailEnabled() y best-effort dentro de un try/catch).
export function swapCompleto(m: MovimientoCambioMaquina): boolean {
  return m.instalada && m.deposito && m.stock;
}
// Marca de progreso que el llamador LEE EN SU catch. El swap no es transaccional: si tira a mitad
// de camino, lo único que decide si el incidente se puede revertir (y por lo tanto reintentar) es
// si ya se escribió algo en 08.DetalleMaquina / 04.Stock. `escribio` se prende JUSTO ANTES del
// primer patch — nunca después, porque un patch que tira igual pudo haber llegado a impactar.
export interface ProgresoCambioMaquina {
  escribio: boolean;
}
async function ejecutarCambioMaquina(
  cm: ResolverAsignadoCambioMaquina,
  progreso: ProgresoCambioMaquina,
  idIncidente: string | number,
): Promise<{
  vieja: MaqIdSerie;
  nueva: MaqIdSerie;
  movimiento: MovimientoCambioMaquina;
}> {
  const maqListId = await resolveListId(L_MAQUINAS_DM);
  const [vieja, nueva] = await Promise.all([
    // La vieja llega en ConcatMaquina_IN, que la mobile escribe con la clave de MODELO → cae al
    // fallback y matchea N unidades: sin el hint de identidad se movía a depósito una máquina ajena.
    traerMaquinaDM(maqListId, cm.idFilaVieja, cm.concatMaquinaVieja, {
      idMaquina: cm.idMaquinaVieja,
      codigoEdificio: cm.codigoEdificio,
    }),
    // La nueva llega en MaquinaAsignada_IN, que la escribe la escritorio en clave UNITARIA
    // ("Segmento - Marca - Serie - ID") → pega la query primaria, cardinalidad 1: no hay qué
    // desempatar. VA SIN HINT a propósito: 10.Incidentes no guarda la identidad de la unidad de
    // reemplazo (la aprobación sí, pero el incidente solo copia el concat), y `cm.codigoEdificio`
    // es el edificio DESTINO — la nueva todavía está en el depósito, así que como hint sería falso.
    // Si el concat no pega y el fallback de MODELO queda ambiguo, `nueva` es null y no se instala nada.
    traerMaquinaDM(maqListId, cm.idFilaNueva, cm.concatMaquinaNueva),
  ]);
  // Encendido del edificio destino (primera máquina con Encendido de ese edificio), como PA.
  let encendido = "";
  if (cm.codigoEdificio) {
    const enEdificio = await getListItemsFiltered<{ Encendido_DM?: string }>(
      maqListId,
      ["Encendido_DM"],
      `fields/CodigoEdificio_DM eq '${escapeODataValue(cm.codigoEdificio)}'`,
    );
    encendido =
      enEdificio.find((m) => (m.fields.Encendido_DM ?? "").trim())?.fields
        .Encendido_DM ?? "";
  }
  const movimiento: MovimientoCambioMaquina = {
    instalada: false,
    deposito: false,
    stock: false,
  };
  // Nueva → INSTALADA en el edificio del incidente.
  if (nueva) {
    progreso.escribio = true; // primer write del swap: a partir de acá no se revierte el incidente
    await patchItemFields(maqListId, String(nueva.id), {
      Status_DM: "INSTALADA",
      CodigoEdificio_DM: cm.codigoEdificio,
      Edificio_DM: cm.nombreEdificio,
      ...(encendido ? { Encendido_DM: encendido } : {}),
    });
    movimiento.instalada = true;
  } else {
    // Caso simétrico al de la retirada: sin identificar la unidad de reemplazo no se patchea nada
    // (instalar la máquina equivocada la saca de donde esté y la duplica acá). El edificio queda
    // sin la máquina en 08.DetalleMaquina → hay que instalarla a mano desde la escritorio.
    console.error(
      "[incidentes] cambio de máquina: no se identificó la unidad de reemplazo — no se instaló en el edificio.",
      { concat: cm.concatMaquinaNueva, codigoEdificio: cm.codigoEdificio },
    );
  }
  // Vieja → DEPOSITO en Wash Inn + reingreso de su unidad al stock general.
  if (vieja) {
    // ⚠️ ORDEN CRÍTICO: `yaEstaba` se calcula ANTES del patch, con el estado PREVIO de la fila.
    // El patch es idempotente (reescribe los mismos valores), el +1 de stock NO lo es: sin guarda,
    // cada reintento del técnico —y el arreglo manual desde la escritorio— sumaba otra unidad.
    // NO reordenar: leyendo el estado DESPUÉS del patch la fila ya está en DEPOSITO, la guarda se
    // auto-anularía y el reingreso no se haría NUNCA, rompiendo la regla de oro del stock
    // (la escritorio compromete al asignar, la mobile reingresa al resolver).
    const yaEstaba = estabaEnDeposito(vieja.fields);
    // Anomalía: la unidad que el técnico está retirando de un edificio YA figuraba en depósito. O es
    // un reintento de este mismo cambio, o el dato estaba mal de antes. En los dos casos el +1 se
    // saltea (lado seguro: nunca duplicar), pero antes se salteaba MUDO.
    // Este warn es la única señal de un posible +1 perdido: si el intento anterior murió justo entre
    // el patch y el reingreso, el crédito no se hizo y nadie se entera. Distinguir los dos casos
    // requeriría un registro durable del crédito —una columna nueva en 10.Incidentes, y la app no
    // tiene Sites.Manage.All—, así que por ahora se denuncia y se verifica a mano.
    if (yaEstaba) {
      console.warn(
        "[incidentes] la unidad retirada ya figuraba en DEPÓSITO antes del swap: NO se reingresa a 04.Stock para no duplicar. Si esto fue un reintento y el intento previo no llegó a acreditar, falta un +1 — verificar a mano.",
        {
          idIncidente,
          idFila: vieja.id,
          status: vieja.fields.Status_DM,
          edificio: vieja.fields.Edificio_DM,
          codigoEdificio: vieja.fields.CodigoEdificio_DM,
        },
      );
    }
    progreso.escribio = true; // (ya puede venir en true si se patcheó la nueva)
    await patchItemFields(maqListId, String(vieja.id), {
      Status_DM: "DEPOSITO",
      Edificio_DM: DEPOSITO_EDIFICIO,
      CodigoEdificio_DM: DEPOSITO_CODIGO,
      // Exactamente las 3 columnas de PA L1499, ni una más:
      //   - NO se limpia `Encendido_DM`. Lo probamos y lo sacamos: PA no lo hacía, y al reinstalar
      //     la unidad su encendido se pisa igual (acá con el del edificio destino, en la escritorio
      //     con el elegido o el de la encendedora del destino). El valor viejo nunca se propaga.
      //   - NO se escribe `Motivo_DM`. La escritorio la usa con un vocabulario acotado y aparece en
      //     la vista nativa de la lista; meterle texto libre ensucia esa columna.
    });
    movimiento.deposito = true;
    // `stock` significa "el stock general quedó correcto", NO "se sumó un +1". Si la fila YA estaba
    // en depósito el +1 se saltea a propósito (guarda de idempotencia: la unidad se acreditó en el
    // intento anterior) y el stock igual está bien → true. Modelarlo como false haría que el mail
    // denunciara un problema inexistente en cada reintento del técnico.
    movimiento.stock = yaEstaba
      ? true
      : await reingresarStockGeneral(
          // NO siempre es ConcatMaquina_DM: encendedora/cargadora/expendedora se cuentan por
          // segmento en 04.Stock (igual que `stockKeyOf` de la escritorio).
          nombreStockMaquina(vieja.fields),
          1,
          vieja.fields.Segmentp_DM,
        );
  } else {
    // Variante blanda: la nueva ya se instaló, pero sin identificar la unidad retirada NO tocamos
    // 08.DetalleMaquina ni 04.Stock (mover la máquina equivocada corrompe dos edificios y el stock).
    // Este skip era mudo: por eso el bug fue invisible en producción.
    console.error(
      "[incidentes] cambio de máquina: no se identificó la unidad retirada — no se movió a DEPOSITO ni se reingresó a 04.Stock.",
      {
        concat: cm.concatMaquinaVieja,
        idMaquina: cm.idMaquinaVieja ?? "",
        codigoEdificio: cm.codigoEdificio,
      },
    );
  }
  // Serie/ID de ambas para el mail de cambio de máquina (best-effort; "" si no se encontró), más
  // lo que se escribió del movimiento de la vieja (el mail lo reporta en vez de darlo por hecho).
  return {
    vieja: { serie: vieja?.fields.NroSerie_DM ?? "", id: vieja?.fields.IDMaquina_DM ?? "" },
    nueva: { serie: nueva?.fields.NroSerie_DM ?? "", id: nueva?.fields.IDMaquina_DM ?? "" },
    movimiento,
  };
}

// Resultado del swap de máquinas, para que el front le diga al técnico qué pasó REALMENTE.
//   ok         → el swap se ejecutó (o no había swap: rama de repuestos, donde ni se manda).
//   reintentar → el swap falló SIN escribir nada; el incidente volvió a "Asignado" y se puede
//                reintentar sin riesgo de duplicar el stock.
//   parcial    → el swap quedó a medias y el incidente quedó "Resuelto": NO hay que reintentar
//                (duplicaría el reingreso a 04.Stock), tiene que mirarlo la oficina. Cubre los dos
//                caminos: que el swap tire DESPUÉS de escribir, y que alguna de las dos unidades no
//                se haya podido identificar en 08.DetalleMaquina (ahí no se mueve nada a propósito).
export type ResultadoSwap = "ok" | "reintentar" | "parcial";

export async function resolverAsignadoIncidente(
  input: ResolverAsignadoInput,
  auth: { nombre: string },
): Promise<{ ok: true; resuelto: boolean; swap?: ResultadoSwap }> {
  const listId = await resolveListId(L);
  const hoy = arParts(new Date());

  // Guard de integridad (bug: cambio de máquina quedaba marcado "Cambio Repuesto" y rompía el
  // stock de la escritorio). PowerApps (finalizar_incidente) detecta el cambio de máquina por
  // MaquinaAsignada_IN <> Blank (la máquina de reemplazo que asigna la escritorio), NO por
  // NoResuelto_IN. Si el front no mandó cambioMaquina pero el incidente TIENE máquina asignada,
  // lo reconstruimos desde el registro y lo resolvemos como cambio de máquina — así NUNCA se
  // re-marca como "Cambio Repuesto" (la rama de repuestos sobrescribe NoResuelto_IN).
  let cm = input.cambioMaquina;
  if (!cm) {
    const prev = await getListItem<IncFields>(listId, String(input.id), [
      "MaquinaAsignada_IN",
      "ConcatMaquina_IN",
      "CodigoEdifcio_IN",
      "NombreEdificio_IN",
      "NoResuelto_IN",
      "IDMaquina_IN",
    ]);
    const maqAsignada = (prev?.fields.MaquinaAsignada_IN ?? "").trim();
    if (maqAsignada && prev?.fields.NoResuelto_IN !== "Requiere Repuesto") {
      cm = {
        concatMaquinaVieja: prev?.fields.ConcatMaquina_IN ?? "",
        concatMaquinaNueva: maqAsignada,
        codigoEdificio: prev?.fields.CodigoEdifcio_IN ?? "",
        nombreEdificio: prev?.fields.NombreEdificio_IN ?? "",
        idMaquinaVieja: prev?.fields.IDMaquina_IN ?? "",
      };
    }
  } else if (!cm.idMaquinaVieja) {
    // El front no manda la identidad de la unidad retirada (y los celulares con el bundle PWA
    // cacheado nunca la van a mandar) → la completamos desde 10.Incidentes. Solo en esta rama:
    // la de repuestos no paga la lectura.
    const prev = await getListItem<IncFields>(listId, String(input.id), [
      "IDMaquina_IN",
      "CodigoEdifcio_IN",
    ]);
    cm = {
      ...cm,
      idMaquinaVieja: prev?.fields.IDMaquina_IN ?? "",
      codigoEdificio: cm.codigoEdificio || (prev?.fields.CodigoEdifcio_IN ?? ""),
    };
  }

  // --- Rama Cambio de Maquina: sin repuestos; resuelve + swap de máquinas. ---
  if (cm) {
    // Una sola lectura del reloj: la hora del mail tiene que ser la misma que HoraResuelto_IN.
    const horaResuelto = nowTimeAr();
    await patchItemFields(listId, String(input.id), {
      Status_IN: "Resuelto",
      Resuelto_IN: "SI",
      NoResuelto_IN: "Cambio de Maquina",
      DescripcionResuelto_IN: input.descripcion,
      TecnicoAsignado_IN: auth.nombre,
      FechaResuelto_IN: hoy.fecha,
      HoraResuelto_IN: horaResuelto,
      // Versión del bundle con el que se resolvió (PA bt_aprobarIncidente,
      // Screen_Incidentes.pa.yaml:1499 → `VersionResuelto_IN:VarVersion`, sin condición).
      VersionResuelto_IN: APP_VERSION,
    });
    // El patch a "Resuelto" va ANTES del swap (paridad PA L1499, arriba) y NO se reordena. Lo que
    // sí hace falta es COMPENSAR: si el swap tira, el incidente quedaba cerrado sin movimiento y
    // —como el gate del botón "Resolver" es solo-front (Status_IN === "Asignado")— la acción
    // desaparecía para siempre para el técnico, sin dejar rastro salvo el log.
    const progreso: ProgresoCambioMaquina = { escribio: false };
    let swapInfo: Awaited<ReturnType<typeof ejecutarCambioMaquina>>;
    try {
      swapInfo = await ejecutarCambioMaquina(cm, progreso, input.id);
    } catch (err) {
      console.error("[incidentes] cambio de máquina falló:", {
        id: input.id,
        escribio: progreso.escribio,
        error: err instanceof Error ? err.message : err,
      });
      if (!progreso.escribio) {
        // Falló ANTES de tocar 08.DetalleMaquina / 04.Stock (típicamente resolviendo la lista o
        // leyendo las máquinas): nada quedó a medias → devolvemos el incidente a lo que escribe la
        // escritorio al asignar (Status_IN "Asignado" + Resuelto_IN "NO"; ningún estado nuevo). El
        // técnico recupera el botón y el reintento es seguro. Las columnas de resolución
        // (Descripcion/Fecha/HoraResuelto_IN) quedan escritas a propósito: no son gate de nada y
        // el reintento las pisa; borrarlas sería otro write que también puede fallar.
        try {
          await patchItemFields(listId, String(input.id), {
            Status_IN: "Asignado",
            Resuelto_IN: "NO",
          });
          return { ok: true, resuelto: false, swap: "reintentar" };
        } catch (errRevert) {
          // Ni siquiera se pudo revertir → el incidente queda cerrado igual que en "parcial":
          // el botón no vuelve, así que hay que mandar al técnico a la oficina, no a reintentar.
          console.error("[incidentes] no se pudo revertir el incidente a Asignado:", {
            id: input.id,
            error: errRevert instanceof Error ? errRevert.message : errRevert,
          });
        }
      }
      // Falló DESPUÉS de escribir: NO se revierte. Reintentar volvería a patchear las máquinas y a
      // sumar otro +1 en 04.Stock (el reingreso no es idempotente), que es exactamente el bug que
      // estamos sacando. Queda Resuelto y el front pide avisar a la oficina.
      // Sin mail: no se sabe qué se movió, y el mail afirma movimientos.
      // La foto SÍ se sube: es la evidencia de lo que el técnico hizo en el edificio, y este camino
      // —el swap a medias— es justo donde gerencia la va a necesitar para reconstruir a mano. La
      // escritorio la muestra en el detalle del incidente (api/incidentes/[id].ts → lightbox).
      // Es best-effort, no puede tirar.
      await escribirFotoBestEffort(String(input.id), input.fotoBase64);
      return { ok: true, resuelto: true, swap: "parcial" };
    }
    // Best-effort y siempre última: un fallo suyo no puede tirar abajo un swap ya hecho.
    await escribirFotoBestEffort(String(input.id), input.fotoBase64);
    // Mail propio del cambio de máquina (paridad PA L1499: el envío está al nivel superior del
    // resolve, no gateado por repuesto vs máquina). Muestra retirada → instalada; el mail genérico
    // de "Incidente Resuelto" solo mostraba la retirada. Los campos caen a `cm` porque el camino
    // de reconstrucción desde SharePoint no trae `input.nombreEdificio` / `input.concatMaquina`.
    if (input.notificar !== false) {
      await enviarMailCambioMaquina({
        id: input.id,
        edificio: input.nombreEdificio || cm.nombreEdificio || "",
        maquinaVieja: input.concatMaquina || cm.concatMaquinaVieja || "",
        maquinaNueva: cm.concatMaquinaNueva || "",
        serieVieja: swapInfo.vieja.serie,
        idVieja: swapInfo.vieja.id,
        serieNueva: swapInfo.nueva.serie,
        idNueva: swapInfo.nueva.id,
        fecha: hoy.fecha,
        hora: horaResuelto,
        tecnico: auth.nombre,
        observaciones: input.descripcion,
        // Lo que realmente se escribió del movimiento de la retirada: el mail lo dice tal cual
        // (incluido "no se movió"), en vez de afirmar siempre que volvió al depósito.
        movimiento: swapInfo.movimiento,
      });
    }
    // "ok" solo si el swap se completó de verdad. Si alguna unidad no se identificó no se movió
    // nada de ese lado, y el técnico tiene que saberlo por un canal que SIEMPRE ve: el mail depende
    // de `notificar`, de AZURE_MAIL_FROM y de que Graph no falle.
    return {
      ok: true,
      resuelto: true,
      swap: swapCompleto(swapInfo.movimiento) ? "ok" : "parcial",
    };
  }

  // --- Rama Repuestos: confirmar/editar las líneas ya asignadas. ---
  const lineas = input.lineas ?? [];
  const usados = lineas.filter((l) => Number(l.cantidad) > 0);
  const totalRep = usados.reduce((a, l) => a + (Number(l.cantidad) || 0), 0);

  // 1) Incidente → Resuelto. NoResuelto_IN define la etiqueta de repuestos del historial
  //    ("Cambio Repuesto" → "Ver Repuestos"; "Resuelto Sin Repuesto" → "Sin Repuesto").
  await patchItemFields(listId, String(input.id), {
    Status_IN: "Resuelto",
    Resuelto_IN: "SI",
    NoResuelto_IN: totalRep > 0 ? "Cambio Repuesto" : "Resuelto Sin Repuesto",
    DescripcionResuelto_IN: input.descripcion,
    TecnicoAsignado_IN: auth.nombre,
    FechaResuelto_IN: hoy.fecha,
    HoraResuelto_IN: nowTimeAr(),
    // Versión del bundle con el que se resolvió (PA bt_aprobarIncidente,
    // Screen_Incidentes.pa.yaml:1499 → `VersionResuelto_IN:VarVersion`, sin condición).
    VersionResuelto_IN: APP_VERSION,
    // Sin repuestos → "-" (no "0"): es lo que muestran el mail/detalle externos. PA escribía Sum()=0.
    CantidadRepuestos_IN: totalRep > 0 ? String(totalRep) : "-",
  });

  // 2) Ajustar cada línea (usado>0 → Pendiente; 0 → Anulado) y REINGRESAR lo no usado a 04.Stock
  //    (paridad PA L1499: los repuestos ya estaban comprometidos al asignarse; lo no usado vuelve).
  const repListId = await resolveListId(L_REP_INC);
  for (const l of lineas) {
    const usado = Number(l.cantidad) || 0;
    // Cantidad asignada actual (antes del patch) = base para calcular lo no usado.
    const cur = await getListItem<{ Cantidad_RI?: string | number }>(
      repListId,
      String(l.lineId),
      ["Cantidad_RI"],
    );
    const asignado = cur ? Number(cur.fields.Cantidad_RI ?? 0) || 0 : usado;
    await patchItemFields(repListId, String(l.lineId), {
      Cantidad_RI: String(usado),
      Status_RI: usado > 0 ? "Pendiente" : "Anulado",
    });
    const noUsado = Math.max(0, asignado - usado);
    // Tipo_ST "Repuesto": desempata contra filas de 04.Stock que comparten el nombre del ítem con
    // una máquina/segmento (la escritorio crea una fila por combinación Tipo_ST + Item_ST).
    if (noUsado > 0) await reingresarStockGeneral(l.repuesto, noUsado, "Repuesto");
  }

  // 3) Foto opcional (best-effort: las líneas y el reingreso a 04.Stock ya se escribieron).
  await escribirFotoBestEffort(String(input.id), input.fotoBase64);

  // 4) Mail "Incidente Resuelto" (best-effort, mismo helper que la resolución transaccional).
  if (input.notificar !== false && totalRep > 0) {
    await enviarMailIncidenteResuelto({
      id: input.id,
      edificio: input.nombreEdificio ?? "",
      maquina: input.concatMaquina ?? "",
      fecha: hoy.fecha,
      tecnico: auth.nombre,
      repuestos: usados.map((l) => ({ repuesto: l.repuesto, cantidad: l.cantidad })),
    });
  }

  return { ok: true, resuelto: true };
}

// Mail "Incidente Resuelto" replicando bt_guardarIncidente (Screen_Incidentes):
// To = [Checklist.MailSumar, Incidentes.MailWashinn], asunto "Incidente Resuelto En: {edificio}
// Fecha: dd/mm/yyyy", BCC = Checklist.MailSumar. Best-effort: nunca rompe la resolución/alta.
async function enviarMailIncidenteResuelto(p: {
  id: number | string;
  edificio: string;
  maquina: string;
  idMaquina?: string;
  fecha: string; // dd/mm/yyyy
  tecnico: string;
  repuestos: RepuestoUsado[];
}): Promise<void> {
  if (!mailEnabled()) return; // sin AZURE_MAIL_FROM se saltea en silencio
  try {
    const { to, bcc } = await destinatariosIncidente();
    if (!to.length) return;
    // Serie/ID de la máquina del incidente: 10.Incidentes NO guarda el N° de serie → se resuelve
    // en 08.DetalleMaquina por el concat (best-effort; si no matchea, el mail sale con "—").
    let nroSerie = "";
    let idMaquina = p.idMaquina ?? "";
    try {
      const maqListId = await resolveListId(L_MAQUINAS_DM);
      // Hint de identidad: ConcatMaquina_IN suele ser la clave de MODELO (N unidades) y sin
      // desempate el mail salía con la serie/ID de una máquina ajena.
      const dm = await findMaquinaDM(maqListId, p.maquina, {
        idMaquina: p.idMaquina,
      });
      if (dm) {
        nroSerie = dm.fields.NroSerie_DM ?? "";
        if (!idMaquina) idMaquina = dm.fields.IDMaquina_DM ?? "";
      }
    } catch {
      /* best-effort: si el lookup falla, el mail sale sin serie/ID */
    }
    await sendMail({
      to,
      subject: `Incidente Resuelto En: ${p.edificio} Fecha: ${p.fecha}`,
      html: htmlIncidenteResuelto({
        id: p.id,
        edificio: p.edificio,
        maquina: p.maquina,
        idMaquina,
        nroSerie,
        fecha: p.fecha.slice(0, 5), // dd/mm
        hora: nowTimeAr(),
        tecnico: p.tecnico,
        repuestos: p.repuestos.map((r) => ({
          repuesto: r.repuesto,
          cantidad: Number(r.cantidad) || 0,
        })),
      }),
      bcc,
    });
  } catch (err) {
    console.error(
      "[incidentes] mail resolución falló:",
      err instanceof Error ? err.message : err,
    );
  }
}

// Destinatarios del flujo de incidentes (99.ABM_Emails): To = [Checklist.MailSumar,
// Incidentes.MailWashinn], BCC = Checklist.MailSumar.
async function destinatariosIncidente(): Promise<{
  to: string[];
  bcc: string | undefined;
}> {
  const [checklist, incidentes] = await Promise.all([
    mailsPorModulo("Checklist"),
    mailsPorModulo("Incidentes"),
  ]);
  return {
    to: [checklist.sumar, incidentes.washinn].filter(Boolean),
    bcc: checklist.sumar || undefined,
  };
}

// Mail de cambio de máquina. Mismos destinatarios que la resolución, template propio y asunto
// propio ("Cambio de Maquina En: …") para que gerencia lo distinga de una resolución con repuestos.
// Best-effort: nunca rompe la resolución.
async function enviarMailCambioMaquina(p: {
  id: number | string;
  edificio: string;
  maquinaVieja: string;
  maquinaNueva: string;
  serieVieja?: string;
  idVieja?: string;
  serieNueva?: string;
  idNueva?: string;
  fecha: string; // dd/mm/yyyy
  hora: string; // HH:mm
  tecnico: string;
  observaciones?: string;
  // Opcional a propósito (ver htmlCambioMaquina): sin este dato el mail NO afirma nada del depósito.
  movimiento?: MovimientoCambioMaquina;
}): Promise<void> {
  if (!mailEnabled()) return;
  try {
    const { to, bcc } = await destinatariosIncidente();
    if (!to.length) return;
    await sendMail({
      to,
      subject: `Cambio de Maquina En: ${p.edificio} Fecha: ${p.fecha}`,
      html: htmlCambioMaquina({
        id: p.id,
        edificio: p.edificio,
        maquinaVieja: p.maquinaVieja,
        maquinaNueva: p.maquinaNueva,
        serieVieja: p.serieVieja,
        idVieja: p.idVieja,
        serieNueva: p.serieNueva,
        idNueva: p.idNueva,
        fecha: p.fecha.slice(0, 5), // dd/mm
        hora: p.hora,
        tecnico: p.tecnico,
        observaciones: p.observaciones,
        movimiento: p.movimiento,
      }),
      bcc,
    });
  } catch (err) {
    console.error(
      "[incidentes] mail cambio de máquina falló:",
      err instanceof Error ? err.message : err,
    );
  }
}

// --- Alta COMPLETA de incidente (PowerApps AdddNewIncidente) ---
//   Crea el incidente con Categoría/Estado/Acción, escribe repuestos (13), foto (12, solo si
//   Resuelto) y descuenta stock del técnico (si Resuelto + Cambio Repuesto).
export interface CrearIncidenteCompletoInput {
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  categoria: string; // Tildado | Todo Funcionando | Mecanico | Placa
  modo: ResolverModo; // Acción (cmbox_resuelto)
  descripcion: string;
  repuestos?: RepuestoUsado[];
  fotoBase64?: string;
}

export async function crearIncidenteCompleto(
  input: CrearIncidenteCompletoInput,
  auth: { usuario: string; nombre: string },
): Promise<{ id: string; resuelto: boolean }> {
  const listId = await resolveListId(L);
  const resuelto =
    input.modo === "Cambio Repuesto" || input.modo === "Resuelto Sin Repuesto";
  const repuestos = (input.repuestos ?? []).filter(
    (r) => r.repuesto && Number(r.cantidad) > 0,
  );
  const totalRep = repuestos.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);
  const hoy = arParts(new Date());
  const hora = nowTimeAr();

  // 1) Alta en 10.Incidentes.
  const fields: Record<string, unknown> = {
    Title: "sumar",
    IDMaquina_IN: input.IDMaquina_IN,
    ConcatMaquina_IN: input.ConcatMaquina_IN,
    CodigoEdifcio_IN: input.CodigoEdifcio_IN,
    NombreEdificio_IN: input.NombreEdificio_IN,
    Categoria_IN: input.categoria,
    NoResuelto_IN: input.modo,
    Status_IN: resuelto ? "Resuelto" : "Pendiente",
    Resuelto_IN: resuelto ? "SI" : "NO",
    // Sin repuestos → "-" (no "0"): es lo que muestran el mail/detalle externos. PA escribía Sum()=0.
    CantidadRepuestos_IN: totalRep > 0 ? String(totalRep) : "-",
    Fecha_IN: hoy.fecha,
    FechaMesAno_IN: hoy.mesAno,
    FechaAno_IN: hoy.ano,
    Hora_IN: hora,
    // Versión del bundle que corría el técnico al dar el ALTA (PA bt_guardarIncidente,
    // Screen_Incidentes.pa.yaml:806 → `Version_IN:VarVersion`).
    Version_IN: APP_VERSION,
    User_IN: auth.usuario,
    AppOrigen_IN: "WashinnMobile",
  };
  if (resuelto) {
    fields.DescripcionResuelto_IN = input.descripcion;
    fields.TecnicoAsignado_IN = auth.nombre;
    fields.FechaResuelto_IN = hoy.fecha;
    fields.HoraResuelto_IN = hora;
    // Solo si el alta ya nace resuelta. PA: `VersionResuelto_IN:If(...= "Resuelto",VarVersion)`
    // (Screen_Incidentes.pa.yaml:806) — un alta "Pendiente" la deja en blanco.
    fields.VersionResuelto_IN = APP_VERSION;
  } else {
    fields.Descripcion_IN = input.descripcion;
  }
  const { id } = await createItem(listId, fields);

  // 2) Repuestos, 3) Foto (solo si Resuelto), 4) descuento de stock (Resuelto + Cambio Repuesto).
  await escribirRepuestosIncidente(id, repuestos, input.modo, hoy.mesAno);
  if (resuelto) {
    // Best-effort: el incidente ya está creado; un fallo acá haría que el técnico lo cargue dos veces.
    await escribirFotoBestEffort(id, input.fotoBase64);
  }
  if (resuelto && input.modo === "Cambio Repuesto") {
    await descontarStockTecnico(repuestos);
  }

  // 5) Mail "Incidente Resuelto" (PA bt_guardarIncidente, mismo bloque que la resolución).
  if (resuelto && input.modo === "Cambio Repuesto") {
    await enviarMailIncidenteResuelto({
      id,
      edificio: input.NombreEdificio_IN,
      maquina: input.ConcatMaquina_IN,
      idMaquina: input.IDMaquina_IN,
      fecha: hoy.fecha,
      tecnico: auth.nombre,
      repuestos,
    });
  }

  return { id, resuelto };
}
