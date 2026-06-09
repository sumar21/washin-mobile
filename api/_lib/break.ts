// Descansos sobre la lista "14.HorasDescanso". Requiere permiso de escritura
// (Sites.ReadWrite.All) para start/end; el GET (activo) solo lee.
import {
  resolveListId,
  createItem,
  patchItemFields,
  escapeODataValue,
} from "./sharepoint.js";
import { graphAll } from "./graph.js";
import { getEnv } from "./env.js";
import { todayAr, nowTimeAr } from "./time.js";

const L = "14.HorasDescanso";
const PREFER = { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" };

export interface ActiveBreak {
  id: string;
  startedAt: string; // ISO (createdDateTime del ítem)
}

export interface BreakStatus {
  active: ActiveBreak | null;
  usedToday: boolean; // ya hubo un descanso hoy (activo o finalizado) → no se puede iniciar otro
}

// Se permite UN solo descanso por día. Esta clase se lanza si ya se usó el de hoy.
export class BreakAlreadyUsedError extends Error {
  constructor() {
    super("Ya registraste tu descanso de hoy");
    this.name = "BreakAlreadyUsedError";
  }
}

async function findActiveRaw(
  nombre: string,
): Promise<{ id: string; createdDateTime: string } | null> {
  const listId = await resolveListId(L);
  const site = `/sites/${getEnv().SHAREPOINT_SITE_ID}`;
  const filter = `fields/User_HD eq '${escapeODataValue(nombre)}' and fields/Status_HD eq 'Activo'`;
  const url =
    `${site}/lists/${listId}/items` +
    `?$select=id,createdDateTime&$expand=fields($select=Status_HD)&$filter=${encodeURIComponent(filter)}&$top=20`;
  const items = await graphAll<{ id: string; createdDateTime: string }>(url, {
    headers: PREFER,
  });
  if (!items.length) return null;
  // El más reciente de forma determinista (graphAll no garantiza el orden de salida).
  items.sort(
    (a, b) =>
      new Date(b.createdDateTime).getTime() -
      new Date(a.createdDateTime).getTime(),
  );
  return items[0];
}

// Cuenta descansos del usuario para HOY (cualquier estado): si hay ≥1, ya consumió el del día.
async function countBreaksToday(nombre: string): Promise<number> {
  const listId = await resolveListId(L);
  const site = `/sites/${getEnv().SHAREPOINT_SITE_ID}`;
  const filter = `fields/User_HD eq '${escapeODataValue(nombre)}' and fields/Fecha_HD eq '${escapeODataValue(todayAr())}'`;
  const url =
    `${site}/lists/${listId}/items` +
    `?$select=id&$filter=${encodeURIComponent(filter)}&$top=20`;
  const items = await graphAll<{ id: string }>(url, { headers: PREFER });
  return items.length;
}

export async function getActiveBreak(
  nombre: string,
): Promise<ActiveBreak | null> {
  const a = await findActiveRaw(nombre);
  return a ? { id: a.id, startedAt: a.createdDateTime } : null;
}

export async function getBreakStatus(nombre: string): Promise<BreakStatus> {
  const active = await getActiveBreak(nombre);
  if (active) return { active, usedToday: true };
  return { active: null, usedToday: (await countBreaksToday(nombre)) > 0 };
}

export async function startBreak(nombre: string): Promise<ActiveBreak> {
  const existing = await getActiveBreak(nombre);
  if (existing) return existing; // idempotente: si ya hay uno activo, lo devuelve
  // Regla: 1 descanso por día. Si ya hubo uno hoy (finalizado), no se permite otro.
  if ((await countBreaksToday(nombre)) > 0) throw new BreakAlreadyUsedError();
  const listId = await resolveListId(L);
  const created = await createItem(listId, {
    Title: nombre,
    User_HD: nombre,
    Fecha_HD: todayAr(),
    HoraInicio_HD: nowTimeAr(),
    Status_HD: "Activo",
  });
  const active = await getActiveBreak(nombre);
  return active ?? { id: created.id, startedAt: new Date().toISOString() };
}

export async function endBreak(nombre: string): Promise<{ ended: boolean }> {
  const a = await findActiveRaw(nombre);
  if (!a) return { ended: false };
  const listId = await resolveListId(L);
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(a.createdDateTime).getTime()) / 60000),
  );
  await patchItemFields(listId, a.id, {
    HoraFin_HD: nowTimeAr(),
    Status_HD: "Finalizado",
    DifHoraMinutos_HD: String(minutes),
  });
  return { ended: true };
}
