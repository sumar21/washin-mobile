// Novedades (lista 20.Novedades): el técnico reporta desde la mobile algo del edificio que no es
// una OT de máquina —tacho roto, sticker despegado, cartelería— y el back-office lo ve, compra el
// recurso y da el OK. Reemplaza el grupo de WhatsApp donde esto se informaba suelto.
//
// NO es un incidente: no toca máquinas, no consume stock, no entra en el circuito de aprobaciones.
// Se mantuvo deliberadamente aparte de 10.Incidentes para no ensuciar los KPI de OTs ni la grilla
// de gerencia, que ya distingue origen por NoResuelto_IN.
//
// ⚠️ Las columnas de acá son EXACTAMENTE las que existen en la lista. Escribir a una columna que
// no existe no falla sola: hace fallar el POST/PATCH entero (§3 del CLAUDE.md raíz). No agregues
// campos sin haberlos creado antes en SharePoint.
//
// La evidencia (foto o VIDEO) vive en la biblioteca "Documentos", carpeta `Novedades/<id>`, no en
// una columna base64 como 12.FotoIncidentes: ver el comentario de crearSesionDeCarga.
import {
  resolveListId,
  getListItems,
  getListItem,
  createItem,
  patchItemFields,
  crearSesionDeCarga,
  listarCarpeta,
  contarPorSubcarpeta,
  type ListItem,
  type ArchivoEvidencia,
} from "./sharepoint.js";
import { todayAr, nowTimeAr, arParts, APP_VERSION } from "./time.js";

const LISTA = "20.Novedades";

/**
 * Raíz en la biblioteca de documentos. Las carpetas se crean solas al subir el primer archivo.
 * La ruta se DERIVA del id de la novedad: no hace falta guardarla en una columna, y así no puede
 * quedar apuntando a otro lado.
 */
export const CARPETA_RAIZ = "Novedades";
export const carpetaDe = (id: string | number) => `${CARPETA_RAIZ}/${id}`;

/**
 * Estados. `Pendiente` la crea el técnico; `Resuelto` lo pone el back-office cuando el recurso
 * está listo; `Anulado` es para descartar una novedad sin resolverla (duplicada, error de carga).
 *
 * Se separa `Anulado` de `Resuelto` a propósito: mezclarlos es exactamente el problema que hoy
 * tienen los incidentes anulados, que siguen entrando en las queries de activos (ver §6.11 del
 * CLAUDE.md raíz). Los consumidores filtran por Estado_NV, nunca por ausencia de fecha.
 */
export const ESTADOS_NOVEDAD = ["Pendiente", "Resuelto", "Anulado"] as const;
export type EstadoNovedad = (typeof ESTADOS_NOVEDAD)[number];
export function esEstadoValido(v: unknown): v is EstadoNovedad {
  return typeof v === "string" && (ESTADOS_NOVEDAD as readonly string[]).includes(v);
}

interface NovedadFields {
  Edificio_NV?: string;
  CodigoEdificio_NV?: string;
  Descripcion_NV?: string;
  Estado_NV?: string;
  Fecha_NV?: string;
  FechaMesAno_NV?: string;
  FechaAno_NV?: string;
  Hora_NV?: string;
  User_NV?: string;
  FechaResuelto_NV?: string;
  HoraResuelto_NV?: string;
  UserResuelto_NV?: string;
  DescripcionResuelto_NV?: string;
  Version_NV?: string;
  VersionResuelto_NV?: string;
}

export interface Novedad {
  id: string;
  edificio: string;
  codigoEdificio: string;
  descripcion: string;
  estado: string;
  fecha: string;
  hora: string;
  usuario: string;
  /** Calculado del drive, no guardado en la lista (ver contarPorSubcarpeta). */
  cantidadEvidencia: number;
  fechaResuelto?: string;
  horaResuelto?: string;
  usuarioResuelto?: string;
  descripcionResuelto?: string;
}

const SELECT = [
  "Edificio_NV", "CodigoEdificio_NV", "Descripcion_NV", "Estado_NV",
  "Fecha_NV", "FechaMesAno_NV", "Hora_NV", "User_NV",
  "FechaResuelto_NV", "HoraResuelto_NV", "UserResuelto_NV", "DescripcionResuelto_NV",
];

const txt = (v: unknown) => String(v ?? "").trim();

export function mapNovedad(it: ListItem<NovedadFields>, evidencia = 0): Novedad {
  const f = it.fields ?? {};
  return {
    id: it.id,
    edificio: txt(f.Edificio_NV),
    codigoEdificio: txt(f.CodigoEdificio_NV),
    descripcion: txt(f.Descripcion_NV),
    estado: txt(f.Estado_NV) || "Pendiente",
    fecha: txt(f.Fecha_NV),
    hora: txt(f.Hora_NV),
    usuario: txt(f.User_NV),
    cantidadEvidencia: evidencia,
    fechaResuelto: txt(f.FechaResuelto_NV) || undefined,
    horaResuelto: txt(f.HoraResuelto_NV) || undefined,
    usuarioResuelto: txt(f.UserResuelto_NV) || undefined,
    descripcionResuelto: txt(f.DescripcionResuelto_NV) || undefined,
  };
}

/**
 * Novedades PENDIENTES cargadas por un técnico, la más nueva primero.
 *
 * Dos recortes, los dos a propósito:
 *  · SÓLO las propias — el técnico no ve lo que reportaron los demás.
 *  · SÓLO `Pendiente` — una vez que el back-office da el OK o la anula, el circuito termina ahí
 *    (confirmado con Paul) y la novedad sale de la vista del técnico. Su listado es una bandeja
 *    de lo que todavía está abierto, no un historial.
 *
 * Se filtra EN MEMORIA y no con `$filter`: User_NV y Estado_NV son columnas nuevas sin indexar, y
 * combinar dos columnas no indexadas con `and` devuelve 400 (§3 del CLAUDE.md raíz). Mientras la
 * lista sea chica esto es más barato que el riesgo. Si crece, indexar User_NV y Estado_NV.
 */
export async function listarNovedadesDeTecnico(usuario: string): Promise<Novedad[]> {
  const listId = await resolveListId(LISTA);
  const [items, conteos] = await Promise.all([
    getListItems<NovedadFields>(listId, SELECT),
    contarPorSubcarpeta(CARPETA_RAIZ),
  ]);
  const u = usuario.trim().toLowerCase();
  return items
    .map((it) => mapNovedad(it, conteos.get(it.id) ?? 0))
    .filter((n) => n.usuario.toLowerCase() === u && n.estado === "Pendiente")
    .sort((a, b) => Number(b.id) - Number(a.id));
}

export interface CrearNovedadInput {
  edificio: string;
  codigoEdificio: string;
  descripcion: string;
  usuario: string;
}

/** Crea la novedad en Pendiente. La evidencia se sube DESPUÉS, contra la carpeta de este id. */
export async function crearNovedad(input: CrearNovedadInput): Promise<Novedad> {
  const listId = await resolveListId(LISTA);
  const { fecha, mesAno, ano } = arParts(new Date());
  const hora = nowTimeAr();
  const created = await createItem(listId, {
    Title: "[sumar]",
    Edificio_NV: input.edificio,
    CodigoEdificio_NV: input.codigoEdificio,
    Descripcion_NV: input.descripcion,
    Estado_NV: "Pendiente",
    Fecha_NV: fecha,
    FechaMesAno_NV: mesAno,
    FechaAno_NV: ano,
    Hora_NV: hora,
    User_NV: input.usuario,
    Version_NV: APP_VERSION,
  });
  return {
    id: created.id,
    edificio: input.edificio,
    codigoEdificio: input.codigoEdificio,
    descripcion: input.descripcion,
    estado: "Pendiente",
    fecha,
    hora,
    usuario: input.usuario,
    cantidadEvidencia: 0,
  };
}

/** Abre la sesión de carga para un archivo de evidencia de una novedad. */
export async function sesionDeCargaEvidencia(
  novedadId: string,
  nombreArchivo: string,
): Promise<{ uploadUrl: string; expira: string }> {
  return crearSesionDeCarga(carpetaDe(novedadId), nombreArchivo);
}

/** Evidencia de una novedad, con URLs de descarga de vida corta. */
export async function evidenciaDe(novedadId: string): Promise<ArchivoEvidencia[]> {
  return listarCarpeta(carpetaDe(novedadId));
}

export async function obtenerNovedad(id: string): Promise<Novedad | null> {
  const listId = await resolveListId(LISTA);
  const it = await getListItem<NovedadFields>(listId, id, SELECT);
  return it ? mapNovedad(it) : null;
}

/**
 * Cambia el estado. La usan las DOS apps, así que vive acá y no en el handler:
 * el escritorio resuelve (da el OK) y la mobile podría anular una propia.
 */
export async function cambiarEstadoNovedad(
  id: string,
  estado: EstadoNovedad,
  usuario: string,
  comentario?: string,
): Promise<void> {
  const listId = await resolveListId(LISTA);
  const campos: Record<string, string> = {
    Estado_NV: estado,
    UserResuelto_NV: usuario,
    FechaResuelto_NV: todayAr(),
    HoraResuelto_NV: nowTimeAr(),
    VersionResuelto_NV: APP_VERSION,
  };
  if (comentario !== undefined) campos.DescripcionResuelto_NV = comentario;
  await patchItemFields(listId, id, campos);
}
