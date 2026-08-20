import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
  LogOut,
  Home,
  Settings,
  ListChecks,
  Building2,
  AlertTriangle,
  Wind,
  Wrench,
  Mail,
  ClipboardList,
  Package,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/stores/sessionStore";
import { getHome } from "@/lib/api-client";
import { NAV_VISIBLE, NAV_LABELS, MODULE_ROUTE, ADMIN_ONLY } from "@/lib/nav";

const ICONS: Record<string, React.ElementType> = {
  Home,
  Checklist: ClipboardList,
  Edificios: Building2,
  Planificaciones: ListChecks,
  Incidentes: AlertTriangle,
  Ventilaciones: Wind,
  "Detalle Maquina": Wrench,
  "Stock Tecnico": Package,
  ABM: Settings,
  Mails: Mail,
  "Registro de visita": ListChecks,
};

export function HamburgerMenu() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
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
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menú"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] border-white/10 bg-gradient-to-b from-primary via-primary to-blue-700 p-0 text-white dark:to-blue-900"
      >
        <SheetHeader className="border-b border-white/10 p-4 text-left">
          <SheetTitle className="flex items-center gap-3 text-white">
            <Avatar>
              <AvatarFallback className="bg-white/20 text-white">
                {user?.Nombre?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {user?.Concat_Nombre_Apellido ?? "Invitado"}
              </span>
              <span className="text-xs text-white/70">{user?.Rol}</span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Menú principal de Washinn
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col p-2">
          <SheetClose asChild>
            <Link
              to="/home"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
            >
              <Home className="h-4 w-4" />
              Inicio
            </Link>
          </SheetClose>
          {modules.map((m) => {
            const Icon = ICONS[m.Modulo_LPM] ?? ListChecks;
            const label = NAV_LABELS[m.Modulo_LPM] ?? m.Modulo_LPM;
            return (
              <SheetClose asChild key={m.Modulo_LPM}>
                <Link
                  to={m.ruta}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </SheetClose>
            );
          })}
          <Separator className="my-2 bg-white/10" />
          <SheetClose asChild>
            <button
              onClick={() => {
                // Logout EXPLÍCITO: acá sí se purgan los borradores (celular compartido).
                logout({ purgarBorradores: true });
                navigate("/login", { replace: true });
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-red-200 hover:bg-white/10 hover:text-red-100"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
