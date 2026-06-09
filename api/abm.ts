// /api/abm — administración (solo Admin): Edificios, Usuarios y mails (99.ABM_Emails).
//   GET ?edificios | ?usuarios | ?emails
//   POST { action:"crear-edificio", ... } | "crear-usuario" | "status-edificio" | "status-usuario"
import {
  listEdificiosTodos,
  setEdificioStatus,
  crearEdificio,
  listUsuariosTodos,
  setUsuarioStatus,
  crearUsuario,
  listEmails,
} from "./_lib/abm.js";
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
  if (auth.rol !== "Admin") {
    send(res, 403, { error: "Solo administradores" });
    return;
  }
  try {
    if (req.method === "GET") {
      const sp = new URL(req.url ?? "", "http://localhost").searchParams;
      if (sp.has("usuarios")) {
        send(res, 200, { usuarios: await listUsuariosTodos() });
        return;
      }
      if (sp.has("emails")) {
        send(res, 200, { emails: await listEmails() });
        return;
      }
      send(res, 200, { edificios: await listEdificiosTodos() });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody<{
        action?: string;
        id?: number | string;
        status?: string;
        // crear-edificio
        codigo?: string;
        edificio?: string;
        direccion?: string;
        correo?: string;
        encargado?: string;
        celular?: string;
        latitud?: number;
        longitud?: number;
        // crear-usuario
        usuario?: string;
        password?: string;
        nombre?: string;
        apellido?: string;
        telefono?: string;
        fechaNac?: string;
        rol?: string;
      }>(req);

      if (body.action === "crear-edificio") {
        if (!body.codigo?.trim() || !body.edificio?.trim() || !body.direccion?.trim()) {
          send(res, 400, { error: "Faltan campos del edificio" });
          return;
        }
        const r = await crearEdificio({
          codigo: body.codigo,
          edificio: body.edificio,
          direccion: body.direccion,
          correo: body.correo,
          encargado: body.encargado,
          celular: body.celular,
          latitud: body.latitud,
          longitud: body.longitud,
        });
        send(res, 200, { ok: true, id: r.id });
        return;
      }

      if (body.action === "crear-usuario") {
        if (!body.usuario?.trim() || !body.nombre?.trim() || !body.apellido?.trim() || !body.rol) {
          send(res, 400, { error: "Faltan campos del usuario" });
          return;
        }
        const r = await crearUsuario({
          usuario: body.usuario,
          password: body.password ?? "",
          nombre: body.nombre,
          apellido: body.apellido,
          correo: body.correo,
          telefono: body.telefono,
          fechaNac: body.fechaNac,
          rol: body.rol,
        });
        send(res, 200, { ok: true, id: r.id });
        return;
      }

      if (body.action === "status-edificio" || body.action === "status-usuario") {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0 || !body.status) {
          send(res, 400, { error: "id o status inválido" });
          return;
        }
        if (body.action === "status-edificio") await setEdificioStatus(id, body.status);
        else await setUsuarioStatus(id, body.status);
        send(res, 200, { ok: true });
        return;
      }

      send(res, 400, { error: "action inválida" });
      return;
    }

    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error("[abm] error:", err instanceof Error ? err.message : err);
    send(res, 502, { error: "Error en ABM" });
  }
}
