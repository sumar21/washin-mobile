// Helpers de acceso a listas SharePoint vía Graph.
import { getEnv } from "./env.js";
import { graph, graphAll } from "./graph.js";

export interface ListItem<F = Record<string, unknown>> {
  id: string;
  fields: F;
}

function siteSegment(): string {
  return `/sites/${getEnv().SHAREPOINT_SITE_ID}`;
}

// Resuelve el id de una lista por su displayName (cacheado por nombre).
const listIdCache = new Map<string, string>();

export async function resolveListId(displayName: string): Promise<string> {
  const hit = listIdCache.get(displayName);
  if (hit) return hit;
  const lists = await graphAll<{ id: string; displayName: string }>(
    `${siteSegment()}/lists?$select=id,displayName&$top=200`,
  );
  for (const l of lists) listIdCache.set(l.displayName, l.id);
  const found = listIdCache.get(displayName);
  if (!found) throw new Error(`Lista no encontrada: ${displayName}`);
  return found;
}

// Trae todos los ítems de una lista, expandiendo solo los campos pedidos.
export async function getListItems<F = Record<string, unknown>>(
  listId: string,
  fieldNames: string[],
): Promise<ListItem<F>[]> {
  const select = fieldNames.join(",");
  const items = await graphAll<{ id: string; fields: F }>(
    `${siteSegment()}/lists/${listId}/items?$expand=fields($select=${select})&$top=999`,
  );
  return items.map((i) => ({ id: i.id, fields: i.fields }));
}

// Header de respaldo: permite filtrar columnas NO indexadas en listas grandes.
// Ideal: indexar las columnas en SP (más rápido y confiable). Mientras tanto, esto evita
// el error de "umbral de vista de lista" (puede ser lento / fallar de forma intermitente).
const PREFER_NONINDEXED = { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" };

// Escapa comillas simples en valores OData (nombres con coma/apóstrofo).
export function escapeODataValue(v: string): string {
  return v.replace(/'/g, "''");
}

// Trae ítems filtrados por `$filter` (referenciando `fields/Col`), con campos seleccionados.
export async function getListItemsFiltered<F = Record<string, unknown>>(
  listId: string,
  fieldNames: string[],
  filter: string,
): Promise<ListItem<F>[]> {
  const select = fieldNames.join(",");
  const url =
    `${siteSegment()}/lists/${listId}/items` +
    `?$expand=fields($select=${select})&$filter=${encodeURIComponent(filter)}&$top=999`;
  const items = await graphAll<{ id: string; fields: F }>(url, { headers: PREFER_NONINDEXED });
  return items.map((i) => ({ id: i.id, fields: i.fields }));
}

// Trae un único ítem por su id, expandiendo solo los campos pedidos. null si no existe.
export async function getListItem<F = Record<string, unknown>>(
  listId: string,
  itemId: string,
  fieldNames: string[],
): Promise<ListItem<F> | null> {
  const select = fieldNames.join(",");
  try {
    const it = await graph<{ id: string; fields: F }>(
      `${siteSegment()}/lists/${listId}/items/${itemId}?$expand=fields($select=${select})`,
    );
    return { id: it.id, fields: it.fields };
  } catch (err) {
    // Solo "no existe" (404) → null. Errores transitorios (403/429/5xx/timeout) se propagan,
    // para no confundir un fallo de red con "el ítem no existe".
    if (err instanceof Error && /\bGraph 404\b/.test(err.message)) return null;
    throw err;
  }
}

// Cuenta ítems que matchean `$filter` (paginando solo ids).
export async function countItems(listId: string, filter: string): Promise<number> {
  const url =
    `${siteSegment()}/lists/${listId}/items` +
    `?$select=id&$filter=${encodeURIComponent(filter)}&$top=999`;
  const items = await graphAll<{ id: string }>(url, { headers: PREFER_NONINDEXED });
  return items.length;
}

// Crea un ítem (POST). Requiere permiso de escritura (Sites.ReadWrite.All).
export async function createItem(
  listId: string,
  fields: Record<string, unknown>,
): Promise<{ id: string }> {
  return graph<{ id: string }>(`${siteSegment()}/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

// Actualiza los campos de un ítem (PATCH).
export async function patchItemFields(
  listId: string,
  itemId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await graph(`${siteSegment()}/lists/${listId}/items/${itemId}/fields`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Conectividad: nombre del sitio (para /api/health).
export async function getSiteInfo(): Promise<{ name: string; webUrl: string }> {
  const site = await graph<{ displayName: string; webUrl: string }>(
    `${siteSegment()}?$select=displayName,webUrl`,
  );
  return { name: site.displayName, webUrl: site.webUrl };
}

// ── Biblioteca de documentos (drive del sitio) ────────────────────────────────
// Las fotos de incidentes viven como base64 DENTRO de una columna de lista
// (12.FotoIncidentes.Foto_FI, ~380KB por fila). Para novedades no alcanza: un video de celular
// son 5-20 MB, muy por encima de lo que tolera una columna de texto y del límite de 4,5 MB que
// Vercel le pone al body de una función serverless. Por eso la evidencia va a la biblioteca
// "Documentos" del sitio y la lista sólo guarda la ruta de la carpeta.

/** Un archivo de evidencia ya subido. */
export interface ArchivoEvidencia {
  id: string;
  nombre: string;
  tamano: number;
  mime: string;
  /** URL de descarga directa, de vida corta (la firma Graph, ~1h). */
  url?: string;
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string };
  "@microsoft.graph.downloadUrl"?: string;
}

/** Escapa una ruta para el direccionamiento `root:/<ruta>:` de Graph. */
function rutaDrive(ruta: string): string {
  return ruta.split("/").map(encodeURIComponent).join("/");
}

/**
 * Abre una sesión de carga y devuelve la URL a la que el CLIENTE sube los bytes.
 *
 * La `uploadUrl` viene pre-autenticada: acepta PUT sin el token de la app, así que el celular
 * sube el archivo directo a SharePoint. Eso evita las dos cosas que romperían el flujo si el
 * archivo pasara por nuestra API: el tope de 4,5 MB del body en Vercel, y exponer el secreto.
 * Verificado contra el tenant con un archivo de 6 MB.
 */
export async function crearSesionDeCarga(
  carpeta: string,
  nombreArchivo: string,
): Promise<{ uploadUrl: string; expira: string }> {
  const r = await graph<{ uploadUrl: string; expirationDateTime: string }>(
    `${siteSegment()}/drive/root:/${rutaDrive(`${carpeta}/${nombreArchivo}`)}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `rename` y no `replace`: dos fotos sacadas en el mismo segundo no se pisan entre sí.
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
    },
  );
  return { uploadUrl: r.uploadUrl, expira: r.expirationDateTime };
}

/** Lista los archivos de una carpeta. Devuelve [] si la carpeta todavía no existe. */
export async function listarCarpeta(carpeta: string): Promise<ArchivoEvidencia[]> {
  try {
    const r = await graph<{ value?: DriveItem[] }>(
      `${siteSegment()}/drive/root:/${rutaDrive(carpeta)}:/children` +
        `?$select=id,name,size,file,@microsoft.graph.downloadUrl&$top=100`,
    );
    return (r.value ?? [])
      .filter((x) => x.file) // descarta subcarpetas
      .map((x) => ({
        id: x.id,
        nombre: x.name,
        tamano: x.size ?? 0,
        mime: x.file?.mimeType ?? "application/octet-stream",
        url: x["@microsoft.graph.downloadUrl"],
      }));
  } catch (err) {
    // Carpeta inexistente = novedad sin evidencia, no es un error.
    if (err instanceof Error && err.message.includes("Graph 404")) return [];
    throw err;
  }
}

/**
 * Cuántos archivos tiene cada subcarpeta de `raiz`, en UNA sola llamada.
 *
 * Graph devuelve `folder.childCount` por cada subcarpeta, así que el contador de adjuntos de
 * todas las novedades sale de un request. Por eso la lista NO guarda una columna con el número:
 * un contador guardado hay que mantenerlo sincronizado y se desfasa en cuanto una subida falla
 * a mitad; esto siempre dice lo que realmente hay.
 */
export async function contarPorSubcarpeta(raiz: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const r = await graph<{ value?: { name: string; folder?: { childCount?: number } }[] }>(
      `${siteSegment()}/drive/root:/${rutaDrive(raiz)}:/children?$select=name,folder&$top=999`,
    );
    for (const x of r.value ?? []) {
      if (x.folder) out.set(x.name, x.folder.childCount ?? 0);
    }
  } catch (err) {
    // Todavía no se subió ninguna evidencia: la raíz no existe y no hay nada que contar.
    if (!(err instanceof Error && err.message.includes("Graph 404"))) throw err;
  }
  return out;
}
