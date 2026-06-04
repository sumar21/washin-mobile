// POST /api/login  { usuario, password } -> { user, token }
// Valida credenciales contra la lista SharePoint "Usuarios" (solo Status ALTA/Activo).
import { getEnv } from "./_lib/env.js";
import { signJwt } from "./_lib/jwt.js";
import { authenticateUser } from "./_lib/users.js";
import { readJsonBody, send, type ApiRequest, type ApiResponse } from "./_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    send(res, 405, { error: "Método no permitido" });
    return;
  }

  let body: { usuario?: string; password?: string };
  try {
    body = await readJsonBody(req);
  } catch {
    send(res, 400, { error: "JSON inválido" });
    return;
  }

  const usuario = (body.usuario ?? "").trim();
  const password = body.password ?? "";
  if (!usuario || !password) {
    send(res, 400, { error: "Faltan usuario y/o contraseña" });
    return;
  }

  try {
    const user = await authenticateUser(usuario, password);
    if (!user) {
      send(res, 401, { error: "Usuario o contraseña incorrectos" });
      return;
    }
    const token = signJwt(
      {
        sub: String(user.ID),
        usuario: user.Usuario,
        rol: user.Rol,
        nombre: user.Concat_Nombre_Apellido,
      },
      getEnv().AUTH_SECRET,
    );
    send(res, 200, { user, token });
  } catch (err) {
    console.error("[login] error:", err instanceof Error ? err.message : err);
    send(res, 502, { error: "Error consultando el backend de datos" });
  }
}
