// /api/catalogos?tipo=edificios|marcas|motivos|usuarios
// Catálogos de referencia (datos chicos, cacheables) que reusan varias pantallas.
// Equivale a las colecciones del App.OnStart de PowerApps.
import {
  listEdificios,
  listMarcasModelos,
  listMotivosCancelacion,
} from "./_lib/catalogos.js";
import { listActiveUsuarios } from "./_lib/users.js";
import {
  getAuth,
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
  if (req.method !== "GET") {
    send(res, 405, { error: "Método no permitido" });
    return;
  }
  const tipo = new URL(req.url ?? "", "http://localhost").searchParams.get(
    "tipo",
  );
  try {
    switch (tipo) {
      case "edificios":
        send(res, 200, { items: await listEdificios() });
        return;
      case "marcas":
        send(res, 200, { items: await listMarcasModelos() });
        return;
      case "motivos":
        send(res, 200, { items: await listMotivosCancelacion() });
        return;
      case "usuarios":
        send(res, 200, { items: await listActiveUsuarios() });
        return;
      default:
        send(res, 400, {
          error:
            'tipo inválido (usar "edificios", "marcas", "motivos" o "usuarios")',
        });
    }
  } catch (err) {
    console.error(
      "[catalogos] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error consultando catálogos" });
  }
}
