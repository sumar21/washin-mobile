// Cliente del backend serverless (/api). Adjunta el JWT de la sesión y maneja 401.
import { useSession } from "@/stores/sessionStore";

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useSession.getState().token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    // Sesión inválida/expirada: limpiar y dejar que el AuthGuard redirija a login.
    useSession.getState().logout();
    throw new Error("Sesión expirada");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok)
    throw new Error(
      (data as { error?: string }).error ?? `Error ${res.status}`,
    );
  return data;
}

// --- Home ---
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
export interface HomeData {
  kpis: {
    visitasHoy: number;
    incidentesActivos: number;
    ventilaciones: number;
  };
  registros: HomeRegistro[];
  modulos: { Modulo_LPM: string; Orden: number }[];
}

export const getHome = () => authFetch<HomeData>("/api/home");

// Anula un registro del día (solo Admin/Supervisor en el backend).
export interface AnularRegistroResult {
  ok: true;
  id: number;
  estado: string;
}
export const anularRegistro = (id: number) =>
  authFetch<AnularRegistroResult>("/api/registros", {
    method: "POST",
    body: JSON.stringify({ id, action: "anular" }),
  });

// --- Descanso (1 por día) ---
export interface BreakState {
  active: { id: string; startedAt: string } | null;
  usedToday: boolean; // ya se consumió el descanso de hoy → no se puede iniciar otro
}
export const getBreak = () => authFetch<BreakState>("/api/break");
export const postBreak = (action: "start" | "end") =>
  authFetch<BreakState>("/api/break", {
    method: "POST",
    body: JSON.stringify({ action }),
  });

// --- Catálogos compartidos (App.OnStart de PowerApps) ---
export interface Edificio {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Correo: string;
  Encargado: string;
  Celular: string;
  Status: string;
}
export interface MaquinaModelo {
  ID: number;
  Marca: string;
  Modelo: string;
  Segmento: string;
  Concat: string;
  Status_MC: string;
}
export interface MotivoCancelacion {
  ID: number;
  Motivo: string;
  Status_MC: string;
}
export interface UsuarioRef {
  ID: number;
  Usuario: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Correo: string;
  Telefono: string;
  Rol: string;
  Legajo: string;
  Status: string;
}
const catalogo = <T>(tipo: string) =>
  authFetch<{ items: T[] }>(`/api/catalogos?tipo=${tipo}`).then((r) => r.items);
export const getEdificios = () => catalogo<Edificio>("edificios");
export const getMarcasModelos = () => catalogo<MaquinaModelo>("marcas");
export const getMotivosCancelacion = () =>
  catalogo<MotivoCancelacion>("motivos");
export const getUsuarios = () => catalogo<UsuarioRef>("usuarios");

// --- Ventilaciones (19.Ventilaciones) ---
export interface Ventilacion {
  ID: number;
  IDAsignado_VE: number;
  Edificio_VE: string;
  Grupo_VE: string;
  Frecuencia_VE: string;
  Estado_VE: string;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  FechaFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
  EsIncidente_VE?: string;
}
export const getVentilaciones = () =>
  authFetch<{ ventilaciones: Ventilacion[] }>("/api/ventilaciones").then(
    (r) => r.ventilaciones,
  );
export const programarVentilacion = (id: number, fechaProgramada: string) =>
  authFetch<{ ok: true }>("/api/ventilaciones", {
    method: "POST",
    body: JSON.stringify({ id, action: "programar", fechaProgramada }),
  });
export const finalizarVentilacion = (id: number, observacion: string) =>
  authFetch<{ ok: true }>("/api/ventilaciones", {
    method: "POST",
    body: JSON.stringify({ id, action: "finalizar", observacion }),
  });

// --- Detalle de Máquina (08.DetalleMaquina) + historial (incidentes de la máquina) ---
export interface DetalleMaquina {
  ID: number;
  IDMaquina_DM: string;
  ConcatMaquina_DM: string;
  Marca_DM: string;
  Modelo_DM: string;
  NroSerie_DM: string;
  IDExterno_DM: number;
  Encendido_DM: string;
  Edificio_DM: string;
  CodigoEdificio_DM: string;
}
export interface HistorialIncidente {
  ID: number;
  Edificio: string;
  Tecnico: string;
  Fecha: string;
  Status: string;
  Descripcion: string;
  Repuestos: string;
  Observacion: string;
}
export interface RepuestoIncidente {
  ID: number;
  Repuesto: string;
  Cantidad: number;
}
export interface MaquinaFiltro {
  edificio?: string;
  modelo?: string;
  marca?: string;
}
export const getDetalleMaquina = (filtro?: MaquinaFiltro) => {
  const qs = new URLSearchParams();
  if (filtro?.edificio) qs.set("edificio", filtro.edificio);
  if (filtro?.modelo) qs.set("modelo", filtro.modelo);
  if (filtro?.marca) qs.set("marca", filtro.marca);
  const q = qs.toString();
  return authFetch<{ maquinas: DetalleMaquina[] }>(
    `/api/maquinas${q ? `?${q}` : ""}`,
  ).then((r) => r.maquinas);
};
export const getHistorialMaquina = (idMaquina: string) =>
  authFetch<{ historial: HistorialIncidente[] }>(
    `/api/maquinas?historial=${encodeURIComponent(idMaquina)}`,
  ).then((r) => r.historial);
export const getRepuestosIncidente = (idIncidente: number) =>
  authFetch<{ repuestos: RepuestoIncidente[] }>(
    `/api/maquinas?repuestos=${idIncidente}`,
  ).then((r) => r.repuestos);

// --- Incidentes (10.Incidentes) ---
export interface Incidente {
  ID: number;
  IDIncidente: number;
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
export interface CrearIncidenteInput {
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  TecnicoAsignado_IN: string;
  Descripcion: string;
  Categoria?: string;
}
// resuelto: "NO" = activos (default), "SI" = cerrados/anulados.
export const getIncidentes = (resuelto: "SI" | "NO" = "NO") =>
  authFetch<{ incidentes: Incidente[] }>(
    `/api/incidentes?resuelto=${resuelto}`,
  ).then((r) => r.incidentes);
export const crearIncidente = (input: CrearIncidenteInput) =>
  authFetch<{ id: string }>("/api/incidentes", {
    method: "POST",
    body: JSON.stringify({ action: "crear", ...input }),
  });
export const anularIncidente = (id: number, motivo: string) =>
  authFetch<{ ok: true }>("/api/incidentes", {
    method: "POST",
    body: JSON.stringify({ action: "anular", id, motivo }),
  });
