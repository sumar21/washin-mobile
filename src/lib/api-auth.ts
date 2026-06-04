// Cliente del endpoint de login (POST /api/login). Reemplaza al mock `authenticate`
// cuando el backend SharePoint esté disponible. El usuario devuelto es compatible
// con el store de sesión (sin Password).
import type { Usuario } from "@/data/types";

export type SessionUser = Omit<Usuario, "Password"> & { Legajo?: string };

export interface LoginSuccess {
  ok: true;
  user: SessionUser;
  token: string;
}
export interface LoginFailure {
  ok: false;
  error: string;
}

export async function loginRequest(
  usuario: string,
  password: string,
): Promise<LoginSuccess | LoginFailure> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      user?: SessionUser;
      token?: string;
      error?: string;
    };
    if (!res.ok || !data.user || !data.token) {
      return { ok: false, error: data.error ?? "Error de autenticación" };
    }
    return { ok: true, user: data.user, token: data.token };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}
