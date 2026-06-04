// 19.Ventilaciones — worklist de ventilaciones activas (Asignada/Programada).
// Equivale al ClearCollect de PowerApps:
//   Filter('19.Ventilaciones'; (Estado_VE = "Asignada" Or Estado_VE = "Programada")
//          And IDAsignado_VE = RegistroUser.ID)
// Técnico: scope por IDAsignado_VE = su ID. Admin/Supervisor: ven todas (sin scope),
// igual que el resto de la app.
import {
  resolveListId,
  getListItemsFiltered,
  patchItemFields,
  type ListItem,
} from "./sharepoint.js";
import { todayAr } from "./time.js";

const L = "19.Ventilaciones";
const ESTADOS_ACTIVOS = ["Asignada", "Programada"];

interface VeFields {
  Estado_VE?: string;
  Edificio_VE?: string;
  Grupo_VE?: string;
  Frecuencia_VE?: number;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: string;
  IDAsignado_VE?: number;
}

export interface Ventilacion {
  ID: number;
  IDAsignado_VE: number;
  Edificio_VE: string;
  Grupo_VE: string;
  Frecuencia_VE: string; // en SP es número; se expone como string para la UI
  Estado_VE: string;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: string;
}

const FIELDS = [
  "Estado_VE",
  "Edificio_VE",
  "Grupo_VE",
  "Frecuencia_VE",
  "Orden_VE",
  "FechaProgramada_VE",
  "FechaFinalizacion_VE",
  "ObservacionResuelto_VE",
  "EsIncidente_VE",
  "IDAsignado_VE",
];

function mapVentilacion(it: ListItem<VeFields>): Ventilacion {
  const f = it.fields;
  return {
    ID: Number(it.id),
    IDAsignado_VE: Number(f.IDAsignado_VE ?? 0),
    Edificio_VE: f.Edificio_VE ?? "",
    Grupo_VE: f.Grupo_VE ?? "",
    Frecuencia_VE: f.Frecuencia_VE != null ? String(f.Frecuencia_VE) : "",
    Estado_VE: f.Estado_VE ?? "",
    Orden_VE: f.Orden_VE,
    FechaProgramada_VE: f.FechaProgramada_VE,
    FechaFinalizacion_VE: f.FechaFinalizacion_VE,
    ObservacionResuelto_VE: f.ObservacionResuelto_VE,
    EsIncidente_VE: f.EsIncidente_VE,
  };
}

export async function listVentilaciones({
  rol,
  sub,
}: {
  rol: string;
  sub: string; // ID del usuario logueado (claim `sub` del JWT)
}): Promise<Ventilacion[]> {
  const listId = await resolveListId(L);
  const estados = ESTADOS_ACTIVOS.map((e) => `fields/Estado_VE eq '${e}'`).join(
    " or ",
  );
  let filter = `(${estados})`;
  // IDAsignado_VE es numérico → sin comillas en el OData.
  if (rol === "Tecnico")
    filter += ` and fields/IDAsignado_VE eq ${Number(sub)}`;
  const items = await getListItemsFiltered<VeFields>(listId, FIELDS, filter);
  return items.map(mapVentilacion);
}

// Programar: Estado -> "Programada" + fecha. (Orden_VE "2" como en PowerApps.)
export async function programarVentilacion(
  id: number,
  fechaProgramada: string,
): Promise<void> {
  const listId = await resolveListId(L);
  await patchItemFields(listId, String(id), {
    Estado_VE: "Programada",
    FechaProgramada_VE: fechaProgramada,
    Orden_VE: "2",
  });
}

// Finalizar: Estado -> "Realizada" + observación + fecha de finalización. (Orden_VE "1".)
export async function finalizarVentilacion(
  id: number,
  observacion: string,
): Promise<void> {
  const listId = await resolveListId(L);
  await patchItemFields(listId, String(id), {
    Estado_VE: "Realizada",
    ObservacionResuelto_VE: observacion,
    FechaFinalizacion_VE: todayAr(),
    Orden_VE: "1",
  });
}
