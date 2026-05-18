import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  AlertTriangle,
  Wind,
  ListChecks,
  ClipboardList,
  Wrench,
  Settings,
  Mail,
  BarChart3,
  ChevronRight,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useSession } from "@/stores/sessionStore";
import { getVisibleModules } from "@/lib/permissions";
import { api } from "@/data/api";
import { todayDdMmYyyy } from "@/lib/format";

type ModuleVisual = {
  icon: React.ElementType;
  description: string;
  iconBg: string;
  iconText: string;
  hoverRing: string;
};

const MODULE_VISUALS: Record<string, ModuleVisual> = {
  "Registro de visita": {
    icon: ClipboardList,
    description: "Visitas diarias y avance",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
    hoverRing: "hover:ring-blue-200 dark:hover:ring-blue-500/40",
  },
  "Detalle Maquina": {
    icon: Wrench,
    description: "Estado e historial",
    iconBg: "bg-slate-100 dark:bg-slate-500/15",
    iconText: "text-slate-700 dark:text-slate-300",
    hoverRing: "hover:ring-slate-200 dark:hover:ring-slate-500/40",
  },
  Incidentes: {
    icon: AlertTriangle,
    description: "Reportes y seguimiento",
    iconBg: "bg-red-100 dark:bg-red-500/15",
    iconText: "text-red-600 dark:text-red-400",
    hoverRing: "hover:ring-red-200 dark:hover:ring-red-500/40",
  },
  Ventilaciones: {
    icon: Wind,
    description: "Mantenimiento programado",
    iconBg: "bg-cyan-100 dark:bg-cyan-500/15",
    iconText: "text-cyan-600 dark:text-cyan-400",
    hoverRing: "hover:ring-cyan-200 dark:hover:ring-cyan-500/40",
  },
  Edificios: {
    icon: Building2,
    description: "Sucursales y contactos",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/15",
    iconText: "text-indigo-600 dark:text-indigo-400",
    hoverRing: "hover:ring-indigo-200 dark:hover:ring-indigo-500/40",
  },
  "Métricas": {
    icon: BarChart3,
    description: "Indicadores operativos",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    hoverRing: "hover:ring-emerald-200 dark:hover:ring-emerald-500/40",
  },
  ABM: {
    icon: Settings,
    description: "Gestión de catálogos",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    hoverRing: "hover:ring-amber-200 dark:hover:ring-amber-500/40",
  },
  Mails: {
    icon: Mail,
    description: "Plantillas y envíos",
    iconBg: "bg-violet-100 dark:bg-violet-500/15",
    iconText: "text-violet-600 dark:text-violet-400",
    hoverRing: "hover:ring-violet-200 dark:hover:ring-violet-500/40",
  },
  Checklist: {
    icon: ListChecks,
    description: "Items por visita",
    iconBg: "bg-teal-100 dark:bg-teal-500/15",
    iconText: "text-teal-600 dark:text-teal-400",
    hoverRing: "hover:ring-teal-200 dark:hover:ring-teal-500/40",
  },
};

// Módulos visibles en el grid del Home en mobile. En desktop se muestran todos los
// permitidos por el rol (el sidebar ya cubre el resto, así que el home mobile queda
// enfocado solo en lo que un técnico/operador usa en el día a día).
const MOBILE_VISIBLE_MODULES = new Set([
  "Registro de visita",
  "Incidentes",
  "Detalle Maquina",
  "Ventilaciones",
]);

// Renombres específicos del Home (no afectan rutas ni navegación).
const HOME_LABEL_OVERRIDES: Record<string, string> = {
  Incidentes: "Mis Incidentes",
};

const DEFAULT_VISUAL: ModuleVisual = {
  icon: ListChecks,
  description: "",
  iconBg: "bg-muted",
  iconText: "text-foreground",
  hoverRing: "hover:ring-border",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buen día";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatLongDate() {
  const d = new Date();
  const s = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ScreenHome() {
  const { user } = useSession();
  const modules = getVisibleModules(user?.Rol).filter((m) => m.Modulo_LPM !== "Checklist");

  const { data: registros = [] } = useQuery({
    queryKey: ["registros"],
    queryFn: () => api.listRegistros(),
  });
  const { data: incidentes = [] } = useQuery({
    queryKey: ["incidentes"],
    queryFn: () => api.listIncidentes(),
  });
  const { data: ventilaciones = [] } = useQuery({
    queryKey: ["ventilaciones"],
    queryFn: () => api.listVentilaciones(),
  });

  const today = todayDdMmYyyy();
  const myName = user?.Concat_Nombre_Apellido;
  const isTecnico = user?.Rol === "Tecnico";

  const scopedRegistros = isTecnico ? registros.filter((r) => r.Nombre === myName) : registros;
  const visitasHoy = scopedRegistros.filter(
    (r) => r.Fecha === today || r.Estado === "Pendiente",
  );
  const incidentesActivos = incidentes.filter(
    (i) => i.Status_IN === "Pendiente" || i.Status_IN === "En proceso",
  );
  const ventilacionesPendientes = ventilaciones.filter(
    (v) => v.Estado_VE === "Asignada" || v.Estado_VE === "Programada" || v.Estado_VE === "Pendiente",
  );

  const myRegistros = visitasHoy.slice(0, 8);

  const kpis = [
    {
      label: "Visitas hoy",
      value: visitasHoy.length,
      icon: ClipboardList,
      tint: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400",
      to: "/planificaciones",
    },
    {
      label: "Incidentes activos",
      value: incidentesActivos.length,
      icon: AlertTriangle,
      tint: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400",
      to: "/incidentes",
    },
    {
      label: "Ventilaciones",
      value: ventilacionesPendientes.length,
      icon: Wind,
      tint: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
      to: "/ventilaciones",
    },
  ];

  const greeting = getGreeting();
  const longDate = formatLongDate();

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader title="Inicio" back={false} action={<HamburgerMenu />} />

      <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
        {/* Hero / Welcome */}
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-primary to-blue-700 text-primary-foreground shadow-lg ring-1 ring-white/10 dark:to-blue-900">
          {/* Capas de luz difuminada */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-sky-300/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />

          <CardContent className="relative flex items-center gap-3 p-4 md:gap-4 md:p-6">
            <Avatar className="h-12 w-12 shadow-lg shadow-blue-900/20 ring-2 ring-white/40 md:h-14 md:w-14">
              <AvatarFallback className="bg-white/20 text-base font-semibold text-primary-foreground backdrop-blur md:text-lg">
                {user?.Nombre?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/80 md:text-sm">{greeting},</p>
              <p className="truncate text-base font-semibold tracking-tight md:text-xl">
                {user?.Concat_Nombre_Apellido ?? "Usuario"}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80 md:text-xs">
                <CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" />
                <span>{longDate}</span>
              </div>
            </div>
            <Badge className="shrink-0 border-white/25 bg-white/15 text-primary-foreground backdrop-blur-sm hover:bg-white/20">
              {user?.Rol}
            </Badge>
          </CardContent>
        </Card>

        {/* KPIs */}
        <section>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {kpis.map((k) => (
              <Link
                key={k.label}
                to={k.to}
                className={`group relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-4`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${k.tint} opacity-60`}
                />
                <div className="relative flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <k.icon className="h-4 w-4 opacity-80 md:h-5 md:w-5" />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="text-2xl font-bold leading-none tracking-tight md:text-3xl">
                    {k.value}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground md:text-xs">
                    {k.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Módulos */}
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Módulos
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map((m) => {
              const v = MODULE_VISUALS[m.Modulo_LPM] ?? DEFAULT_VISUAL;
              const Icon = v.icon;
              const label = HOME_LABEL_OVERRIDES[m.Modulo_LPM] ?? m.Modulo_LPM;
              const mobileVisible = MOBILE_VISIBLE_MODULES.has(m.Modulo_LPM);
              return (
                <Link
                  key={m.ID}
                  to={m.ruta}
                  className={`group ${
                    mobileVisible ? "flex" : "hidden md:flex"
                  } flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md ${v.hoverRing} md:p-5`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${v.iconBg} ${v.iconText} transition-transform group-hover:scale-105 md:h-12 md:w-12`}
                    >
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold leading-tight md:text-base">
                      {label}
                    </div>
                    {v.description ? (
                      <div className="text-xs text-muted-foreground">{v.description}</div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Registros del día */}
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Registros del día
            </h2>
            <span className="text-xs text-muted-foreground">{today}</span>
          </div>
          {myRegistros.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Sin registros para hoy</p>
                <p className="text-xs text-muted-foreground">
                  Cuando se asignen visitas aparecerán acá.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {myRegistros.map((r) => (
                <Link
                  key={r.ID}
                  to="/planificaciones"
                  className="group block"
                >
                  <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <CardContent className="flex items-center gap-3 py-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {r.Edificio.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.Edificio}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{r.Nombre}</span>
                          {r.HoraVisita ? (
                            <>
                              <span className="opacity-50">·</span>
                              <span className="shrink-0 font-medium">{r.HoraVisita}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <StatusBadge status={r.Estado} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
