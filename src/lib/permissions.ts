import permisos from "@/data/mock/permisos-mobile.json";
import type { PermisoMobile, Rol } from "@/data/types";

const ALL = permisos as PermisoMobile[];

export function getVisibleModules(rol: Rol | undefined | null): PermisoMobile[] {
  if (!rol) return [];
  return ALL.filter((m) => m.Status_LPM === "Activo" && m.Roles_LPM.includes(rol)).sort(
    (a, b) => a.Orden_LPM - b.Orden_LPM,
  );
}

export function canAccessRoute(rol: Rol | undefined | null, ruta: string): boolean {
  if (!rol) return false;
  const m = ALL.find((x) => x.ruta === ruta);
  if (!m) return true; // ruta no listada en permisos = pública (Home, login, etc.)
  return m.Roles_LPM.includes(rol);
}
