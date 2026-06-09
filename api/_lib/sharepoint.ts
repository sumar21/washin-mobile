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
