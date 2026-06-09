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
import { arParts, nowTimeAr } from "./time.js";

const L_DETALLE = "16.DetallePlanificaciones";
const L_EDIF_VISITAR = "18.EdificiosVisitar";
const L_REGISTROS = "01.Registros";
const L_DETALLES = "02.Detalles";
const L_RESUMEN = "15.ResumenPlanificaciones";
const L_CHECKLIST = "ABM.Checklist";

export function mesAnoActual(): string {
  return arParts(new Date()).mesAno; // mm/yyyy
}

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

  const [evs, regs] = await Promise.all([
    getListItemsFiltered<EvFields>(evId, EV_FIELDS, evFilter),
    getListItemsFiltered<RegFields>(regId, REG_STATE_FIELDS, regFilter),
  ]);

  // Último registro por código de edificio (visitas de circuito).
  const lastByCodigo = new Map<string, ListItem<RegFields>>();
  for (const r of regs) {
    const cod = r.fields.Codigo ?? "";
    if (!cod) continue;
    const prev = lastByCodigo.get(cod);
    if (!prev || Number(r.id) > Number(prev.id)) lastByCodigo.set(cod, r);
  }

  return evs.map((it: ListItem<EvFields>) => {
    const f = it.fields;
    const codigo = f.CodigoEdificio_EV ?? "";
    const reg = lastByCodigo.get(codigo);
    const estado: EstadoEdificio = reg ? mapEstado(reg.fields.Estado ?? "") : "Pendiente";
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
    };
  });
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
    NroCircuito_R: Number(input.nroCircuito) || 0,
    NroRuta_R: input.nroRuta,
    HoraSugerida_R: input.horaSugerida ?? "",
    ObservacionEdificio_R: input.observacion ?? "",
  });

  // Roll-up de estado del circuito/ruta a "En Proceso" (best-effort).
  await Promise.allSettled([
    patchFirst(
      L_DETALLE,
      `fields/IDUnivocoCircuito_DP eq '${escapeODataValue(input.idUnivocoCircuito)}'`,
      { Status_DP: "En Proceso" },
    ),
    patchFirst(
      L_RESUMEN,
      `fields/IDUnivocoRuta_RP eq '${escapeODataValue(input.idUnivocoRuta)}'`,
      { Status_RP: "En Proceso" },
    ),
  ]);

  return { idUnico, hora, fecha };
}

// --- Cancelar visita: marca el registro como "Cancelado" (o crea uno si no se inició) ---
export async function cancelarVisita(
  input: { codigo: string; mesAno: string; motivo: string; observacion?: string },
  auth: { nombre: string; usuario: string },
  edificio?: { edificio: string; direccion: string },
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
  const patch = {
    Estado: "Cancelado",
    MotivoCancelacion_R: input.motivo,
    ObservacionCancelacion_R: input.observacion ?? "",
  };
  if (items.length) {
    // Si hubiera más de una Pendiente que matchea, cancelar la más reciente (determinista).
    items.sort((a, b) => Number(b.id) - Number(a.id));
    await patchItemFields(listId, items[0].id, patch);
    return;
  }
  // No había visita iniciada → registramos una cancelada (no se pudo acceder al edificio).
  const { fecha, mesAno } = arParts(new Date());
  await createItem(listId, {
    Title: "[sumar]",
    Codigo: input.codigo,
    Edificio: edificio?.edificio ?? "",
    Direccion: edificio?.direccion ?? "",
    Nombre: auth.usuario,
    TecnicoAsignado_R: auth.nombre,
    Fecha0: fecha,
    MesA_x00f1_o: input.mesAno || mesAno,
    HoraVisita: nowTimeAr(),
    ...patch,
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

  const { fecha, mesAno } = arParts(new Date());
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
    ...(input.fotoGeneral ? { ImagenGral: input.fotoGeneral } : {}),
  });

  // 2) Una fila por ítem en 02.Detalles (lista interna "Lista").
  const detListId = await resolveListId(L_DETALLES);
  for (const it of input.items) {
    await createItem(detListId, {
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
      FechaMes_D: mesAno,
      FechaMesAno_D: mesAno,
      Hora_D: horaSalida,
    });
  }

  return { ok: true };
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
