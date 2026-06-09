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
  Latitud: number;
  Longitud: number;
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
  DireccionEdificio_VE: string;
  IDEdificio_VE: number;
  Grupo_VE: string;
  Frecuencia_VE: string;
  Estado_VE: string;
  Orden_VE?: string;
  FechaProgramada_VE?: string;
  ProximaLimpieza_VE?: string;
  FechaUltima_VE?: string;
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
// Crear ventilación desde un incidente (EsIncidente_VE="SI", asignada al técnico logueado).
export const crearVentilacionDesdeIncidente = (input: {
  edificio: string;
  idEdificio?: number;
  grupo?: string;
  frecuencia?: number;
  observacion?: string;
}) =>
  authFetch<{ ok: true; id: string }>("/api/ventilaciones", {
    method: "POST",
    body: JSON.stringify({ action: "crear", ...input }),
  });

// --- Mail (envío vía Graph sendMail) ---
export const enviarMail = (input: {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
}) =>
  authFetch<{ ok: true }>("/api/mail", {
    method: "POST",
    body: JSON.stringify(input),
  });

// --- ABM (administración: Edificios / Usuarios / Mails) — solo Admin ---
export interface EdificioABM {
  ID: number;
  Codigo: string;
  Edificio: string;
  Direccion: string;
  Correo: string;
  Encargado: string;
  Celular: string;
  Status: string;
}
export interface UsuarioABM {
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
export interface EmailModulo {
  ID: number;
  Modulo: string;
  MailSumar: string;
  MailWashinn: string;
}
export const getEdificiosABM = () =>
  authFetch<{ edificios: EdificioABM[] }>("/api/abm?edificios=1").then(
    (r) => r.edificios,
  );
export const getUsuariosABM = () =>
  authFetch<{ usuarios: UsuarioABM[] }>("/api/abm?usuarios=1").then(
    (r) => r.usuarios,
  );
export const getEmails = () =>
  authFetch<{ emails: EmailModulo[] }>("/api/abm?emails=1").then((r) => r.emails);
export const crearEdificioABM = (input: {
  codigo: string;
  edificio: string;
  direccion: string;
  correo?: string;
  encargado?: string;
  celular?: string;
  latitud?: number;
  longitud?: number;
}) =>
  authFetch<{ ok: true; id: string }>("/api/abm", {
    method: "POST",
    body: JSON.stringify({ action: "crear-edificio", ...input }),
  });
export const crearUsuarioABM = (input: {
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
  correo?: string;
  telefono?: string;
  fechaNac?: string;
  rol: string;
}) =>
  authFetch<{ ok: true; id: string }>("/api/abm", {
    method: "POST",
    body: JSON.stringify({ action: "crear-usuario", ...input }),
  });
export const setEdificioStatusABM = (id: number, status: string) =>
  authFetch<{ ok: true }>("/api/abm", {
    method: "POST",
    body: JSON.stringify({ action: "status-edificio", id, status }),
  });
export const setUsuarioStatusABM = (id: number, status: string) =>
  authFetch<{ ok: true }>("/api/abm", {
    method: "POST",
    body: JSON.stringify({ action: "status-usuario", id, status }),
  });

// --- Visitas por rutas/circuitos (16.DetallePlanificaciones / 18.EdificiosVisitar) ---
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
  coords: { lat: number; lng: number }[];
  estado: EstadoEdificio;
  idUnico?: string;
}
export interface VisitaEnCurso {
  idUnico: string;
  codigo: string;
  edificio: string;
  direccion: string;
  espontanea: boolean;
}
export interface ChecklistItemDef {
  ID: number;
  Descripcion: string;
}
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
export interface FinalizarVisitaInput {
  idUnico: string;
  items: { item: string; check: "Ok" | "No"; observacion?: string }[];
  okCount: number;
  noCount: number;
  horaInicio?: string;
  horaFinal?: string;
  observacionGeneral?: string;
  fotoGeneral?: string;
}

export const getCircuitos = () =>
  authFetch<{ circuitos: Circuito[] }>("/api/planificaciones?circuitos=1").then(
    (r) => r.circuitos,
  );
export const getEdificiosAVisitar = () =>
  authFetch<{ edificios: EdificioVisitar[] }>(
    "/api/planificaciones?edificios=1",
  ).then((r) => r.edificios);
export const getChecklistItems = () =>
  authFetch<{ items: ChecklistItemDef[] }>(
    "/api/planificaciones?checklist=1",
  ).then((r) => r.items);
// Visita "Pendiente" del técnico (si hay) — para bloquear el inicio de otra.
export const getVisitaEnCurso = () =>
  authFetch<{ visita: VisitaEnCurso | null }>(
    "/api/planificaciones?enCurso=1",
  ).then((r) => r.visita);
export const iniciarVisita = (input: IniciarVisitaInput) =>
  authFetch<{ idUnico: string; hora: string; fecha: string }>(
    "/api/planificaciones",
    { method: "POST", body: JSON.stringify({ action: "iniciar", ...input }) },
  );
export const cancelarVisita = (input: {
  codigo: string;
  edificio?: string;
  direccion?: string;
  motivo: string;
  observacion?: string;
}) =>
  authFetch<{ ok: true }>("/api/planificaciones", {
    method: "POST",
    body: JSON.stringify({ action: "cancelar", ...input }),
  });
export const finalizarVisita = (input: FinalizarVisitaInput) =>
  authFetch<{ ok: true }>("/api/planificaciones", {
    method: "POST",
    body: JSON.stringify({ action: "finalizar", ...input }),
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
  FechaIngreso_DM: string;
  Segmento_DM: string;
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
  Status: string;
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
  DescripcionCarga_IN: string;
  NoResuelto_IN: string;
  MaquinaAsignada_IN: string;
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
export const getIncidente = (id: number) =>
  authFetch<{ incidente: Incidente }>(`/api/incidentes?id=${id}`).then(
    (r) => r.incidente,
  );
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

// --- Resolución de incidentes + stock (Fase 2) ---
export interface StockTecnico {
  ID: number;
  Repuesto: string; // Concat_RT (clave que se guarda como repuesto usado)
  Codigo: string;
  Cantidad: number;
}
export interface RepuestoCatalogo {
  ID: number;
  Nombre: string;
  Codigo: string;
  Marca: string;
}
export type ResolverModo =
  | "Cambio Repuesto"
  | "Resuelto Sin Repuesto"
  | "Requiere Repuesto"
  | "Cambio de Maquina";
export interface RepuestoUsado {
  stockId?: number;
  repuesto: string;
  cantidad: number;
}
export interface ResolverIncidenteInput {
  id: number;
  modo: ResolverModo;
  Descripcion: string;
  Categoria?: string;
  maquinaAsignada?: string;
  repuestos?: RepuestoUsado[];
  // "Continuar" (revisar A-Revisar): setear máquina, foto y notificación.
  concatMaquina?: string;
  idMaquina?: string;
  nombreEdificio?: string;
  fotoBase64?: string;
  notificar?: boolean;
}

// Stock personal del técnico logueado (para "Cambio Repuesto"; solo activos con cantidad > 0).
export const getStockTecnico = () =>
  authFetch<{ stock: StockTecnico[] }>(
    "/api/incidentes?stockTecnico=1",
  ).then((r) => r.stock);
// Catálogo general de repuestos (para "Requiere Repuesto").
export const getRepuestosCatalogo = () =>
  authFetch<{ repuestos: RepuestoCatalogo[] }>(
    "/api/incidentes?catalogoRepuestos=1",
  ).then((r) => r.repuestos);
// Repuestos asociados a un incidente (13.RepuestosIncidentes) — reusa el de máquinas.
export const getRepuestosDeIncidente = (idIncidente: number) =>
  getRepuestosIncidente(idIncidente);
// Resolver un incidente según el modo (consume stock del técnico si corresponde).
export const resolverIncidente = (input: ResolverIncidenteInput) =>
  authFetch<{ ok: true; resuelto: boolean }>("/api/incidentes", {
    method: "POST",
    body: JSON.stringify({ action: "resolver", ...input }),
  });

// Alta COMPLETA (Registrar): categoría + estado/acción + repuestos + foto.
export interface CrearIncidenteCompletoInput {
  IDMaquina_IN: string;
  ConcatMaquina_IN: string;
  CodigoEdifcio_IN: string;
  NombreEdificio_IN: string;
  categoria: string;
  modo: ResolverModo;
  Descripcion: string;
  repuestos?: RepuestoUsado[];
  fotoBase64?: string;
}
export const crearIncidenteCompleto = (input: CrearIncidenteCompletoInput) =>
  authFetch<{ id: string; resuelto: boolean }>("/api/incidentes", {
    method: "POST",
    body: JSON.stringify({ action: "crearCompleto", ...input }),
  });
