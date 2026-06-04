// /api/break — descanso del usuario logueado (lista 14.HorasDescanso).
//   GET                       -> { active: { id, startedAt } | null, usedToday: boolean }
//   POST { action:"start" }   -> inicia (o devuelve el activo); 409 si ya usó el de hoy
//   POST { action:"end" }     -> finaliza el activo
// Regla de negocio: 1 descanso por día.
import {
  getBreakStatus,
  startBreak,
  endBreak,
  BreakAlreadyUsedError,
} from "./_lib/break.js";
import {
  getAuth,
  readJsonBody,
  send,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const auth = getAuth(req);
  if (!auth) {
    send(res, 401, { error: "No autorizado" });
    return;
  }
  try {
    if (req.method === "GET") {
      send(res, 200, await getBreakStatus(auth.nombre));
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody<{ action?: string }>(req);
      if (body.action === "start") {
        send(res, 200, {
          active: await startBreak(auth.nombre),
          usedToday: true,
        });
      } else if (body.action === "end") {
        await endBreak(auth.nombre);
        send(res, 200, { active: null, usedToday: true });
      } else {
        send(res, 400, { error: 'action inválida (usar "start" o "end")' });
      }
      return;
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    if (err instanceof BreakAlreadyUsedError) {
      send(res, 409, { error: err.message });
      return;
    }
    console.error("[break] error:", err instanceof Error ? err.message : err);
    send(res, 502, { error: "Error con el descanso" });
  }
}
