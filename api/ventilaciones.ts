// /api/ventilaciones — worklist de ventilaciones del usuario (lista 19.Ventilaciones).
//   GET                                          -> { ventilaciones: [...] }
//   GET ?pendientes                              -> { ventilaciones: [...] }  (Estado="Pendiente"; combo "Adelantar")
//   POST { id, action:"programar", fechaProgramada } -> programa la visita
//   POST { id, action:"finalizar", observacion }     -> finaliza la ventilación
//   POST { id, action:"adelantar", observacion }     -> adelanta una pendiente existente (desde Incidentes)
import {
  listVentilaciones,
  listVentilacionesPendientes,
  programarVentilacion,
  finalizarVentilacion,
  adelantarVentilacion,
  crearVentilacion,
} from "./_lib/ventilaciones.js";
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
      const sp = new URL(req.url ?? "", "http://localhost").searchParams;
      // Combo "Adelantar Ventilación" (Incidentes): todas las pendientes, sin scope por técnico
      // (paridad PA: CollectVentilacionesPendientes = Filter('19.Ventilaciones', Estado_VE="Pendiente")).
      if (sp.has("pendientes")) {
        send(res, 200, { ventilaciones: await listVentilacionesPendientes() });
        return;
      }
      const ventilaciones = await listVentilaciones({
        rol: auth.rol,
        sub: auth.sub,
      });
      send(res, 200, { ventilaciones });
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody<{
        id?: number | string;
        action?: string;
        fechaProgramada?: string;
        observacion?: string;
        // crear (desde incidente)
        edificio?: string;
        idEdificio?: number;
        grupo?: string;
        frecuencia?: number;
      }>(req);
      // Crear no requiere id.
      if (body.action === "crear") {
        if (!body.edificio?.trim()) {
          send(res, 400, { error: "Falta el edificio" });
          return;
        }
        const { id: nuevoId } = await crearVentilacion(
          {
            edificio: body.edificio,
            idEdificio: body.idEdificio,
            grupo: body.grupo,
            frecuencia: body.frecuencia,
            observacion: body.observacion,
          },
          { nombre: auth.nombre, sub: auth.sub },
        );
        send(res, 200, { ok: true, id: nuevoId });
        return;
      }
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        send(res, 400, { error: "id inválido" });
        return;
      }
      if (body.action === "programar") {
        if (!body.fechaProgramada) {
          send(res, 400, { error: "Falta la fecha programada" });
          return;
        }
        await programarVentilacion(id, body.fechaProgramada);
        send(res, 200, { ok: true });
      } else if (body.action === "finalizar") {
        if (!body.observacion?.trim()) {
          send(res, 400, { error: "Falta la observación" });
          return;
        }
        await finalizarVentilacion(id, body.observacion);
        send(res, 200, { ok: true });
      } else if (body.action === "adelantar") {
        // Adelanta una ventilación PENDIENTE existente (desde Incidentes). PA no exige observación.
        await adelantarVentilacion(id, body.observacion ?? "");
        send(res, 200, { ok: true });
      } else {
        send(res, 400, {
          error: 'action inválida (usar "programar", "finalizar" o "adelantar")',
        });
      }
      return;
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error(
      "[ventilaciones] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error con las ventilaciones" });
  }
}
