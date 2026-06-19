// 19.Ventilaciones — worklist de ventilaciones activas (Asignada/Programada).
// Equivale al ClearCollect de PowerApps:
//   Filter('19.Ventilaciones'; (Estado_VE = "Asignada" Or Estado_VE = "Programada")
//          And IDAsignado_VE = RegistroUser.ID)
// Técnico: scope por IDAsignado_VE = su ID. Admin/Supervisor: ven todas (sin scope),
// igual que el resto de la app.
import {
  resolveListId,
  getListItemsFiltered,
  getListItem,
  patchItemFields,
  createItem,
  type ListItem,
} from "./sharepoint.js";
import { nowTimeAr, arParts, plusDaysAr } from "./time.js";

const L = "19.Ventilaciones";
const ESTADOS_ACTIVOS = ["Asignada", "Programada"];

interface VeFields {
  Estado_VE?: string;
  Edificio_VE?: string;
  DireccionEdificio_VE?: string;
  IDEdificio_VE?: number;
  Grupo_VE?: string;
  Frecuencia_VE?: number;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  ProximaLimpieza_VE?: string;
  FechaUltima_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: string;
  IDAsignado_VE?: number;
}

export interface Ventilacion {
  ID: number;
  IDAsignado_VE: number;
  Edificio_VE: string;
  DireccionEdificio_VE: string;
  IDEdificio_VE: number;
  Grupo_VE: string;
  Frecuencia_VE: string; // en SP es número; se expone como string para la UI
  Estado_VE: string;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  ProximaLimpieza_VE?: string;
  FechaUltima_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: string;
}

const FIELDS = [
  "Estado_VE",
  "Edificio_VE",
  "DireccionEdificio_VE",
  "IDEdificio_VE",
  "Grupo_VE",
  "Frecuencia_VE",
  "Orden_VE",
  "FechaProgramada_VE",
  "ProximaLimpieza_VE",
  "FechaUltima_VE",
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
    DireccionEdificio_VE: f.DireccionEdificio_VE ?? "",
    IDEdificio_VE: Number(f.IDEdificio_VE ?? 0),
    Grupo_VE: f.Grupo_VE ?? "",
    Frecuencia_VE: f.Frecuencia_VE != null ? String(f.Frecuencia_VE) : "",
    Estado_VE: f.Estado_VE ?? "",
    Orden_VE: f.Orden_VE,
    FechaProgramada_VE: f.FechaProgramada_VE,
    ProximaLimpieza_VE: f.ProximaLimpieza_VE,
    FechaUltima_VE: f.FechaUltima_VE,
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

// Ventilaciones PENDIENTES (Estado_VE = "Pendiente"). PA las usa para poblar el combo de
// "Adelantar Ventilación" desde Incidentes (CollectVentilacionesPendientes).
export async function listVentilacionesPendientes(): Promise<Ventilacion[]> {
  const listId = await resolveListId(L);
  const items = await getListItemsFiltered<VeFields>(
    listId,
    FIELDS,
    `fields/Estado_VE eq 'Pendiente'`,
  );
  return items.map(mapVentilacion).sort((a, b) =>
    a.Edificio_VE.localeCompare(b.Edificio_VE),
  );
}

// Adelantar una ventilación PENDIENTE existente (paridad PowerApps bt_aceptar_AVE): NO crea una
// fila nueva, sino que patchea la seleccionada con próxima limpieza = HOY y la marca como
// originada por incidente (EsIncidente_VE = "SI"). No toca Estado_VE (PA tampoco).
export async function adelantarVentilacion(
  id: number,
  observacion: string,
): Promise<void> {
  const listId = await resolveListId(L);
  const hoy = arParts(new Date());
  await patchItemFields(listId, String(id), {
    ProximaLimpieza_VE: hoy.fecha,
    FechaMesAnoProxima_VE: hoy.mesAno,
    FechaAnoProxima_VE: hoy.ano,
    ObservacionAdelanto_VE: observacion,
    EsIncidente_VE: "SI",
  });
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

// Finalizar: marca la ventilación como "Realizada" (con timestamps) y, como en PowerApps,
// auto-genera el próximo ciclo "Pendiente" reusando los datos denormalizados del registro
// (edificio + frecuencia) y calculando la próxima limpieza = hoy + Frecuencia días.
export async function finalizarVentilacion(
  id: number,
  observacion: string,
): Promise<void> {
  const listId = await resolveListId(L);
  const current = await getListItem<VeFields>(listId, String(id), FIELDS);
  const hoy = arParts(new Date());

  // 1) Registro actual → Realizada.
  await patchItemFields(listId, String(id), {
    Estado_VE: "Realizada",
    ObservacionResuelto_VE: observacion,
    FechaFinalizacion_VE: hoy.fecha,
    FechaMesAnoFinalizacion_VE: hoy.mesAno,
    FechaAnoFinalizacion_VE: hoy.ano,
    HoraFinalizacion_VE: nowTimeAr(),
    Orden_VE: "1",
  });

  // 2) Próximo ciclo → Pendiente (lo asigna luego el flujo externo). Equivale al
  //    Patch(Defaults(...)) del "Aceptar" de PowerApps.
  if (current) {
    const f = current.fields;
    const freq = Number(f.Frecuencia_VE ?? 0) || 0;
    const prox = plusDaysAr(freq);
    const next: Record<string, unknown> = {
      Title: "sumar",
      EsIncidente_VE: "NO",
      Estado_VE: "Pendiente",
      Edificio_VE: f.Edificio_VE ?? "",
      DireccionEdificio_VE: f.DireccionEdificio_VE ?? "",
      Grupo_VE: f.Grupo_VE ?? "",
      Frecuencia_VE: freq,
      FechaUltima_VE: hoy.fecha,
      ProximaLimpieza_VE: prox.fecha,
      FechaMesAnoProxima_VE: prox.mesAno,
      FechaAnoProxima_VE: prox.ano,
      Orden_VE: "4",
    };
    if (f.IDEdificio_VE != null) next.IDEdificio_VE = f.IDEdificio_VE;
    await createItem(listId, next);
  }
}

// Crear ventilación desde un incidente (EsIncidente_VE="SI", Estado="Asignada"), como el
// "Generar ventilación" de PowerApps. La asigna al técnico logueado.
export async function crearVentilacion(
  input: {
    edificio: string;
    idEdificio?: number;
    grupo?: string;
    frecuencia?: number;
    observacion?: string;
  },
  auth: { nombre: string; sub: string },
): Promise<{ id: string }> {
  const listId = await resolveListId(L);
  const hoy = arParts(new Date());
  const fields: Record<string, unknown> = {
    Title: "sumar",
    EsIncidente_VE: "SI",
    Estado_VE: "Asignada",
    Edificio_VE: input.edificio,
    Asignado_VE: auth.nombre,
    IDAsignado_VE: Number(auth.sub) || 0,
    Grupo_VE: input.grupo ?? "",
    ObservacionAdelanto_VE: input.observacion ?? "",
    FechaAsignado_VE: hoy.fecha,
    HoraAsignado_VE: nowTimeAr(),
    Orden_VE: "1",
  };
  if (input.idEdificio != null) fields.IDEdificio_VE = input.idEdificio;
  if (input.frecuencia != null) fields.Frecuencia_VE = Number(input.frecuencia);
  return createItem(listId, fields);
}
