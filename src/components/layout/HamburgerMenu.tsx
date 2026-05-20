import { Link, useNavigate } from "react-router-dom";
import { Menu, LogOut, Home, Settings, ListChecks, Building2, AlertTriangle, Wind, Wrench, Mail, BarChart3, ClipboardList } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/stores/sessionStore";
import { getVisibleModules } from "@/lib/permissions";

const ICONS: Record<string, React.ElementType> = {
  Home,
  Checklist: ClipboardList,
  Edificios: Building2,
  Planificaciones: ListChecks,
  Incidentes: AlertTriangle,
  Ventilaciones: Wind,
  "Detalle Maquina": Wrench,
  ABM: Settings,
  Mails: Mail,
  Métricas: BarChart3,
  "Registro de visita": ListChecks,
};

// Sólo estos módulos aparecen en el menú hamburger (mobile).
// El resto sigue accesible vía sidebar (desktop) o rutas directas.
const MENU_VISIBLE = new Set([
  "Registro de visita",
  "Detalle Maquina",
  "Incidentes",
  "Ventilaciones",
  "Métricas",
  "ABM",
]);

// Renombres locales del menú (no afectan rutas ni permisos).
const MENU_LABEL: Record<string, string> = {
  "Detalle Maquina": "Detalle de Máquina",
  ABM: "Configuración",
};

export function HamburgerMenu() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const modules = getVisibleModules(user?.Rol).filter((m) =>
    MENU_VISIBLE.has(m.Modulo_LPM),
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menú" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{user?.Nombre?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user?.Concat_Nombre_Apellido ?? "Invitado"}</span>
              <span className="text-xs text-muted-foreground">{user?.Rol}</span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Menú principal de Washinn</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col p-2">
          <SheetClose asChild>
            <Link to="/home" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent">
              <Home className="h-4 w-4" />
              Inicio
            </Link>
          </SheetClose>
          {modules.map((m) => {
            const Icon = ICONS[m.Modulo_LPM] ?? ListChecks;
            const label = MENU_LABEL[m.Modulo_LPM] ?? m.Modulo_LPM;
            return (
              <SheetClose asChild key={m.ID}>
                <Link
                  to={m.ruta}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </SheetClose>
            );
          })}
          <Separator className="my-2" />
          <SheetClose asChild>
            <button
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
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
