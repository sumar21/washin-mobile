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

// Estados de 10.Incidentes sobre los que el técnico PUEDE actuar desde la app. Definen el KPI
// "incidentes activos" del Home. En MAYÚSCULAS porque se compara normalizado (Status_IN es texto
// libre en SharePoint y aparece con distinta capitalización).
// OJO: tiene que dar lo MISMO que el tab "Abiertos" de src/screens/ScreenIncidentes.tsx. Si allá se
// cambia qué estados ve el técnico, hay que cambiarlo acá — el número del Home es el largo de esa
// lista y un desfasaje se ve como un contador mentiroso.
const ACCIONABLES_TECNICO = new Set(["A REVISAR", "ASIGNADO"]);

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
  IDUnico?: string;
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
  IDUnico: string; // clave del registro/checklist → navega a /registros/:idUnico (ScreenRegistroDetalle)
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
  // Paridad PA (lbl_porcRV): RoundDown (= Math.floor); y si la visita está finalizada sin ítems
  // "No" (Check = 0) se considera 100%.
  const completitud = finalizado
    ? check === 0
      ? 100
      : Math.floor((ok / total) * 100)
    : undefined;
  return {
    ID: Number(it.id),
    IDUnico: f.IDUnico ?? "",
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
  // Técnico: cuenta SOLO lo ASIGNADO (TecnicoAsignado_IN), igual que la lista de incidentes.
  // Antes incluía `or User_IN = VarUsuario`, que sumaba al KPI lo reportado para otro técnico.
  //
  // El recorte por `Status_IN` se hace DESPUÉS, en memoria (ver `ACCIONABLES_TECNICO`). No se suma
  // acá a propósito: sería otro `and` sobre columnas no indexadas y SharePoint puede devolver 400.
  let incFilter = `fields/Resuelto_IN eq 'NO'`;
  if (isTecnico) {
    incFilter +=
      ` and (fields/TecnicoAsignado_IN eq '${usuarioEsc}'` +
      ` or fields/TecnicoAsignado_IN eq '${nombreEsc}')`;
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
        "IDUnico",
      ],
      regFilter,
    ),
    // Se traen las filas (no un contador) para poder descartar los ANULADOS en memoria: el
    // escritorio anula escribiendo sólo Status_IN='Anulado' y deja Resuelto_IN='NO', así que cada
    // anulación de gerencia le quedaba sumada al técnico en el KPI para siempre — el Home marcaba
    // 7 donde la lista de incidentes mostraba muchos menos. `countItems` tampoco ahorraba red:
    // hace exactamente este fetch con $select=id y cuenta el largo.
    getListItemsFiltered<{ Status_IN?: string }>(incId, ["Status_IN"], incFilter),
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
  // El KPI cuenta SOLO lo que el técnico puede tocar hoy, que es lo mismo que le muestra el tab
  // "Abiertos" al que lleva el número (ScreenIncidentes.tsx): si el contador y esa lista no dan
  // igual, el técnico reclama — que es justo lo que pasaba (Home marcaba 9 y la lista mostraba 4).
  //   · "A Revisar" → habilita la acción Revisar (diagnosticar).
  //   · "Asignado"  → habilita Resolver, si además él es el asignado.
  // Quedan afuera los que están esperando a gerencia y sobre los que no puede hacer nada:
  // "Pendiente" y "Aprobada" (paridad PA gal_incidentes.Items), "En Aprobacion" (cambio de máquina
  // esperando el OK) y "Anulado" (que además el escritorio deja con Resuelto_IN='NO', así que sin
  // este recorte le quedaba sumado para siempre).
  const incidentesActivos =
    settled[1].status === "fulfilled"
      ? settled[1].value.filter((it) =>
          ACCIONABLES_TECNICO.has((it.fields.Status_IN ?? "").trim().toUpperCase()),
        ).length
      : 0;
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
