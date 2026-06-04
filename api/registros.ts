// /api/registros — acciones sobre los registros del día.
//   POST { id, action:"anular" } -> marca el registro como "Anulado".
// Solo Admin/Supervisor (los técnicos no pueden anular registros).
import { anularRegistro } from "./_lib/registros.js";
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
  if (req.method !== "POST") {
    send(res, 405, { error: "Método no permitido" });
    return;
  }
  if (auth.rol !== "Admin" && auth.rol !== "Supervisor") {
    send(res, 403, { error: "No autorizado para anular registros" });
    return;
  }
  try {
    const body = await readJsonBody<{ id?: number | string; action?: string }>(
      req,
    );
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      send(res, 400, { error: "id inválido" });
      return;
    }
    if (body.action !== "anular") {
      send(res, 400, { error: 'action inválida (usar "anular")' });
      return;
    }
    await anularRegistro(id);
    send(res, 200, { ok: true, id, estado: "Anulado" });
  } catch (err) {
    console.error(
      "[registros] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "No se pudo anular el registro" });
  }
}
