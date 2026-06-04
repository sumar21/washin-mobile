// /api/maquinas — Detalle de Máquina y su historial (incidentes de la máquina).
//   GET                          -> { maquinas: [...] }          (08.DetalleMaquina)
//   GET ?historial=<IDMaquina_DM> -> { historial: [...] }        (10.Incidentes de la máquina)
//   GET ?repuestos=<idIncidente> -> { repuestos: [...] }         (13.RepuestosIncidentes)
import {
  listDetalleMaquina,
  listHistorialMaquina,
  listRepuestosIncidente,
} from "./_lib/maquinas.js";
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
  const params = new URL(req.url ?? "", "http://localhost").searchParams;
  const historial = params.get("historial");
  const repuestos = params.get("repuestos");
  try {
    if (historial) {
      send(res, 200, { historial: await listHistorialMaquina(historial) });
      return;
    }
    if (repuestos) {
      const id = Number(repuestos);
      if (!Number.isFinite(id) || id <= 0) {
        send(res, 400, { error: "repuestos (id de incidente) inválido" });
        return;
      }
      send(res, 200, { repuestos: await listRepuestosIncidente(id) });
      return;
    }
    send(res, 200, {
      maquinas: await listDetalleMaquina({
        edificio: params.get("edificio") || undefined,
        modelo: params.get("modelo") || undefined,
        marca: params.get("marca") || undefined,
      }),
    });
  } catch (err) {
    console.error(
      "[maquinas] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error consultando máquinas" });
  }
}
