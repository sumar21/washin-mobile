// Descansos sobre la lista "14.HorasDescanso". Requiere permiso de escritura
// (Sites.ReadWrite.All) para start/end; el GET (activo) solo lee.
//
// IMPORTANTE (paridad PowerApps): User_HD se scopea por el LOGIN (VarUsuario = input_usuario_SL.Text,
// p.ej. "Josrojas"), NO por el Concat_Nombre_Apellido. Antes acá se usaba auth.nombre (el Concat),
// lo que rompía la convivencia con PowerApps sobre la misma lista y el dedupe "1x día".
import {
  resolveListId,
  createItem,
  patchItemFields,
  escapeODataValue,
} from "./sharepoint.js";
import { graphAll } from "./graph.js";
import { getEnv } from "./env.js";
import { todayAr, nowTimeAr, arParts, APP_VERSION } from "./time.js";

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

// `usuario` = LOGIN del técnico (claim `usuario` del JWT). Se guarda/lee en User_HD.
async function findActiveRaw(
  usuario: string,
): Promise<{ id: string; createdDateTime: string } | null> {
  const listId = await resolveListId(L);
  const site = `/sites/${getEnv().SHAREPOINT_SITE_ID}`;
  const filter = `fields/User_HD eq '${escapeODataValue(usuario)}' and fields/Status_HD eq 'Activo'`;
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
async function countBreaksToday(usuario: string): Promise<number> {
  const listId = await resolveListId(L);
  const site = `/sites/${getEnv().SHAREPOINT_SITE_ID}`;
  const filter = `fields/User_HD eq '${escapeODataValue(usuario)}' and fields/Fecha_HD eq '${escapeODataValue(todayAr())}'`;
  const url =
    `${site}/lists/${listId}/items` +
    `?$select=id&$filter=${encodeURIComponent(filter)}&$top=20`;
  const items = await graphAll<{ id: string }>(url, { headers: PREFER });
  return items.length;
}

export async function getActiveBreak(
  usuario: string,
): Promise<ActiveBreak | null> {
  const a = await findActiveRaw(usuario);
  return a ? { id: a.id, startedAt: a.createdDateTime } : null;
}

export async function getBreakStatus(usuario: string): Promise<BreakStatus> {
  const active = await getActiveBreak(usuario);
  if (active) return { active, usedToday: true };
  return { active: null, usedToday: (await countBreaksToday(usuario)) > 0 };
}

export async function startBreak(usuario: string): Promise<ActiveBreak> {
  const existing = await getActiveBreak(usuario);
  if (existing) return existing; // idempotente: si ya hay uno activo, lo devuelve
  // Regla: 1 descanso por día. Si ya hubo uno hoy (finalizado), no se permite otro.
  if ((await countBreaksToday(usuario)) > 0) throw new BreakAlreadyUsedError();
  const listId = await resolveListId(L);
  const { fecha, mesAno, ano } = arParts(new Date());
  // PA (bt_aceptarIniciarDescanso): Título="sumar", User_HD, Fecha_HD, FechaAno_HD,
  // FechaMes_HD = Text(Today(),"[$-es-ES]mm/yyyy") → "mm/yyyy", HoraInicio_HD,
  // Status_HD="Activo", Version_HD.
  const created = await createItem(listId, {
    Title: "sumar",
    User_HD: usuario,
    Fecha_HD: fecha,
    FechaAno_HD: ano,
    FechaMes_HD: mesAno,
    HoraInicio_HD: nowTimeAr(),
    Status_HD: "Activo",
    Version_HD: APP_VERSION,
  });
  const active = await getActiveBreak(usuario);
  return active ?? { id: created.id, startedAt: new Date().toISOString() };
}

export async function endBreak(usuario: string): Promise<{ ended: boolean }> {
  const a = await findActiveRaw(usuario);
  if (!a) return { ended: false };
  const listId = await resolveListId(L);
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(a.createdDateTime).getTime()) / 60000),
  );
  // PA escribe la diferencia en horas (DifHora_HD) y en minutos (DifHoraMinutos_HD).
  // PA usa DateDiff(..., TimeUnit.Hours) que devuelve horas ENTERAS truncadas (90 min → "1").
  await patchItemFields(listId, a.id, {
    HoraFin_HD: nowTimeAr(),
    Status_HD: "Finalizado",
    DifHora_HD: String(Math.floor(minutes / 60)),
    DifHoraMinutos_HD: String(minutes),
  });
  return { ended: true };
}
