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
import { todayAr, nowTimeAr, arParts } from "./time.js";
import { sendMail, mailEnabled } from "./mail.js";
import { listEmails } from "./abm.js";
import {
  htmlIncidenteAnulado,
  htmlIncidenteResuelto,
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

  // 4) Foto (solo si Resuelto, como PowerApps).
  if (resuelto && input.fotoBase64) {
    await escribirFotoIncidente(String(input.id), input.fotoBase64);
  }

  // 5) Mail "Incidente Resuelto" (solo Resuelto + Cambio Repuesto + notificar), como PowerApps.
  if (resuelto && input.modo === "Cambio Repuesto" && input.notificar !== false) {
    await enviarMailIncidenteResuelto({
      id: input.id,
      edificio: input.nombreEdificio ?? "",
      maquina: input.concatMaquina ?? "",
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

// Reingresa `cantidad` unidades al stock general (04.Stock) para el ítem `nombre` (Item_ST = Lodge_ST).
// Si no existe la fila no hace nada (paridad PA: LookUp sin match no patchea).
async function reingresarStockGeneral(
  nombre: string,
  cantidad: number,
): Promise<void> {
  const n = Number(cantidad) || 0;
  if (!nombre || n <= 0) return;
  const listId = await resolveListId(L_STOCK_GRAL);
  const items = await getListItemsFiltered<{
    Lodge_ST?: string;
    Cantidad_ST?: string | number;
  }>(
    listId,
    ["Lodge_ST", "Cantidad_ST"],
    `fields/Lodge_ST eq '${escapeODataValue(nombre)}'`,
  );
  if (!items.length) return;
  const it = items[0];
  const actual = Number(it.fields.Cantidad_ST ?? 0) || 0;
  await patchItemFields(listId, String(it.id), {
    Cantidad_ST: String(actual + n),
  });
}

// Máquina de 08.DetalleMaquina por su Concat. PA matchea por ConcatMaquinaIncidente_DM; caemos a
// ConcatMaquina_DM por compatibilidad con incidentes creados desde la mobile.
interface MaqDMFields {
  ConcatMaquina_DM?: string;
  ConcatMaquinaIncidente_DM?: string;
  Encendido_DM?: string;
}
async function findMaquinaDM(
  maqListId: string,
  concat: string,
): Promise<ListItem<MaqDMFields> | null> {
  if (!concat) return null;
  const c = escapeODataValue(concat);
  const cols = ["ConcatMaquina_DM", "ConcatMaquinaIncidente_DM", "Encendido_DM"];
  // Primario: ConcatMaquinaIncidente_DM (el que trae la serie; es lo que guarda el incidente en
  // ConcatMaquina_IN / MaquinaAsignada_IN — validado contra datos reales). Fallback a ConcatMaquina_DM.
  const byInc = await getListItemsFiltered<MaqDMFields>(
    maqListId,
    cols,
    `fields/ConcatMaquinaIncidente_DM eq '${c}'`,
  );
  if (byInc[0]) return byInc[0];
  const byDM = await getListItemsFiltered<MaqDMFields>(
    maqListId,
    cols,
    `fields/ConcatMaquina_DM eq '${c}'`,
  );
  return byDM[0] ?? null;
}

// Swap de máquinas al resolver un "Cambio de Maquina" (paridad PA L1499):
//   nueva → INSTALADA en el edificio del incidente (hereda Encendido_DM del edificio),
//   vieja → DEPOSITO en Wash Inn (C-9999) y su unidad reingresa a 04.Stock.
async function ejecutarCambioMaquina(
  cm: ResolverAsignadoCambioMaquina,
): Promise<void> {
  const maqListId = await resolveListId(L_MAQUINAS_DM);
  const [vieja, nueva] = await Promise.all([
    findMaquinaDM(maqListId, cm.concatMaquinaVieja),
    findMaquinaDM(maqListId, cm.concatMaquinaNueva),
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
  // Nueva → INSTALADA en el edificio del incidente.
  if (nueva) {
    await patchItemFields(maqListId, String(nueva.id), {
      Status_DM: "INSTALADA",
      CodigoEdificio_DM: cm.codigoEdificio,
      Edificio_DM: cm.nombreEdificio,
      ...(encendido ? { Encendido_DM: encendido } : {}),
    });
  }
  // Vieja → DEPOSITO en Wash Inn + reingreso de su unidad al stock general.
  if (vieja) {
    await patchItemFields(maqListId, String(vieja.id), {
      Status_DM: "DEPOSITO",
      Edificio_DM: DEPOSITO_EDIFICIO,
      CodigoEdificio_DM: DEPOSITO_CODIGO,
    });
    await reingresarStockGeneral(vieja.fields.ConcatMaquina_DM ?? "", 1);
  }
}

export async function resolverAsignadoIncidente(
  input: ResolverAsignadoInput,
  auth: { nombre: string },
): Promise<{ ok: true; resuelto: true }> {
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
    ]);
    const maqAsignada = (prev?.fields.MaquinaAsignada_IN ?? "").trim();
    if (maqAsignada && prev?.fields.NoResuelto_IN !== "Requiere Repuesto") {
      cm = {
        concatMaquinaVieja: prev?.fields.ConcatMaquina_IN ?? "",
        concatMaquinaNueva: maqAsignada,
        codigoEdificio: prev?.fields.CodigoEdifcio_IN ?? "",
        nombreEdificio: prev?.fields.NombreEdificio_IN ?? "",
      };
    }
  }

  // --- Rama Cambio de Maquina: sin repuestos; resuelve + swap de máquinas. ---
  if (cm) {
    await patchItemFields(listId, String(input.id), {
      Status_IN: "Resuelto",
      Resuelto_IN: "SI",
      NoResuelto_IN: "Cambio de Maquina",
      DescripcionResuelto_IN: input.descripcion,
      TecnicoAsignado_IN: auth.nombre,
      FechaResuelto_IN: hoy.fecha,
      HoraResuelto_IN: nowTimeAr(),
    });
    await ejecutarCambioMaquina(cm);
    if (input.fotoBase64) {
      await escribirFotoIncidente(String(input.id), input.fotoBase64);
    }
    // Mail "Incidente Resuelto" también para el cambio de máquina (paridad PA L1499: el envío está
    // al nivel superior del resolve, no gateado por repuesto vs máquina). Sin repuestos → sin tabla.
    if (input.notificar !== false) {
      await enviarMailIncidenteResuelto({
        id: input.id,
        edificio: input.nombreEdificio ?? "",
        maquina: input.concatMaquina ?? "",
        fecha: hoy.fecha,
        tecnico: auth.nombre,
        repuestos: [],
      });
    }
    return { ok: true, resuelto: true };
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
    if (noUsado > 0) await reingresarStockGeneral(l.repuesto, noUsado);
  }

  // 3) Foto opcional.
  if (input.fotoBase64) {
    await escribirFotoIncidente(String(input.id), input.fotoBase64);
  }

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
  fecha: string; // dd/mm/yyyy
  tecnico: string;
  repuestos: RepuestoUsado[];
}): Promise<void> {
  if (!mailEnabled()) return; // sin AZURE_MAIL_FROM se saltea en silencio
  try {
    const [checklist, incidentes] = await Promise.all([
      mailsPorModulo("Checklist"),
      mailsPorModulo("Incidentes"),
    ]);
    const to = [checklist.sumar, incidentes.washinn].filter(Boolean);
    if (!to.length) return;
    await sendMail({
      to,
      subject: `Incidente Resuelto En: ${p.edificio} Fecha: ${p.fecha}`,
      html: htmlIncidenteResuelto({
        id: p.id,
        edificio: p.edificio,
        maquina: p.maquina,
        fecha: p.fecha.slice(0, 5), // dd/mm
        hora: nowTimeAr(),
        tecnico: p.tecnico,
        repuestos: p.repuestos.map((r) => ({
          repuesto: r.repuesto,
          cantidad: Number(r.cantidad) || 0,
        })),
      }),
      bcc: checklist.sumar || undefined,
    });
  } catch (err) {
    console.error(
      "[incidentes] mail resolución falló:",
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
    User_IN: auth.usuario,
    AppOrigen_IN: "WashinnMobile",
  };
  if (resuelto) {
    fields.DescripcionResuelto_IN = input.descripcion;
    fields.TecnicoAsignado_IN = auth.nombre;
    fields.FechaResuelto_IN = hoy.fecha;
    fields.HoraResuelto_IN = hora;
  } else {
    fields.Descripcion_IN = input.descripcion;
  }
  const { id } = await createItem(listId, fields);

  // 2) Repuestos, 3) Foto (solo si Resuelto), 4) descuento de stock (Resuelto + Cambio Repuesto).
  await escribirRepuestosIncidente(id, repuestos, input.modo, hoy.mesAno);
  if (resuelto && input.fotoBase64) {
    await escribirFotoIncidente(id, input.fotoBase64);
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
      fecha: hoy.fecha,
      tecnico: auth.nombre,
      repuestos,
    });
  }

  return { id, resuelto };
}
