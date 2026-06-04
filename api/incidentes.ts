// /api/incidentes — módulo Incidentes (10.Incidentes). Ver docs/powerapps/incidentes.md.
//   GET ?resuelto=NO|SI            -> { incidentes: [...] }  (NO = activos; scopeado por técnico)
//   POST { action:"crear", ... }   -> { id }                (alta de incidente)
//   POST { action:"anular", id, motivo } -> { ok: true }
import {
  listIncidentes,
  crearIncidente,
  anularIncidente,
} from "./_lib/incidentes.js";
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
      const resuelto =
        new URL(req.url ?? "", "http://localhost").searchParams.get(
          "resuelto",
        ) === "SI"
          ? "SI"
          : "NO";
      const incidentes = await listIncidentes({
        rol: auth.rol,
        usuario: auth.usuario,
        nombre: auth.nombre,
        resuelto,
      });
      send(res, 200, { incidentes });
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody<{
        action?: string;
        id?: number | string;
        motivo?: string;
        IDMaquina_IN?: string;
        ConcatMaquina_IN?: string;
        CodigoEdifcio_IN?: string;
        NombreEdificio_IN?: string;
        TecnicoAsignado_IN?: string;
        Descripcion?: string;
        Categoria?: string;
      }>(req);
      if (body.action === "crear") {
        if (!body.Descripcion?.trim()) {
          send(res, 400, { error: "Falta la descripción" });
          return;
        }
        const { id } = await crearIncidente(
          {
            IDMaquina_IN: body.IDMaquina_IN ?? "",
            ConcatMaquina_IN: body.ConcatMaquina_IN ?? "",
            CodigoEdifcio_IN: body.CodigoEdifcio_IN ?? "",
            NombreEdificio_IN: body.NombreEdificio_IN ?? "",
            TecnicoAsignado_IN: body.TecnicoAsignado_IN ?? "",
            Descripcion: body.Descripcion,
            Categoria: body.Categoria,
          },
          { usuario: auth.usuario },
        );
        send(res, 200, { id });
        return;
      }
      if (body.action === "anular") {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0) {
          send(res, 400, { error: "id inválido" });
          return;
        }
        if (!body.motivo?.trim()) {
          send(res, 400, { error: "Falta el motivo de anulación" });
          return;
        }
        await anularIncidente(id, body.motivo);
        send(res, 200, { ok: true });
        return;
      }
      send(res, 400, { error: 'action inválida (usar "crear" o "anular")' });
      return;
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error(
      "[incidentes] error:",
      err instanceof Error ? err.message : err,
    );
    send(res, 502, { error: "Error con los incidentes" });
  }
}
