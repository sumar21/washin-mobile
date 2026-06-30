// Módulo Visitas por rutas/circuitos. Reemplaza al checklist "viejo": el técnico recorre los
// circuitos planificados del mes y, por cada edificio a visitar, inicia la visita y completa el
// checklist. Ref: docs/powerapps/Src/Screen_Planificaciones.pa.yaml + Screen_Edificios.pa.yaml +
// ScreenCheckList.pa.yaml. Listas que toca:
//   16.DetallePlanificaciones  → circuitos del técnico (Tecnico_DP, Status_DP, MesAno_DP)
//   18.EdificiosVisitar        → edificios de cada circuito (solo lectura; nunca se escribe)
//   01.Registros               → estado real de cada visita (de acá se DERIVA el estado del edificio)
//   02.Detalles (interna "Lista") → una fila por ítem del checklist al finalizar
//   ABM.Checklist              → ítems del checklist
//   15.ResumenPlanificaciones / 16.DetallePlanificaciones → roll-up de estado a "En Proceso"
import {
  resolveListId,
  getListItems,
  getListItemsFiltered,
  createItem,
  patchItemFields,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";
import { arParts, nowTimeAr, mesNombreAr, APP_VERSION } from "./time.js";
import { sendMail, mailEnabled } from "./mail.js";
import { listEmails } from "./abm.js";
import { getEdificioContacto } from "./catalogos.js";
import { htmlMantenimiento, htmlVisitaCancelada } from "./mail-visitas.js";

const L_DETALLE = "16.DetallePlanificaciones";
const L_EDIF_VISITAR = "18.EdificiosVisitar";
const L_REGISTROS = "01.Registros";
const L_DETALLES = "02.Detalles";
const L_RESUMEN = "15.ResumenPlanificaciones";
const L_CHECKLIST = "ABM.Checklist";

export function mesAnoActual(): string {
  return arParts(new Date()).mesAno; // mm/yyyy
}

// Destinatarios configurados por módulo en 99.ABM_Emails (PA: LookUp(CollectMails, Modulo_EM=...)).
// Best-effort: si la lista no responde, devuelve vacíos (los mails son no-bloqueantes).
async function mailsPorModulo(
  modulo: string,
): Promise<{ sumar: string; washinn: string }> {
  try {
    const all = await listEmails();
    const row = all.find(
      (e) => e.Modulo.trim().toLowerCase() === modulo.trim().toLowerCase(),
    );
    return { sumar: row?.MailSumar ?? "", washinn: row?.MailWashinn ?? "" };
  } catch {
    return { sumar: "", washinn: "" };
  }
}

// Casilla de fallback de PowerApps cuando el edificio no tiene Correo cargado.
const MANTENIMIENTO_FALLBACK = "washinn@sumardigital.com.ar";
// PA agrega siempre estos dos destinatarios al mail de cancelación (además del edificio/fallback).
const CANCELACION_EXTRA = [
  "paul.risau@wash-innsystem.com.ar",
  "pablo.tecnico@wash-innsystem.com.ar",
];

// --- Circuitos del técnico (16.DetallePlanificaciones) ---
interface DpFields {
  IDUnivoco_DP?: string;
  IDUnivocoCircuito_DP?: string;
  NroRuta_DP?: number;
  NroCircuito_DP?: number;
  Circuito_DP?: number;
  CantidadEdificios_DP?: number;
  Status_DP?: string;
  Tecnico_DP?: string;
  MesAno_DP?: string;
  Mes_DP?: string;
  ObservacionCircuito_DP?: string;
}

export interface Circuito {
  ID: number;
  IDUnivoco: string;
  IDUnivocoCircuito: string;
  NroRuta: number;
  NroCircuito: number;
  Circuito: number;
  CantidadEdificios: number;
  Status: string;
  Mes: string;
  MesAno: string;
  Observacion: string;
}

const DP_FIELDS = [
  "IDUnivoco_DP",
  "IDUnivocoCircuito_DP",
  "NroRuta_DP",
  "NroCircuito_DP",
  "Circuito_DP",
  "CantidadEdificios_DP",
  "Status_DP",
  "Tecnico_DP",
  "MesAno_DP",
  "Mes_DP",
  "ObservacionCircuito_DP",
];

export async function listCircuitos(
  tecnico: string,
  mesAno: string,
): Promise<Circuito[]> {
  const listId = await resolveListId(L_DETALLE);
  const filter =
    `fields/Tecnico_DP eq '${escapeODataValue(tecnico)}'` +
    ` and (fields/Status_DP eq 'Pendiente' or fields/Status_DP eq 'En Proceso')` +
    ` and fields/MesAno_DP eq '${escapeODataValue(mesAno)}'`;
  const items = await getListItemsFiltered<DpFields>(listId, DP_FIELDS, filter);
  return items
    .map((it: ListItem<DpFields>) => {
      const f = it.fields;
      return {
        ID: Number(it.id),
        IDUnivoco: f.IDUnivoco_DP ?? "",
        IDUnivocoCircuito: f.IDUnivocoCircuito_DP ?? "",
        NroRuta: Number(f.NroRuta_DP ?? 0),
        NroCircuito: Number(f.NroCircuito_DP ?? 0),
        Circuito: Number(f.Circuito_DP ?? 0),
        CantidadEdificios: Number(f.CantidadEdificios_DP ?? 0),
        Status: f.Status_DP ?? "",
        Mes: f.Mes_DP ?? "",
        MesAno: f.MesAno_DP ?? "",
        Observacion: f.ObservacionCircuito_DP ?? "",
      };
    })
    .sort((a, b) => a.NroCircuito - b.NroCircuito);
}

// --- Edificios a visitar (18.EdificiosVisitar) + estado DERIVADO de 01.Registros ---
interface EvFields {
  CodigoEdificio_EV?: string;
  Edificio_EV?: string;
  Direccion_EV?: string;
  Estado_EV?: string;
  MesAno_EV?: string;
  NroCircuito_EV?: string;
  NroRuta_EV?: string;
  HoraSugerida_EV?: string;
  ObservacionEdificio_EV?: string;
  IDUnivocoRuta_EV?: string;
  IDUnivocoCircuito_EV?: string;
  Encargado_EV?: string;
  Celular_EV?: string;
  Mail_EV?: string;
  TecnicoAsignado_EV?: string;
  Latitud_EV?: string;
  Longitud_EV?: string;
  Latitud2_EV?: string;
  Longitud2_EV?: string;
}

interface RegFields {
  Codigo?: string;
  Estado?: string;
  IDUnico?: string;
  UnivocoCircuito_R?: string;
  Nombre?: string;
  MesA_x00f1_o?: string;
  FechaTerminada_R?: string;
}

export type EstadoEdificio =
  | "Pendiente"
  | "EnProceso"
  | "Finalizado"
  | "Cancelado";

export interface EdificioVisitar {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  NroCircuito: string;
  NroRuta: string;
  HoraSugerida: string;
  Observacion: string;
  Encargado: string;
  Celular: string;
  Mail: string;
  IDUnivocoCircuito: string;
  IDUnivocoRuta: string;
  coords: { lat: number; lng: number }[]; // puntos registrados (hasta 2) para la verificación geo
  estado: EstadoEdificio; // derivado de 01.Registros
  idUnico?: string; // si hay una visita en proceso (para continuar)
  // PA: contador "VISITAS : N" = CountRows(GalHome, Estado="Finalizado" And Codigo=... And Nombre=...).
  cantidadVisitas: number; // nº de visitas Finalizadas del técnico para este Codigo (este mes)
  ultimaVisita?: string; // FechaTerminada_R Finalizada más reciente del técnico (dd/mm/yyyy)
  // PA lbl_ultimaVisitas_EAV "Ult Visita": FechaTerminada_R del Finalizado más reciente de
  // CUALQUIER técnico para este Codigo (LookUp sin filtro de Nombre, mismo scope de mes).
  ultimaVisitaEdificio?: string;
}

const EV_FIELDS = [
  "CodigoEdificio_EV",
  "Edificio_EV",
  "Direccion_EV",
  "Estado_EV",
  "MesAno_EV",
  "NroCircuito_EV",
  "NroRuta_EV",
  "HoraSugerida_EV",
  "ObservacionEdificio_EV",
  "IDUnivocoRuta_EV",
  "IDUnivocoCircuito_EV",
  "Encargado_EV",
  "Celular_EV",
  "Mail_EV",
  "TecnicoAsignado_EV",
  "Latitud_EV",
  "Longitud_EV",
  "Latitud2_EV",
  "Longitud2_EV",
];

// Coords pueden venir como texto ("-34,60" o "-34.60"). Devuelve los pares válidos (hasta 2).
function parseCoords(
  f: Pick<EvFields, "Latitud_EV" | "Longitud_EV" | "Latitud2_EV" | "Longitud2_EV">,
): { lat: number; lng: number }[] {
  const num = (v?: string) => Number(String(v ?? "").trim().replace(",", "."));
  const pares: { lat: number; lng: number }[] = [];
  const a = { lat: num(f.Latitud_EV), lng: num(f.Longitud_EV) };
  const b = { lat: num(f.Latitud2_EV), lng: num(f.Longitud2_EV) };
  if (Number.isFinite(a.lat) && Number.isFinite(a.lng) && (a.lat !== 0 || a.lng !== 0)) pares.push(a);
  if (Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)) pares.push(b);
  return pares;
}

const REG_STATE_FIELDS = [
  "Codigo",
  "Estado",
  "IDUnico",
  "UnivocoCircuito_R",
  "Nombre",
  "MesA_x00f1_o",
  "FechaTerminada_R",
];

function mapEstado(estadoReg: string): EstadoEdificio {
  const s = estadoReg.trim().toLowerCase();
  if (s === "finalizado") return "Finalizado";
  if (s === "cancelado" || s === "anulado") return "Cancelado";
  return "EnProceso"; // "Pendiente" en 01.Registros = visita iniciada en curso
}

export async function listEdificiosAVisitar(
  tecnico: string, // Concat (18.EdificiosVisitar.TecnicoAsignado_EV)
  usuario: string, // login (01.Registros.Nombre)
  mesAno: string,
): Promise<EdificioVisitar[]> {
  const [evId, regId] = await Promise.all([
    resolveListId(L_EDIF_VISITAR),
    resolveListId(L_REGISTROS),
  ]);

  const evFilter =
    `fields/TecnicoAsignado_EV eq '${escapeODataValue(tecnico)}'` +
    ` and fields/Estado_EV eq 'Pendiente'` +
    ` and fields/MesAno_EV eq '${escapeODataValue(mesAno)}'`;
  // Registros del técnico del mes (para derivar el estado de cada edificio).
  // Ojo: 01.Registros.Nombre guarda el LOGIN, no el Concat.
  const regFilter =
    `fields/Nombre eq '${escapeODataValue(usuario)}'` +
    ` and fields/MesA_x00f1_o eq '${escapeODataValue(mesAno)}'`;
  // PA "Ult Visita": Finalizados de CUALQUIER técnico del mes (sin filtro de Nombre) para
  // derivar la última visita del edificio. Mismo scope de mes que el LookUp de GalHome.
  const finFilter =
    `fields/Estado eq 'Finalizado'` +
    ` and fields/MesA_x00f1_o eq '${escapeODataValue(mesAno)}'`;

  const [evs, regs, regsFin] = await Promise.all([
    getListItemsFiltered<EvFields>(evId, EV_FIELDS, evFilter),
    getListItemsFiltered<RegFields>(regId, REG_STATE_FIELDS, regFilter),
    getListItemsFiltered<RegFields>(regId, REG_STATE_FIELDS, finFilter),
  ]);

  // Última visita del edificio por CUALQUIER técnico: FechaTerminada_R del Finalizado más
  // reciente (mayor id) por código.
  const ultimaEdificioByCodigo = new Map<
    string,
    { ultimaId: number; ultimaFecha: string }
  >();
  for (const r of regsFin) {
    const cod = r.fields.Codigo ?? "";
    if (!cod) continue;
    const prev = ultimaEdificioByCodigo.get(cod);
    if (!prev || Number(r.id) > prev.ultimaId) {
      ultimaEdificioByCodigo.set(cod, {
        ultimaId: Number(r.id),
        ultimaFecha: r.fields.FechaTerminada_R ?? "",
      });
    }
  }

  // Último registro por código de edificio (visitas de circuito).
  const lastByCodigo = new Map<string, ListItem<RegFields>>();
  // PA "VISITAS : N": cantidad de Finalizados y la última FechaTerminada_R por código.
  const finalizadasByCodigo = new Map<
    string,
    { cantidad: number; ultimaId: number; ultimaFecha: string }
  >();
  for (const r of regs) {
    const cod = r.fields.Codigo ?? "";
    if (!cod) continue;
    const prev = lastByCodigo.get(cod);
    if (!prev || Number(r.id) > Number(prev.id)) lastByCodigo.set(cod, r);
    if ((r.fields.Estado ?? "").trim().toLowerCase() === "finalizado") {
      const acc = finalizadasByCodigo.get(cod) ?? {
        cantidad: 0,
        ultimaId: -1,
        ultimaFecha: "",
      };
      acc.cantidad += 1;
      // La "última visita" = la del registro Finalizado más reciente (mayor id).
      if (Number(r.id) > acc.ultimaId) {
        acc.ultimaId = Number(r.id);
        acc.ultimaFecha = r.fields.FechaTerminada_R ?? "";
      }
      finalizadasByCodigo.set(cod, acc);
    }
  }

  return evs.map((it: ListItem<EvFields>) => {
    const f = it.fields;
    const codigo = f.CodigoEdificio_EV ?? "";
    const reg = lastByCodigo.get(codigo);
    const estado: EstadoEdificio = reg ? mapEstado(reg.fields.Estado ?? "") : "Pendiente";
    const fin = finalizadasByCodigo.get(codigo);
    return {
      ID: Number(it.id),
      Codigo: codigo,
      Edificio: f.Edificio_EV ?? "",
      Direccion: f.Direccion_EV ?? "",
      NroCircuito: f.NroCircuito_EV ?? "",
      NroRuta: f.NroRuta_EV ?? "",
      HoraSugerida: f.HoraSugerida_EV ?? "",
      Observacion: f.ObservacionEdificio_EV ?? "",
      Encargado: f.Encargado_EV ?? "",
      Celular: f.Celular_EV ?? "",
      Mail: f.Mail_EV ?? "",
      IDUnivocoCircuito: f.IDUnivocoCircuito_EV ?? "",
      IDUnivocoRuta: f.IDUnivocoRuta_EV ?? "",
      coords: parseCoords(f),
      estado,
      idUnico: estado === "EnProceso" ? reg?.fields.IDUnico : undefined,
      cantidadVisitas: fin?.cantidad ?? 0,
      ultimaVisita: fin?.ultimaFecha || undefined,
      ultimaVisitaEdificio:
        ultimaEdificioByCodigo.get(codigo)?.ultimaFecha || undefined,
    };
  });
}

// --- Detalle de un registro/checklist confirmado (01.Registros + sus 02.Detalles) ---
// Ref: pantalla ScreenRegistroDetalle (/registros/:idUnico). Devuelve la cabecera del registro
// (estado, % completitud, obs general, horas, edificio, fecha) + un ítem por fila de 02.Detalles.
// Scope: el técnico solo ve SUS registros (01.Registros.Nombre = su login). Admin/Supervisor ven todo.
interface RegDetalleFields {
  Codigo?: string;
  Edificio?: string;
  Direccion?: string;
  Estado?: string;
  Nombre?: string;
  IDUnico?: string;
  Fecha0?: string; // display "Fecha" (dd/mm/yyyy)
  MesA_x00f1_o?: string;
  Ok?: number;
  Check?: number;
  Hora?: string; // display "HoraInicio"
  Fecha?: string; // display "HoraFinal"
  HoraVisita?: string;
  HoraSalida?: string;
  FechaTerminada_R?: string;
  ObservacionFinal?: string; // display "ObservacionGeneral"
  TecnicoAsignado_R?: string;
}

// Una fila de 02.Detalles (un ítem del checklist confirmado).
interface DetalleItemFields {
  IDUnico?: string;
  Item?: string;
  Check?: string; // "Ok" | "No" (estado del ítem)
  ObservacionUnica?: string; // display "ObservacionItem"
  Status_D?: string;
}

export interface RegistroDetalleItem {
  ID: number;
  Item: string;
  Check: "Ok" | "No" | "";
  ObservacionItem: string;
  // 02.Detalles NO almacena foto por ítem (la foto del checklist es la general del registro,
  // ImagenGral en 01.Registros). Se incluye el campo por contrato del front; siempre vacío.
  foto?: string;
}

export interface RegistroDetalle {
  ID: number;
  IDUnico: string;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Estado: string;
  Nombre: string;
  Tecnico: string;
  Fecha: string; // Fecha0 (dd/mm/yyyy)
  MesAno: string;
  HoraInicio: string; // Hora (display HoraInicio)
  HoraFinal: string; // Fecha (display HoraFinal)
  HoraVisita: string;
  HoraSalida: string;
  FechaTerminada: string;
  ObservacionGeneral: string;
  okCount: number;
  noCount: number;
  // % completitud, igual que el Home (lbl_porcRV de PA): finalizado con 0 "No" = 100%.
  completitud?: number;
  items: RegistroDetalleItem[];
}

const REG_DETALLE_FIELDS = [
  "Codigo",
  "Edificio",
  "Direccion",
  "Estado",
  "Nombre",
  "IDUnico",
  "Fecha0",
  "MesA_x00f1_o",
  "Ok",
  "Check",
  "Hora",
  "Fecha",
  "HoraVisita",
  "HoraSalida",
  "FechaTerminada_R",
  "ObservacionFinal",
  "TecnicoAsignado_R",
];

const DETALLE_ITEM_FIELDS = [
  "IDUnico",
  "Item",
  "Check",
  "ObservacionUnica",
  "Status_D",
];

function normCheck(v: string): "Ok" | "No" | "" {
  const s = v.trim().toLowerCase();
  if (s === "ok" || s === "si" || s === "sí") return "Ok";
  if (s === "no") return "No";
  return "";
}

export async function getRegistroDetalle(
  idUnico: string,
  auth: { rol: string; usuario: string },
): Promise<RegistroDetalle | null> {
  const [regId, detId] = await Promise.all([
    resolveListId(L_REGISTROS),
    resolveListId(L_DETALLES),
  ]);

  const idEsc = escapeODataValue(idUnico);
  const regs = await getListItemsFiltered<RegDetalleFields>(
    regId,
    REG_DETALLE_FIELDS,
    `fields/IDUnico eq '${idEsc}'`,
  );
  if (!regs.length) return null;
  // Puede haber más de una fila con el mismo IDUnico (raro); tomamos la más reciente.
  regs.sort((a, b) => Number(b.id) - Number(a.id));
  const reg = regs[0];
  const f = reg.fields;

  // Scope técnico: solo sus registros (01.Registros.Nombre guarda el LOGIN).
  if (auth.rol === "Tecnico" && (f.Nombre ?? "") !== auth.usuario) return null;

  const dets = await getListItemsFiltered<DetalleItemFields>(
    detId,
    DETALLE_ITEM_FIELDS,
    `fields/IDUnico eq '${idEsc}'`,
  );

  const ok = Number(f.Ok ?? 0);
  const check = Number(f.Check ?? 0);
  const total = ok + check;
  const finalizado = (f.Estado ?? "").trim().toLowerCase() === "finalizado";
  const completitud = finalizado
    ? check === 0
      ? 100
      : Math.floor((ok / total) * 100)
    : undefined;

  const items: RegistroDetalleItem[] = dets
    .filter((it) => (it.fields.Status_D ?? "").trim().toLowerCase() !== "eliminado")
    .map((it) => ({
      ID: Number(it.id),
      Item: it.fields.Item ?? "",
      Check: normCheck(it.fields.Check ?? ""),
      ObservacionItem: it.fields.ObservacionUnica ?? "",
      foto: undefined, // 02.Detalles no guarda foto por ítem (ver RegistroDetalleItem)
    }))
    .sort((a, b) => a.ID - b.ID);

  return {
    ID: Number(reg.id),
    IDUnico: f.IDUnico ?? idUnico,
    Codigo: f.Codigo ?? "",
    Edificio: f.Edificio ?? "",
    Direccion: f.Direccion ?? "",
    Estado: f.Estado ?? "",
    Nombre: f.Nombre ?? "",
    Tecnico: f.TecnicoAsignado_R ?? "",
    Fecha: f.Fecha0 ?? "",
    MesAno: f.MesA_x00f1_o ?? "",
    HoraInicio: f.Hora ?? "",
    HoraFinal: f.Fecha ?? "",
    HoraVisita: f.HoraVisita ?? "",
    HoraSalida: f.HoraSalida ?? "",
    FechaTerminada: f.FechaTerminada_R ?? "",
    ObservacionGeneral: f.ObservacionFinal ?? "",
    okCount: ok,
    noCount: check,
    completitud,
    items,
  };
}

// --- Visita en curso: la 01.Registros "Pendiente" del técnico (si hay) ---
export interface VisitaEnCurso {
  idUnico: string;
  codigo: string;
  edificio: string;
  direccion: string;
  espontanea: boolean; // sin circuito (UnivocoCircuito_R vacío)
}

// Regla migrada de PowerApps: un técnico solo puede tener UNA visita "Pendiente" a la vez.
// Se usa para bloquear el inicio de otra visita y para ofrecer "continuar".
export async function visitaEnCurso(
  usuario: string, // 01.Registros.Nombre guarda el LOGIN, no el Concat (ver scripts/_diag-encurso)
  mesAno: string,
): Promise<VisitaEnCurso | null> {
  const listId = await resolveListId(L_REGISTROS);
  const filter =
    `fields/Nombre eq '${escapeODataValue(usuario)}'` +
    ` and fields/Estado eq 'Pendiente'` +
    ` and fields/MesA_x00f1_o eq '${escapeODataValue(mesAno)}'`;
  const items = await getListItemsFiltered<
    RegFields & { Edificio?: string; Direccion?: string }
  >(
    listId,
    ["Codigo", "IDUnico", "UnivocoCircuito_R", "Edificio", "Direccion"],
    filter,
  );
  if (!items.length) return null;
  items.sort((a, b) => Number(b.id) - Number(a.id)); // el más reciente
  const f = items[0].fields;
  return {
    idUnico: f.IDUnico ?? "",
    codigo: f.Codigo ?? "",
    edificio: f.Edificio ?? "",
    direccion: f.Direccion ?? "",
    espontanea: !(f.UnivocoCircuito_R ?? "").trim(),
  };
}

// --- Iniciar visita: crea el registro 01.Registros (Estado "Pendiente" = en curso) ---
export interface IniciarVisitaInput {
  codigo: string;
  edificio: string;
  direccion: string;
  idUnivocoCircuito: string;
  idUnivocoRuta: string;
  nroCircuito: string;
  nroRuta: string;
  horaSugerida?: string;
  observacion?: string;
}

function genIdUnico(codigo: string, nombre: string): string {
  const { fecha } = arParts(new Date()); // dd/mm/yyyy
  const u3 = nombre.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "USR";
  const hhmm = nowTimeAr().replace(":", "");
  return `${codigo}/${u3}/${fecha.replace(/\//g, "")}${hhmm}${String(Date.now()).slice(-4)}`;
}

export async function iniciarVisita(
  input: IniciarVisitaInput,
  auth: { nombre: string; usuario: string },
): Promise<{ idUnico: string; hora: string; fecha: string }> {
  const listId = await resolveListId(L_REGISTROS);
  const { fecha, mesAno } = arParts(new Date());
  const hora = nowTimeAr();
  // 01.Registros.Nombre y el prefijo del IDUnico usan el LOGIN (paridad PowerApps).
  const idUnico = genIdUnico(input.codigo, auth.usuario);

  await createItem(listId, {
    Title: "[sumar]",
    Edificio: input.edificio,
    Direccion: input.direccion,
    Codigo: input.codigo,
    IDUnico: idUnico,
    Nombre: auth.usuario,
    TecnicoAsignado_R: auth.nombre,
    HoraVisita: hora,
    Fecha0: fecha, // display "Fecha"
    MesA_x00f1_o: mesAno, // display "MesAño"
    Estado: "Pendiente",
    UnivocoCircuito_R: input.idUnivocoCircuito,
    NroCircuito_R: Number(input.nroCircuito) || 0, // columna Número
    // NroRuta_R es columna TEXTO en SharePoint (ver docs/sharepoint-schema.md): mandarle un número
    // dispara "Graph 500 generalException" al crear el registro. Se envía como string ("0" en la
    // espontánea, donde input.nroRuta llega vacío).
    NroRuta_R: String(Number(input.nroRuta) || 0),
    HoraSugerida_R: input.horaSugerida ?? "",
    ObservacionEdificio_R: input.observacion ?? "",
    VersionApp_R: APP_VERSION,
  });

  // Roll-up de estado del circuito/ruta a "En Proceso" (best-effort).
  // En la visita ESPONTÁNEA no hay circuito ni ruta: los IDUnivoco vienen vacíos. Un filtro
  // `eq ''` puede no matchear nada o disparar un error en listas grandes → se saltea por completo
  // (no hay nada que escalar). allSettled garantiza además que un fallo del roll-up nunca
  // rompa el inicio de la visita (la creación del registro ya está hecha).
  const rollUps: Promise<void>[] = [];
  if (input.idUnivocoCircuito.trim()) {
    rollUps.push(
      patchFirst(
        L_DETALLE,
        `fields/IDUnivocoCircuito_DP eq '${escapeODataValue(input.idUnivocoCircuito)}'`,
        { Status_DP: "En Proceso" },
      ),
    );
  }
  if (input.idUnivocoRuta.trim()) {
    rollUps.push(
      patchFirst(
        L_RESUMEN,
        `fields/IDUnivocoRuta_RP eq '${escapeODataValue(input.idUnivocoRuta)}'`,
        { Status_RP: "En Proceso" },
      ),
    );
  }
  if (rollUps.length) await Promise.allSettled(rollUps);

  return { idUnico, hora, fecha };
}

// --- Cancelar visita: marca el registro "Pendiente" como "Cancelado" ---
// Alineado a PA (bt_aceptarCancelar_CV): Patch(LookUp(... Estado="Pendiente" ...)). Si el LookUp es
// Blank (no hay visita en curso que matchee técnico+código+mes), PA NO hace nada → acá tampoco
// creamos un registro nuevo. Tras el patch, envía el mail de "Visita | Cancelada" (best-effort).
export async function cancelarVisita(
  input: { codigo: string; mesAno: string; motivo: string; observacion?: string },
  auth: { nombre: string; usuario: string },
  _edificio?: { edificio: string; direccion: string },
): Promise<void> {
  const listId = await resolveListId(L_REGISTROS);
  const filter =
    `fields/Estado eq 'Pendiente'` +
    ` and fields/Nombre eq '${escapeODataValue(auth.usuario)}'` +
    ` and fields/Codigo eq '${escapeODataValue(input.codigo)}'` +
    ` and fields/MesA_x00f1_o eq '${escapeODataValue(input.mesAno)}'`;
  const items = await getListItemsFiltered<{ id: string }>(
    listId,
    ["Codigo"],
    filter,
  );
  // PA: si no hay un "Pendiente" que matchee, el LookUp es Blank y el Patch no hace nada.
  if (!items.length) return;

  // Si hubiera más de una Pendiente que matchea, cancelar la más reciente (determinista).
  items.sort((a, b) => Number(b.id) - Number(a.id));
  await patchItemFields(listId, items[0].id, {
    Estado: "Cancelado",
    MotivoCancelacion_R: input.motivo,
    ObservacionCancelacion_R: input.observacion ?? "",
  });

  // Mail "Visita | Cancelada" (PA bt_aceptarCancelar_CV). Best-effort: nunca rompe la cancelación.
  await enviarMailCancelacion(input.codigo, input.motivo).catch((err) =>
    console.error(
      "[planificaciones] mail cancelación falló:",
      err instanceof Error ? err.message : err,
    ),
  );
}

// Replica el bloque Office365Outlook.SendEmailV2 de bt_aceptarCancelar_CV (Screen_Edificios):
// To = Correo del edificio (o washinn@sumardigital.com.ar si no tiene) + paul.risau + pablo.tecnico,
// asunto "Visita | Cancelada Fecha: dd/mm/yyyy", BCC = MailSumar del módulo "Checklist".
async function enviarMailCancelacion(
  codigo: string,
  motivo: string,
): Promise<void> {
  if (!mailEnabled()) return; // sin AZURE_MAIL_FROM se saltea en silencio
  const { fecha } = arParts(new Date());
  const hora = nowTimeAr();
  const [edif, checklist] = await Promise.all([
    getEdificioContacto(codigo),
    mailsPorModulo("Checklist"),
  ]);
  const correoEdificio = edif?.correo || MANTENIMIENTO_FALLBACK;
  const to = [correoEdificio, ...CANCELACION_EXTRA];
  await sendMail({
    to,
    subject: `Visita | Cancelada Fecha: ${fecha}`,
    html: htmlVisitaCancelada({
      fecha,
      hora,
      direccion: edif?.direccion,
      motivo,
    }),
    bcc: checklist.sumar || undefined,
  });
}

// --- Ítems del checklist (ABM.Checklist) ---
export interface ChecklistItem {
  ID: number;
  Descripcion: string; // campo Check de ABM.Checklist
}

export async function listChecklistItems(): Promise<ChecklistItem[]> {
  const listId = await resolveListId(L_CHECKLIST);
  const items = await getListItems<{ Check?: string }>(listId, ["Check"]);
  return items
    .map((it) => ({ ID: Number(it.id), Descripcion: it.fields.Check ?? "" }))
    .filter((i) => i.Descripcion)
    .sort((a, b) => a.ID - b.ID);
}

// --- Finalizar visita (guardado del checklist): patch 01.Registros + filas en 02.Detalles ---
export interface ItemResuelto {
  item: string; // texto del ítem (Check)
  check: "Ok" | "No";
  observacion?: string;
}

export interface FinalizarVisitaInput {
  idUnico: string;
  items: ItemResuelto[];
  okCount: number;
  noCount: number;
  horaInicio?: string;
  horaFinal?: string;
  observacionGeneral?: string;
  fotoGeneral?: string;
}

export async function finalizarVisita(
  input: FinalizarVisitaInput,
): Promise<{ ok: true }> {
  const regListId = await resolveListId(L_REGISTROS);
  // Buscar el registro por IDUnico (para su id + datos de edificio).
  const regs = await getListItemsFiltered<{
    Codigo?: string;
    Edificio?: string;
    Nombre?: string;
  }>(
    regListId,
    ["Codigo", "Edificio", "Nombre"],
    `fields/IDUnico eq '${escapeODataValue(input.idUnico)}'`,
  );
  if (!regs.length) throw new Error("Registro de visita no encontrado");
  const reg = regs[0];
  const codigo = reg.fields.Codigo ?? "";
  const edificio = reg.fields.Edificio ?? "";
  const nombre = reg.fields.Nombre ?? "";

  const hoy = new Date();
  const { fecha, mesAno } = arParts(hoy);
  const mesNombre = mesNombreAr(hoy); // PA: FechaMes_D = Text(Today(),"mmmm") → nombre del mes
  const horaSalida = nowTimeAr();

  // 1) Patch del registro → Finalizado (ojo nombres internos legacy: Hora=HoraInicio, Fecha=HoraFinal).
  await patchItemFields(regListId, reg.id, {
    Estado: "Finalizado",
    Hora: input.horaInicio ?? "", // display HoraInicio
    Fecha: input.horaFinal ?? horaSalida, // display HoraFinal
    HoraSalida: horaSalida,
    Ok: Number(input.okCount) || 0,
    Check: Number(input.noCount) || 0,
    FechaTerminada_R: fecha,
    ObservacionFinal: input.observacionGeneral ?? "", // display ObservacionGeneral
    // PA escribe VersionApp_R SOLO al iniciar la visita (no en el Patch de finalizado),
    // así que acá NO se reescribe. La Version_D de 02.Detalles sí se escribe (abajo).
    ...(input.fotoGeneral ? { ImagenGral: input.fotoGeneral } : {}),
  });

  // 2) Una fila por ítem en 02.Detalles (lista interna "Lista"). Best-effort por ítem: si una
  // fila falla (p. ej. un campo inesperado), se registra y se sigue con el resto en vez de tirar
  // un 502 que invalide TODO el guardado (el registro ya quedó Finalizado en el paso 1).
  const detListId = await resolveListId(L_DETALLES);
  const detResults = await Promise.allSettled(
    input.items.map((it) =>
      createItem(detListId, {
        Title: "[Sumar]",
        IDUnico: input.idUnico,
        Edificio: codigo,
        NombreEdificio_D: edificio,
        Nombre: nombre,
        Item: it.item,
        Check: it.check,
        ObservacionUnica: it.observacion ?? "", // display ObservacionItem
        Status_D: "Activo",
        Fecha_D: fecha,
        FechaMes_D: mesNombre, // PA: nombre del mes (no "mm/yyyy")
        FechaMesAno_D: mesAno,
        Hora_D: horaSalida,
        Version_D: APP_VERSION,
      }),
    ),
  );
  for (const r of detResults) {
    if (r.status === "rejected") {
      console.error(
        "[planificaciones] detalle de checklist falló:",
        r.reason instanceof Error ? r.reason.message : r.reason,
      );
    }
  }

  // 3) Mail "Mantenimiento" (PA btRegistrar.OnSelect). Best-effort: nunca rompe el guardado.
  await enviarMailMantenimiento(codigo, edificio, fecha, horaSalida).catch((err) =>
    console.error(
      "[planificaciones] mail mantenimiento falló:",
      err instanceof Error ? err.message : err,
    ),
  );

  return { ok: true };
}

// Replica el bloque Office365Outlook.SendEmailV2 de btRegistrar (ScreenCheckList):
// To = Correo del edificio (o washinn@sumardigital.com.ar si no tiene), asunto
// "Mantenimiento en {edificio} Fecha: dd/mm/yyyy", BCC = MailSumar del módulo "Checklist".
async function enviarMailMantenimiento(
  codigo: string,
  edificioReg: string,
  fecha: string,
  hora: string,
): Promise<void> {
  if (!mailEnabled()) return; // sin AZURE_MAIL_FROM se saltea en silencio
  const [edif, checklist] = await Promise.all([
    getEdificioContacto(codigo),
    mailsPorModulo("Checklist"),
  ]);
  const nombreEdificio = edif?.edificio || edificioReg;
  const to = edif?.correo || MANTENIMIENTO_FALLBACK;
  await sendMail({
    to,
    subject: `Mantenimiento en ${nombreEdificio} Fecha: ${fecha}`,
    html: htmlMantenimiento({
      edificio: nombreEdificio,
      direccion: edif?.direccion,
      fecha,
      hora,
    }),
    bcc: checklist.sumar || undefined,
  });
}

// Helper: patchea el primer ítem que matchea un filtro (para roll-up de estado).
async function patchFirst(
  listDisplayName: string,
  filter: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const listId = await resolveListId(listDisplayName);
  const items = await getListItemsFiltered<{ id: string }>(
    listId,
    ["Title"],
    filter,
  );
  if (items.length) await patchItemFields(listId, items[0].id, fields);
}
