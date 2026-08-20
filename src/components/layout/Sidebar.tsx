import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  ClipboardList,
  Building2,
  AlertTriangle,
  Wind,
  Wrench,
  Settings,
  Mail,
  ListChecks,
  Package,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/stores/sessionStore";
import { getHome } from "@/lib/api-client";
import { NAV_VISIBLE, NAV_LABELS, MODULE_ROUTE, ADMIN_ONLY } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  "Registro de visita": ClipboardList,
  "Detalle Maquina": Wrench,
  Incidentes: AlertTriangle,
  Ventilaciones: Wind,
  "Stock Tecnico": Package,
  Edificios: Building2,
  ABM: Settings,
  Mails: Mail,
  Checklist: ListChecks,
};

const COLLAPSE_KEY = "sidebar:collapsed";

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  // Estado de colapsado (desktop), persistido para sobrevivir navegación/reload.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  // Mismos módulos que el Home: activos desde el backend (sin filtro por rol).
  const { data: home } = useQuery({ queryKey: ["home"], queryFn: getHome });
  const modules = (home?.modulos ?? [])
    .filter(
      (m) =>
        NAV_VISIBLE.has(m.Modulo_LPM) &&
        MODULE_ROUTE[m.Modulo_LPM] &&
        (user?.Rol === "Admin" || !ADMIN_ONLY.has(m.Modulo_LPM)),
    )
    .map((m) => ({
      Modulo_LPM: m.Modulo_LPM,
      ruta: MODULE_ROUTE[m.Modulo_LPM],
    }));

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-primary via-primary to-blue-700 text-white transition-[width] duration-200 ease-out md:flex dark:to-blue-900",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Encabezado: logo + marca (oculta al colapsar) + botón de colapsar/expandir. */}
      <div
        className={cn(
          "border-b border-white/10 px-3 py-4",
          collapsed
            ? "flex flex-col items-center gap-3"
            : "flex items-center gap-3 px-5",
        )}
      >
        <img
          src="/Logoapp.png"
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-white/20"
        />
        {!collapsed ? (
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-bold leading-tight">Washinn</span>
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              Sumar Digital
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white",
            !collapsed && "ml-auto",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <SidebarLink
          to="/home"
          icon={Home}
          label="Inicio"
          collapsed={collapsed}
        />
        <Separator className="my-2 bg-white/10" />
        {!collapsed ? (
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Módulos
          </p>
        ) : null}
        {modules.map((m) => {
          const Icon = ICONS[m.Modulo_LPM] ?? ListChecks;
          return (
            <SidebarLink
              key={m.Modulo_LPM}
              to={m.ruta}
              icon={Icon}
              label={NAV_LABELS[m.Modulo_LPM] ?? m.Modulo_LPM}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            "mb-2 flex items-center rounded-lg py-2 hover:bg-white/10",
            collapsed ? "justify-center px-0" : "gap-3 px-2",
          )}
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-white/20 text-white">
              {user?.Nombre?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {user?.Concat_Nombre_Apellido ?? "Invitado"}
              </p>
              <Badge
                variant="outline"
                className="mt-0.5 border-white/20 bg-white/10 text-[10px] text-white/80"
              >
                {user?.Rol}
              </Badge>
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            // Logout EXPLÍCITO: acá sí se purgan los borradores (celular compartido).
            logout({ purgarBorradores: true });
            navigate("/login", { replace: true });
          }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className={cn(
            "text-red-200 hover:bg-white/10 hover:text-red-100",
            collapsed ? "w-full justify-center px-0" : "w-full justify-start",
          )}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed ? "Cerrar sesión" : null}
        </Button>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/home"}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          isActive
            ? "bg-white/20 font-medium text-white shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white",
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  );
}
