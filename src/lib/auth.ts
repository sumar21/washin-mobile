import usuarios from "@/data/mock/usuarios.json";
import type { Usuario } from "@/data/types";

export function authenticate(usuario: string, password: string): Usuario | null {
  const u = (usuarios as Usuario[]).find(
    (x) => x.Usuario.toLowerCase() === usuario.trim().toLowerCase() && x.Status === "ALTA",
  );
  if (!u) return null;
  return u.Password === password ? u : null;
}
