// GET /api/home -> KPIs + registros del día + módulos por rol (scoped por el JWT).
import { buildHome } from "./_lib/home.js";
import { getAuth, send, type ApiRequest, type ApiResponse } from "./_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") {
    send(res, 405, { error: "Método no permitido" });
    return;
  }
  const auth = getAuth(req);
  if (!auth) {
    send(res, 401, { error: "No autorizado" });
    return;
  }
  try {
    const data = await buildHome({
      rol: auth.rol,
      usuario: auth.usuario,
      nombre: auth.nombre,
      sub: auth.sub,
    });
    send(res, 200, data);
  } catch (err) {
    console.error("[home] error:", err instanceof Error ? err.message : err);
    send(res, 502, { error: "Error consultando los datos del Home" });
  }
}
