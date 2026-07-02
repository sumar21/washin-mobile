// Detalle de Máquina (08.DetalleMaquina) + su "historial", que en PowerApps son los
// INCIDENTES de la máquina (10.Incidentes filtrado por IDMaquina_IN), y los repuestos
// de cada incidente (13.RepuestosIncidentes). Ref: docs/powerapps/Src/Screen_HM.pa.yaml
//   ClearCollect(CollectHistorialMaquina, Filter('10.Incidentes', IDMaquina_IN = ThisItem.IDMaquina_DM))
//   ClearCollect(CollectRepuestosIncidente, Filter('13.RepuestosIncidentes', IDIncidente_RI = Text(ThisItem.ID)))
import {
  resolveListId,
  getListItemsFiltered,
  getListItems,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";

const L_MAQUINAS = "08.DetalleMaquina";
const L_INCIDENTES = "10.Incidentes";
const L_REP_INCIDENTES = "13.RepuestosIncidentes";

// --- Máquinas (08.DetalleMaquina) ---
interface MaquinaFields {
  IDMaquina_DM?: string;
  ConcatMaquina_DM?: string;
  Marca_DM?: string;
  Modelo_DM?: string;
  NroSerie_DM?: string;
  Encendido_DM?: string;
  Edificio_DM?: string;
  CodigoEdificio_DM?: string;
  FechaIngreso_DM?: string;
  Segmentp_DM?: string; // ojo: el nombre interno tiene typo ("Segmentp"), display es Segmento_DM
  Status_DM?: string;
}

export interface DetalleMaquina {
  ID: number;
  IDMaquina_DM: string;
  ConcatMaquina_DM: string;
  Marca_DM: string;
  Modelo_DM: string;
  NroSerie_DM: string;
  IDExterno_DM: number; // 08.DetalleMaquina no tiene esta columna → usamos el id del ítem
  Encendido_DM: string;
  Edificio_DM: string;
  CodigoEdificio_DM: string;
  FechaIngreso_DM: string;
  Segmento_DM: string;
}

const MAQUINA_FIELDS = [
  "IDMaquina_DM",
  "ConcatMaquina_DM",
  "Marca_DM",
  "Modelo_DM",
  "NroSerie_DM",
  "Encendido_DM",
  "Edificio_DM",
  "CodigoEdificio_DM",
  "FechaIngreso_DM",
  "Segmentp_DM",
  "Status_DM",
];

// Filtro opcional por edificio/modelo/marca, combinados con AND (cada campo opcional),
// igual que el popup "Seleccionar edificio" de PowerApps (Screen_DetalleMaquina, Aplicar):
//   Filter('08.DetalleMaquina',
//     (IsBlank(edificio) || Edificio_DM = edificio) && (IsBlank(modelo) || Modelo_DM = modelo)
//     && (IsBlank(marca) || Marca_DM = marca))
// Excluye las ELIMINADA (Status_DM <> "ELIMINADA").
export async function listDetalleMaquina(opts?: {
  edificio?: string;
  modelo?: string;
  marca?: string;
}): Promise<DetalleMaquina[]> {
  const listId = await resolveListId(L_MAQUINAS);
  // Filtramos por edificio/modelo/marca en OData (columnas selectivas) y excluimos ELIMINADA en
  // memoria: el operador `ne` no es indexable y fuerza full scan. Ver docs/sharepoint-indexing.md.
  const clauses: string[] = [];
  if (opts?.edificio)
    clauses.push(`fields/Edificio_DM eq '${escapeODataValue(opts.edificio)}'`);
  if (opts?.modelo)
    clauses.push(`fields/Modelo_DM eq '${escapeODataValue(opts.modelo)}'`);
  if (opts?.marca)
    clauses.push(`fields/Marca_DM eq '${escapeODataValue(opts.marca)}'`);
  const items = clauses.length
    ? await getListItemsFiltered<MaquinaFields>(
        listId,
        MAQUINA_FIELDS,
        clauses.join(" and "),
      )
    : await getListItems<MaquinaFields>(listId, MAQUINA_FIELDS);
  return items
    .filter(
      (it) => (it.fields.Status_DM ?? "").trim().toUpperCase() !== "ELIMINADA",
    )
    .map((it: ListItem<MaquinaFields>) => {
    const f = it.fields;
    return {
      ID: Number(it.id),
      IDMaquina_DM: f.IDMaquina_DM ?? "",
      ConcatMaquina_DM: f.ConcatMaquina_DM ?? "",
      Marca_DM: f.Marca_DM ?? "",
      Modelo_DM: f.Modelo_DM ?? "",
      NroSerie_DM: f.NroSerie_DM ?? "",
      IDExterno_DM: Number(it.id),
      Encendido_DM: f.Encendido_DM ?? "",
      Edificio_DM: f.Edificio_DM ?? "",
      CodigoEdificio_DM: f.CodigoEdificio_DM ?? "",
      FechaIngreso_DM: f.FechaIngreso_DM ?? "",
      Segmento_DM: f.Segmentp_DM ?? "",
    };
  });
}

// --- Historial = incidentes de la máquina (10.Incidentes) ---
interface IncFields {
  IDMaquina_IN?: string;
  CodigoEdifcio_IN?: string; // (sic) nombre interno con typo en SharePoint
  NombreEdificio_IN?: string;
  TecnicoAsignado_IN?: string;
  Fecha_IN?: string;
  Status_IN?: string;
  NoResuelto_IN?: string;
  MaquinaAsignada_IN?: string;
  Descripcion_IN?: string;
  DescripcionResuelto_IN?: string;
  DescripcionCarga_IN?: string;
}

export interface HistorialIncidente {
  ID: number;
  Edificio: string;
  Tecnico: string;
  Fecha: string;
  Status: string;
  Descripcion: string; // descripción del incidente (subtítulo / "evento")
  Repuestos: string; // etiqueta de estado de repuestos (ver repuestoLabel)
  Observacion: string;
}

const INC_FIELDS = [
  "IDMaquina_IN",
  "CodigoEdifcio_IN",
  "NombreEdificio_IN",
  "TecnicoAsignado_IN",
  "Fecha_IN",
  "Status_IN",
  "NoResuelto_IN",
  "MaquinaAsignada_IN",
  "Descripcion_IN",
  "DescripcionResuelto_IN",
  "DescripcionCarga_IN",
];

// Observación del evento, replicando el If de 3 ramas de bt_verDetalleHM (Screen_HM.pa.yaml):
//   Resuelto                                   -> DescripcionResuelto_IN
//   A Revisar (alta del técnico)               -> DescripcionCarga_IN
//   resto (Pendiente/Asignado/Aprobada/En Aprobacion) -> Descripcion_IN
// Antes el backend caía a Descripcion_IN para "A Revisar", que está en blanco en esos incidentes.
function observacionEvento(f: IncFields): string {
  const st = (f.Status_IN ?? "").trim();
  if (st === "Resuelto") return f.DescripcionResuelto_IN ?? "";
  if (st === "A Revisar") return f.DescripcionCarga_IN ?? "";
  return f.Descripcion_IN ?? "";
}

// Etiqueta de repuestos, replicando txt_repuestoHM de Screen_HM.pa.yaml.
function repuestoLabel(f: IncFields): string {
  const st = (f.Status_IN ?? "").trim();
  if (st === "Anulado") return "No especificado";
  if (st === "A Revisar") return "Pendiente de Revision";
  if ((f.NoResuelto_IN ?? "") === "Cambio de Maquina") {
    return f.MaquinaAsignada_IN || "No Se Asigno Maquina";
  }
  if ((f.NoResuelto_IN ?? "") === "Resuelto Sin Repuesto")
    return "Sin Repuesto";
  return "Ver Repuestos";
}

// idMaquina (IDMaquina_IN) NO es único: la misma numeración se repite entre segmentos (lavadoras,
// encendedoras) y edificios. Para no mezclar historiales acotamos por edificio cuando se conoce.
// El filtro OData sigue por IDMaquina_IN (indexado); el edificio se aplica en memoria dejando pasar
// los incidentes sin CodigoEdifcio_IN (datos viejos) para no ocultarlos. Ver docs/incidentes-por-maquina.md.
export async function listHistorialMaquina(
  idMaquina: string,
  codigoEdificio?: string,
): Promise<HistorialIncidente[]> {
  const listId = await resolveListId(L_INCIDENTES);
  const filter = `fields/IDMaquina_IN eq '${escapeODataValue(idMaquina)}'`;
  const items = await getListItemsFiltered<IncFields>(
    listId,
    INC_FIELDS,
    filter,
  );
  // Comparación normalizada (trim + case-insensitive): el código puede venir con espacios o
  // distinta capitalización según qué app cargó el incidente vs la máquina; un `===` crudo
  // ocultaría incidentes válidos.
  const wanted = codigoEdificio?.trim().toUpperCase();
  return items
    .filter((it) => {
      if (!wanted) return true;
      const c = (it.fields.CodigoEdifcio_IN ?? "").trim().toUpperCase();
      return !c || c === wanted; // sin código (dato viejo) → no lo ocultamos
    })
    .map((it: ListItem<IncFields>) => {
      const f = it.fields;
      return {
        ID: Number(it.id),
        Edificio: f.NombreEdificio_IN ?? "",
        Tecnico: f.TecnicoAsignado_IN ?? "",
        Fecha: f.Fecha_IN ?? "",
        Status: f.Status_IN ?? "",
        Descripcion: f.Descripcion_IN ?? f.DescripcionCarga_IN ?? "",
        Repuestos: repuestoLabel(f),
        Observacion: observacionEvento(f),
      };
    })
    .sort((a, b) => b.ID - a.ID); // SortByColumns(..., "ID", Descending)
}

// --- Repuestos de un incidente (13.RepuestosIncidentes). El campo del id de incidente
//     tiene nombre interno `IDIncidente_IN` (display IDIncidente_RI). ---
interface RepFields {
  Repuesto_RI?: string;
  Cantidad_RI?: string | number;
  Status_RI?: string;
}

export interface RepuestoIncidente {
  ID: number;
  Repuesto: string;
  Cantidad: number;
  Status: string; // Pendiente / Anulado (estado de la línea de repuesto)
}

export async function listRepuestosIncidente(
  idIncidente: number,
): Promise<RepuestoIncidente[]> {
  const listId = await resolveListId(L_REP_INCIDENTES);
  const filter = `fields/IDIncidente_IN eq '${idIncidente}'`;
  const items = await getListItemsFiltered<RepFields>(
    listId,
    ["Repuesto_RI", "Cantidad_RI", "Status_RI"],
    filter,
  );
  return items.map((it: ListItem<RepFields>) => ({
    ID: Number(it.id),
    Repuesto: it.fields.Repuesto_RI ?? "",
    Cantidad: Number(it.fields.Cantidad_RI ?? 0) || 0,
    Status: it.fields.Status_RI ?? "",
  }));
}
