// Mock API. TODO: reemplazar por integración real (SharePoint vía MS Graph o backend propio).
import usuariosData from "./mock/usuarios.json";
import edificiosData from "./mock/edificios.json";
import permisosData from "./mock/permisos-mobile.json";
import registrosData from "./mock/registros.json";
import checklistData from "./mock/checklist.json";
import incidentesData from "./mock/incidentes.json";
import detalleMaquinaData from "./mock/detalle-maquina.json";
import historialMaquinaData from "./mock/historial-maquina.json";
import ventilacionesData from "./mock/ventilaciones.json";
import planificacionesData from "./mock/planificaciones.json";
import stockData from "./mock/stock.json";
import repuestosIncidentesData from "./mock/repuestos-incidentes.json";
import repuestosHistorialData from "./mock/repuestos-historial.json";
import catalogosData from "./mock/catalogos.json";
import emailsData from "./mock/emails-templates.json";
import detallesData from "./mock/detalles.json";

import type {
  Usuario,
  Edificio,
  PermisoMobile,
  Registro,
  ChecklistItemDef,
  Incidente,
  DetalleMaquina,
  HistorialMaquina,
  Ventilacion,
  ResumenPlanificacion,
  DetallePlanificacion,
  Stock,
  RepuestoIncidente,
  RepuestoHistorial,
  EmailTemplate,
  DetalleRegistro,
  RolCatalogo,
  TipoABM,
  MotivoCancelacion,
  Frecuencia,
  GrupoVent,
  MaquinaCompra,
} from "./types";

const DELAY = 200;
const wait = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), DELAY));

// "Bases" mutables en memoria (simulan SP — los Patch mock las modifican).
const db = {
  usuarios: structuredClone(usuariosData) as Usuario[],
  edificios: structuredClone(edificiosData) as Edificio[],
  permisos: structuredClone(permisosData) as PermisoMobile[],
  registros: structuredClone(registrosData) as Registro[],
  checklist: structuredClone(checklistData) as ChecklistItemDef[],
  incidentes: structuredClone(incidentesData) as Incidente[],
  detalleMaquina: structuredClone(detalleMaquinaData) as DetalleMaquina[],
  historialMaquina: structuredClone(historialMaquinaData) as HistorialMaquina[],
  ventilaciones: structuredClone(ventilacionesData) as Ventilacion[],
  planificacionesResumen: structuredClone(planificacionesData.resumenes) as ResumenPlanificacion[],
  planificacionesDetalle: structuredClone(planificacionesData.detalles) as DetallePlanificacion[],
  stock: structuredClone(stockData) as Stock[],
  repuestosIncidentes: structuredClone(repuestosIncidentesData) as RepuestoIncidente[],
  repuestosHistorial: structuredClone(repuestosHistorialData) as RepuestoHistorial[],
  emails: structuredClone(emailsData) as EmailTemplate[],
  detalles: structuredClone(detallesData) as DetalleRegistro[],
  roles: structuredClone(catalogosData.roles) as RolCatalogo[],
  tiposABM: structuredClone(catalogosData.tiposABM) as TipoABM[],
  motivosCancelacion: structuredClone(catalogosData.motivosCancelacion) as MotivoCancelacion[],
  frecuencias: structuredClone(catalogosData.frecuencias) as Frecuencia[],
  gruposVent: structuredClone(catalogosData.gruposVent) as GrupoVent[],
  marcasModelos: structuredClone(catalogosData.marcasModelos) as MaquinaCompra[],
};

export const api = {
  // Lecturas
  listUsuarios: () => wait([...db.usuarios]),
  listEdificios: () => wait([...db.edificios]),
  listPermisos: () => wait([...db.permisos]),
  listRegistros: () => wait([...db.registros]),
  listChecklist: () => wait([...db.checklist]),
  listIncidentes: () => wait([...db.incidentes]),
  listDetalleMaquina: () => wait([...db.detalleMaquina]),
  listHistorialMaquina: (idMaquina?: string) =>
    wait(idMaquina ? db.historialMaquina.filter((h) => h.IDMaquina === idMaquina) : [...db.historialMaquina]),
  listVentilaciones: () => wait([...db.ventilaciones]),
  listPlanificacionesResumen: () => wait([...db.planificacionesResumen]),
  listPlanificacionesDetalle: () => wait([...db.planificacionesDetalle]),
  listStock: () => wait([...db.stock]),
  listRepuestosIncidente: (idIncidente: number) =>
    wait(db.repuestosIncidentes.filter((r) => r.IDIncidente_RI === idIncidente)),
  listRepuestosHistorial: (idHistorial: number) =>
    wait(db.repuestosHistorial.filter((r) => r.IDHistorial_RH === idHistorial)),
  listEmails: () => wait([...db.emails]),
  listDetalles: () => wait([...db.detalles]),
  listRoles: () => wait([...db.roles]),
  listTiposABM: () => wait([...db.tiposABM]),
  listMotivosCancelacion: () => wait([...db.motivosCancelacion]),
  listFrecuencias: () => wait([...db.frecuencias]),
  listGruposVent: () => wait([...db.gruposVent]),
  listMarcasModelos: () => wait([...db.marcasModelos]),

  // Mutaciones (mock)
  upsertEdificio: (e: Edificio) => {
    const i = db.edificios.findIndex((x) => x.ID === e.ID);
    if (i === -1) db.edificios.push({ ...e, ID: nextId(db.edificios) });
    else db.edificios[i] = e;
    return wait({ ok: true, item: e });
  },
  setEdificioStatus: (id: number, status: Edificio["Status"]) => {
    const e = db.edificios.find((x) => x.ID === id);
    if (e) e.Status = status;
    return wait({ ok: true });
  },
  upsertUsuario: (u: Usuario) => {
    const i = db.usuarios.findIndex((x) => x.ID === u.ID);
    if (i === -1) db.usuarios.push({ ...u, ID: nextId(db.usuarios) });
    else db.usuarios[i] = u;
    return wait({ ok: true, item: u });
  },
  setUsuarioStatus: (id: number, status: Usuario["Status"]) => {
    const u = db.usuarios.find((x) => x.ID === id);
    if (u) u.Status = status;
    return wait({ ok: true });
  },
  createIncidente: (inc: Omit<Incidente, "ID" | "IDIncidente">) => {
    const ID = nextId(db.incidentes);
    const item: Incidente = { ...inc, ID, IDIncidente: 1000 + ID };
    db.incidentes.push(item);
    return wait({ ok: true, item });
  },
  patchIncidente: (id: number, patch: Partial<Incidente>) => {
    const inc = db.incidentes.find((x) => x.ID === id);
    if (inc) Object.assign(inc, patch);
    return wait({ ok: true });
  },
  patchVentilacion: (id: number, patch: Partial<Ventilacion>) => {
    const v = db.ventilaciones.find((x) => x.ID === id);
    if (v) Object.assign(v, patch);
    return wait({ ok: true });
  },
  createVentilacion: (vent: Omit<Ventilacion, "ID">) => {
    const ID = nextId(db.ventilaciones);
    const item: Ventilacion = { ...vent, ID };
    db.ventilaciones.push(item);
    return wait({ ok: true, item });
  },
  patchRegistro: (id: number, patch: Partial<Registro>) => {
    const r = db.registros.find((x) => x.ID === id);
    if (r) Object.assign(r, patch);
    return wait({ ok: true });
  },
  createRegistro: (reg: Omit<Registro, "ID">) => {
    const ID = nextId(db.registros);
    const item: Registro = { ...reg, ID };
    db.registros.push(item);
    return wait({ ok: true, item });
  },
  sendEmail: (payload: { to: string; subject: string; html: string; bcc?: string }) => {
    console.info("[mock-email]", payload);
    return wait({ ok: true });
  },
  runFlow: (name: string, payload: Record<string, unknown>) => {
    console.info(`[mock-flow] ${name}`, payload);
    return wait({ ok: true });
  },
};

function nextId(arr: { ID: number }[]) {
  return arr.length ? Math.max(...arr.map((x) => x.ID)) + 1 : 1;
}

export type Api = typeof api;
