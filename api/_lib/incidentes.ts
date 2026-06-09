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

// Destinatario fijo del mail de anulación (igual que PowerApps).
const ANULAR_TO = "paul.risau@wash-innsystem.com.ar";

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
];

function mapIncidente(it: ListItem<IncFields>): Incidente {
  const f = it.fields;
  return {
    ID: Number(it.id),
    IDIncidente: Number(it.id),
    IDMaquina_IN: f.IDMaquina_IN ?? "",
    ConcatMaquina_IN: f.ConcatMaquina_IN ?? "",
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
    const ok =
      inc.TecnicoAsignado_IN === auth.usuario ||
      inc.TecnicoAsignado_IN === auth.nombre;
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
}: {
  rol: string;
  usuario: string;
  nombre: string;
  resuelto?: "SI" | "NO";
}): Promise<Incidente[]> {
  const listId = await resolveListId(L);
  let filter = `fields/Resuelto_IN eq '${resuelto}'`;
  if (rol === "Tecnico") {
    const u = escapeODataValue(usuario);
    const n = escapeODataValue(nombre);
    filter += ` and (fields/TecnicoAsignado_IN eq '${u}' or fields/TecnicoAsignado_IN eq '${n}')`;
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
    TecnicoAsignado_IN: input.TecnicoAsignado_IN,
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

// Anular: patch + mail "Buen día Paul…" (To fijo + Bcc desde 99.ABM_Emails), como PowerApps.
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
      const bcc = (await mailsPorModulo("Incidentes")).sumar;
      await sendMail({
        to: ANULAR_TO,
        subject: `Incidente N: ${id} Anulado`,
        html: htmlIncidenteAnulado({
          tecnico: prev?.fields.TecnicoAsignado_IN ?? "",
          id,
          observaciones: motivo,
        }),
        bcc: bcc || undefined,
      });
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
    CantidadRepuestos_IN: String(totalRep),
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
  if (
    resuelto &&
    input.modo === "Cambio Repuesto" &&
    input.notificar !== false &&
    mailEnabled()
  ) {
    try {
      const [checklist, incidentes] = await Promise.all([
        mailsPorModulo("Checklist"),
        mailsPorModulo("Incidentes"),
      ]);
      const to = [checklist.sumar, incidentes.washinn].filter(Boolean);
      if (to.length) {
        await sendMail({
          to,
          subject: `Incidente Resuelto En: ${input.nombreEdificio ?? ""} Fecha: ${hoy.fecha}`,
          html: htmlIncidenteResuelto({
            id: input.id,
            edificio: input.nombreEdificio ?? "",
            maquina: input.concatMaquina ?? "",
            fecha: hoy.fecha.slice(0, 5), // dd/mm
            hora: nowTimeAr(),
            tecnico: auth.nombre,
            repuestos: repuestos.map((r) => ({
              repuesto: r.repuesto,
              cantidad: Number(r.cantidad) || 0,
            })),
          }),
          bcc: checklist.sumar || undefined,
        });
      }
    } catch (err) {
      console.error(
        "[incidentes] mail resolución falló:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { ok: true, resuelto };
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
    CantidadRepuestos_IN: String(totalRep),
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

  return { id, resuelto };
}
