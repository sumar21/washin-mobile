import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "@/stores/sessionStore";
import { canAccessRoute } from "@/lib/permissions";
import type { Rol } from "@/data/types";

export function AuthGuard() {
  const { user } = useSession();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function RoleGuard({ roles }: { roles: Rol[] }) {
  const { user } = useSession();
  if (!user || !roles.includes(user.Rol)) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
}

export function RouteGuard({ ruta }: { ruta: string }) {
  const { user } = useSession();
  if (!canAccessRoute(user?.Rol, ruta)) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
}
