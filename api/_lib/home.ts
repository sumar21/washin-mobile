// Lógica de datos del Home: KPIs + registros del día + módulos por rol.
// Scoping: admin ve global; técnico ve solo lo suyo (visitas por `Nombre`,
// incidentes por `TecnicoAsignado_IN`, ventilaciones por `Asignado_VE`).
import {
  resolveListId,
  getListItems,
  getListItemsFiltered,
  countItems,
  escapeODataValue,
  type ListItem,
} from "./sharepoint.js";
import { todayAr } from "./time.js";

const L_REGISTROS = "01.Registros";
const L_INCIDENTES = "10.Incidentes";
const L_VENTILACIONES = "19.Ventilaciones";
const L_PERMISOS = "99.ListaPermisosMobile";

// Ventilaciones "activas" (no Realizada/Anulada).
const VENT_ACTIVAS = ["Pendiente", "Asignada", "Programada"];

interface RegFields {
  Edificio?: string;
  Nombre?: string;
  HoraVisita?: string;
  Estado?: string;
  Codigo?: string;
  Direccion?: string;
  Fecha0?: string;
  Ok?: number;
  Check?: number;
}

interface PermFields {
  Modulo_LPM?: string;
  Orden_LPM?: string;
  Admin_LPM?: string;
  Tecnico_LPM?: string;
  Supervisor_LPM?: string;
  Status_LPP?: string;
}

export interface HomeRegistro {
  ID: number;
  Edificio: string;
  Nombre: string;
  HoraVisita: string;
  Estado: string;
  Codigo: string;
  Direccion: string;
  Completitud?: number;
}

export interface HomePayload {
  kpis: {
    visitasHoy: number;
    incidentesActivos: number;
    ventilaciones: number;
  };
  registros: HomeRegistro[];
  modulos: { Modulo_LPM: string; Orden: number }[];
}

function mapRegistro(it: ListItem<RegFields>): HomeRegistro {
  const f = it.fields;
  const ok = Number(f.Ok ?? 0);
  const check = Number(f.Check ?? 0);
  const total = ok + check;
  const finalizado = (f.Estado ?? "").trim().toLowerCase() === "finalizado";
  const completitud =
    finalizado && total > 0 ? Math.round((ok / total) * 100) : undefined;
  return {
    ID: Number(it.id),
    Edificio: f.Edificio ?? "",
    Nombre: f.Nombre ?? "",
    HoraVisita: f.HoraVisita ?? "",
    Estado: f.Estado ?? "",
    Codigo: f.Codigo ?? "",
    Direccion: f.Direccion ?? "",
    Completitud: completitud,
  };
}

export async function buildHome({
  rol,
  usuario,
  nombre,
}: {
  rol: string;
  usuario: string; // login (ej. "Josrojas") — registros.Nombre usa este formato
  nombre: string; // "Apellido, Nombre" — ventilaciones.Asignado_VE usa este formato
}): Promise<HomePayload> {
  const isTecnico = rol === "Tecnico";
  const hoyRaw = todayAr();
  const hoy = escapeODataValue(hoyRaw);
  const usuarioEsc = escapeODataValue(usuario);
  const nombreEsc = escapeODataValue(nombre);

  const [regId, incId, venId, permId] = await Promise.all([
    resolveListId(L_REGISTROS),
    resolveListId(L_INCIDENTES),
    resolveListId(L_VENTILACIONES),
    resolveListId(L_PERMISOS),
  ]);

  // Registros: los de hoy + TODOS los pendientes (aunque sean de días previos), igual que
  // GalHome en PowerApps (`Fecha = Today Or Estado = "Pendiente"`). Los pendientes son los
  // únicos anulables, así que tienen que verse siempre. Técnico: scope por `Nombre` (login).
  let regFilter = `(fields/Fecha0 eq '${hoy}' or fields/Estado eq 'Pendiente')`;
  if (isTecnico) regFilter += ` and fields/Nombre eq '${usuarioEsc}'`;

  // Incidentes activos: Resuelto_IN = NO (Status_IN suele venir vacío).
  // Técnico: match robusto contra usuario o nombre (formato de TecnicoAsignado_IN a confirmar).
  let incFilter = `fields/Resuelto_IN eq 'NO'`;
  if (isTecnico) {
    incFilter += ` and (fields/TecnicoAsignado_IN eq '${usuarioEsc}' or fields/TecnicoAsignado_IN eq '${nombreEsc}')`;
  }

  // Ventilaciones activas.
  const venActivas = VENT_ACTIVAS.map((s) => `fields/Estado_VE eq '${s}'`).join(
    " or ",
  );
  let venFilter = `(${venActivas})`;
  if (isTecnico) venFilter += ` and fields/Asignado_VE eq '${nombreEsc}'`;

  // Resiliente: una consulta puede fallar de forma intermitente (listas grandes con el header
  // "MayFailRandomly"). Con allSettled, el fallo de un contador NO vacía el resto del Home
  // (antes Promise.all rechazaba todo → KPIs en 0 + registros vacíos hasta remontar).
  const settled = await Promise.allSettled([
    getListItemsFiltered<RegFields>(
      regId,
      [
        "Edificio",
        "Nombre",
        "HoraVisita",
        "Estado",
        "Codigo",
        "Direccion",
        "Fecha0",
        "Ok",
        "Check",
      ],
      regFilter,
    ),
    countItems(incId, incFilter),
    countItems(venId, venFilter),
    getListItems<PermFields>(permId, [
      "Modulo_LPM",
      "Orden_LPM",
      "Admin_LPM",
      "Tecnico_LPM",
      "Supervisor_LPM",
      "Status_LPP",
    ]),
  ]);
  for (const r of settled) {
    if (r.status === "rejected") {
      console.error(
        "[home] sub-consulta falló:",
        r.reason instanceof Error ? r.reason.message : r.reason,
      );
    }
  }
  const regItems = settled[0].status === "fulfilled" ? settled[0].value : [];
  const incidentesActivos =
    settled[1].status === "fulfilled" ? settled[1].value : 0;
  const ventilaciones = settled[2].status === "fulfilled" ? settled[2].value : 0;
  const permItems = settled[3].status === "fulfilled" ? settled[3].value : [];

  // Pendientes primero (son los accionables: anulables); dentro de cada grupo, más nuevo
  // primero. Garantiza que los pendientes se vean aunque la lista se recorte en el front.
  const isPend = (e: string) => e.trim().toLowerCase() === "pendiente";
  const registros = regItems.map(mapRegistro).sort((a, b) => {
    const pa = isPend(a.Estado) ? 0 : 1;
    const pb = isPend(b.Estado) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.ID - a.ID;
  });

  // "Visitas hoy" cuenta solo las del día (los pendientes de días previos no inflan el KPI).
  const visitasHoy = regItems.filter(
    (it) => (it.fields.Fecha0 ?? "") === hoyRaw,
  ).length;

  // Módulos visibles. Igual que PowerApps (gal_navbarHome): todos los activos, sin
  // filtrar por rol — la lista 99.ListaPermisosMobile tiene columnas por rol pero la app
  // NO las usa para la grilla del Home. Se excluye "Checklist" como en PowerApps; el
  // front además acota cuáles se muestran (HOME_MODULES / NAV_VISIBLE).
  const modulos = permItems
    .filter(
      (it) => (it.fields.Status_LPP ?? "").trim().toLowerCase() === "activo",
    )
    .filter((it) => (it.fields.Modulo_LPM ?? "") !== "Checklist")
    .map((it) => ({
      Modulo_LPM: it.fields.Modulo_LPM ?? "",
      Orden: Number(it.fields.Orden_LPM ?? 0),
    }))
    .sort((a, b) => a.Orden - b.Orden);

  return {
    kpis: {
      visitasHoy,
      incidentesActivos,
      ventilaciones,
    },
    registros,
    modulos,
  };
}
