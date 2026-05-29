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
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/stores/sessionStore";
import { getVisibleModules } from "@/lib/permissions";
import { NAV_VISIBLE, NAV_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  "Registro de visita": ClipboardList,
  "Detalle Maquina": Wrench,
  Incidentes: AlertTriangle,
  Ventilaciones: Wind,
  Edificios: Building2,
  ABM: Settings,
  Mails: Mail,
  Checklist: ListChecks,
};

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const modules = getVisibleModules(user?.Rol).filter((m) => NAV_VISIBLE.has(m.Modulo_LPM));

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <img src="/Logoapp.png" alt="" className="h-9 w-9 rounded-lg object-contain" />
        <div className="flex flex-col">
          <span className="text-base font-bold leading-tight">Washinn</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sumar Digital</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <SidebarLink to="/home" icon={Home} label="Inicio" />
        <Separator className="my-2" />
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Módulos
        </p>
        {modules.map((m) => {
          const Icon = ICONS[m.Modulo_LPM] ?? ListChecks;
          return <SidebarLink key={m.ID} to={m.ruta} icon={Icon} label={NAV_LABELS[m.Modulo_LPM] ?? m.Modulo_LPM} />;
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.Nombre?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {user?.Concat_Nombre_Apellido ?? "Invitado"}
            </p>
            <Badge variant="secondary" className="mt-0.5 text-[10px]">
              {user?.Rol}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}

function SidebarLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/home"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-accent hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
