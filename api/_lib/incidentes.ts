// Incidentes (10.Incidentes). Ref: docs/powerapps/incidentes.md + Screen_Incidentes.pa.yaml.
// Fase 1 (core): listar (por estado, scopeado por técnico), crear (alta de técnico) y anular.
// Fase 2 (pendiente): resolver transaccional (stock/cambio de máquina), crear-ventilación, mails.
import {
  resolveListId,
  getListItemsFiltered,
  createItem,
  patchItemFields,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";
import { todayAr, nowTimeAr } from "./time.js";

const L = "10.Incidentes";

interface IncFields {
  IDMaquina_IN?: string;
  ConcatMaquina_IN?: string;
  CodigoEdifcio_IN?: string;
  NombreEdificio_IN?: string;
  TecnicoAsignado_IN?: string;
  Descripcion_IN?: string;
  DescripcionCarga_IN?: string;
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
    Categoria_IN: f.Categoria_IN ?? "",
    Fecha_IN: f.Fecha_IN ?? "",
    Status_IN: f.Status_IN ?? "",
    Resuelto_IN: f.Resuelto_IN ?? "",
  };
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

// Anular. (El mail de aviso se agrega en Fase 2 — requiere Graph Mail.Send.)
export async function anularIncidente(
  id: number,
  motivo: string,
): Promise<void> {
  const listId = await resolveListId(L);
  await patchItemFields(listId, String(id), {
    Status_IN: "Anulado",
    Resuelto_IN: "SI",
    DescripcionAnulado_IN: motivo,
  });
}
