import { NavLink } from "react-router-dom";
import { Home, ClipboardList, AlertTriangle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/home", label: "Inicio", icon: Home },
  { to: "/planificaciones", label: "Visitas", icon: ClipboardList },
  { to: "/incidentes", label: "Incidentes", icon: AlertTriangle },
  { to: "/metricas", label: "Métricas", icon: BarChart3 },
];

export function BottomNav() {
  return (
    <nav className="safe-bottom sticky bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur md:hidden">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
