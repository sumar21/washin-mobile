import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  AlertTriangle,
  Wind,
  ListChecks,
  ClipboardList,
  Wrench,
  Settings,
  Mail,
  ChevronRight,
  CalendarDays,
  Coffee,
  Pause,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/stores/sessionStore";
import {
  getHome,
  getBreak,
  postBreak,
  anularRegistro,
  type HomeRegistro,
} from "@/lib/api-client";
import { MODULE_ROUTE } from "@/lib/nav";
import { todayDdMmYyyy } from "@/lib/format";
import { cn } from "@/lib/utils";

function useElapsed(startedAt: string | null | undefined) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "00:00";
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const total = Math.floor(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

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

// Únicos módulos que aparecen en el grid del Home (en todos los viewports).
// El resto (Edificios, ABM, Mails) sigue accesible vía menú hamburger / sidebar.
const HOME_MODULES = new Set([
  "Registro de visita",
  "Incidentes",
  "Detalle Maquina",
  "Ventilaciones",
]);

// Renombres específicos del Home (no afectan rutas ni navegación).
const HOME_LABEL_OVERRIDES: Record<string, string> = {
  "Registro de visita": "Mis Visitas",
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

// % de completitud → pill suave (tint + texto del color). Tokens semánticos.
function completitudSoft(pct: number): string {
  if (pct >= 100) return "bg-success/10 text-success";
  if (pct >= 60) return "bg-primary/10 text-primary";
  if (pct >= 30) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

// Capas de luz difuminada del hero (compartidas por mobile y desktop).
function HeroDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 size-52 rounded-full bg-sky-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />
    </>
  );
}

// Saludo (avatar + nombre/rol/fecha + Descanso). Se usa tal cual en el hero mobile
// y en la card de saludo de desktop.
function GreetingRow({
  inicial,
  nombreCompleto,
  rol,
  greeting,
  longDate,
  currentBreak,
  breakUsed,
  breakElapsed,
  onToggleBreak,
}: {
  inicial: string;
  nombreCompleto: string;
  rol?: string;
  greeting: string;
  longDate: string;
  currentBreak: boolean;
  breakUsed: boolean;
  breakElapsed: string;
  onToggleBreak: () => void;
}) {
  // Sin descanso activo pero ya usado hoy → botón deshabilitado (1 descanso por día).
  const breakDisabled = breakUsed && !currentBreak;
  return (
    <div className="flex items-center gap-3 md:gap-4">
      <Avatar className="size-12 shrink-0 shadow-lg shadow-blue-900/20 ring-2 ring-white/40 md:size-14">
        <AvatarFallback className="bg-white/20 text-base font-semibold text-primary-foreground backdrop-blur md:text-lg">
          {inicial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/80 md:text-sm">{greeting},</p>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-lg font-semibold tracking-tight md:text-2xl">
            {nombreCompleto}
          </p>
          {rol ? (
            <Badge className="shrink-0 border-white/25 bg-white/15 text-primary-foreground backdrop-blur-sm hover:bg-white/20">
              {rol}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80 md:text-xs">
          <CalendarDays className="size-3 md:size-3.5" />
          <span className="truncate">{longDate}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleBreak}
        disabled={breakDisabled}
        aria-label={
          currentBreak
            ? "Finalizar descanso"
            : breakDisabled
              ? "Descanso de hoy ya utilizado"
              : "Activar descanso"
        }
        title={
          currentBreak
            ? "Finalizar descanso"
            : breakDisabled
              ? "Ya usaste tu descanso de hoy"
              : "Activar descanso"
        }
        className={cn(
          "group inline-flex h-9 shrink-0 items-center gap-1.5 self-center rounded-xl px-3 text-xs font-semibold ring-1 backdrop-blur-sm transition-all",
          currentBreak
            ? "bg-amber-300/95 text-amber-900 ring-amber-200/60 hover:bg-amber-300"
            : breakDisabled
              ? "cursor-not-allowed bg-white/10 text-white/55 ring-white/15"
              : "bg-white/15 text-primary-foreground ring-white/25 hover:bg-white/25",
        )}
      >
        {currentBreak ? (
          <>
            <Pause className="size-4" />
            <span className="font-mono tabular-nums">{breakElapsed}</span>
          </>
        ) : breakDisabled ? (
          <>
            <Check className="size-4" />
            <span>Descanso</span>
          </>
        ) : (
          <>
            <Coffee className="size-4" />
            <span>Descanso</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function ScreenHome() {
  const navigate = useNavigate();
  const { user, currentBreak, setCurrentBreak } = useSession();
  const breakElapsed = useElapsed(currentBreak?.startedAt);
  // 1 descanso por día: una vez consumido (activo o finalizado), no se puede iniciar otro.
  const [breakUsedToday, setBreakUsedToday] = useState(false);

  const queryClient = useQueryClient();
  const { data: home } = useQuery({ queryKey: ["home"], queryFn: getHome });

  // Solo Admin/Supervisor pueden anular registros del día (el backend lo re-valida).
  const puedeAnular = user?.Rol === "Admin" || user?.Rol === "Supervisor";
  const [regAAnular, setRegAAnular] = useState<HomeRegistro | null>(null);
  const anularMut = useMutation({
    mutationFn: (id: number) => anularRegistro(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      toast.success("Registro anulado");
      setRegAAnular(null);
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "No se pudo anular el registro",
      ),
  });

  // Solo se anulan registros Pendiente (los Finalizados/Anulados no se tocan).
  const anulable = (r: HomeRegistro) =>
    puedeAnular && r.Estado.trim().toLowerCase() === "pendiente";

  // Sincroniza el descanso (activo + si ya se usó hoy) desde el servidor (lista 14) al montar.
  useEffect(() => {
    let cancelled = false;
    getBreak()
      .then((r) => {
        if (cancelled) return;
        setCurrentBreak(r.active ? { startedAt: r.active.startedAt } : null);
        setBreakUsedToday(r.usedToday);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setCurrentBreak]);

  // Optimista local + sync con la 14. Regla: 1 descanso por día.
  async function toggleBreak() {
    if (currentBreak) {
      // Finalizar (sigue contando como "usado hoy": no se puede volver a iniciar).
      setCurrentBreak(null);
      setBreakUsedToday(true);
      toast.success("Descanso finalizado");
      postBreak("end").catch(() => {});
      return;
    }
    if (breakUsedToday) {
      toast.info("Ya usaste tu descanso de hoy");
      return;
    }
    // Iniciar (optimista) y confirmar contra el server; si rechaza, revertir.
    setCurrentBreak({ startedAt: new Date().toISOString() });
    toast.info("Descanso iniciado");
    postBreak("start")
      .then((r) => {
        setBreakUsedToday(true);
        if (r.active) setCurrentBreak({ startedAt: r.active.startedAt });
      })
      .catch((e) => {
        setCurrentBreak(null);
        toast.error(
          e instanceof Error ? e.message : "No se pudo iniciar el descanso",
        );
      });
  }

  const today = todayDdMmYyyy();

  // Todas las del día + pendientes (ya vienen scopeadas y ordenadas del backend). No se
  // recortan: igual que GalHome en PowerApps, se listan completas (el área scrollea).
  const registros = home?.registros ?? [];

  // Módulos visibles (ya filtrados por rol en el server) + mapeo a ruta del front.
  const modules = (home?.modulos ?? [])
    .filter((m) => HOME_MODULES.has(m.Modulo_LPM) && MODULE_ROUTE[m.Modulo_LPM])
    .map((m) => ({
      Modulo_LPM: m.Modulo_LPM,
      ruta: MODULE_ROUTE[m.Modulo_LPM],
    }));

  const kpiCounts = home?.kpis ?? {
    visitasHoy: 0,
    incidentesActivos: 0,
    ventilaciones: 0,
  };
  const kpis = [
    {
      label: "Visitas hoy",
      value: kpiCounts.visitasHoy,
      icon: ClipboardList,
      tint: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400",
      to: "/planificaciones",
    },
    {
      label: "Incidentes activos",
      value: kpiCounts.incidentesActivos,
      icon: AlertTriangle,
      tint: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400",
      to: "/incidentes",
    },
    {
      label: "Ventilaciones",
      value: kpiCounts.ventilaciones,
      icon: Wind,
      tint: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
      to: "/ventilaciones",
    },
  ];

  const greeting = getGreeting();
  const longDate = formatLongDate();
  const inicial = user?.Nombre?.[0] ?? "?";
  const nombreCompleto = user?.Concat_Nombre_Apellido ?? "Usuario";

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      {/* MOBILE: hero fusionado como header (hamburguesa + logo + saludo). */}
      <header className="safe-top relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-primary via-primary to-blue-700 text-primary-foreground shadow-lg md:hidden dark:to-blue-900">
        <HeroDecor />
        <div className="relative px-4 pb-5 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <HamburgerMenu />
            <div className="flex items-center gap-2">
              <img
                src="/Logoapp.png"
                alt=""
                className="size-8 rounded-lg object-contain ring-1 ring-white/30"
              />
              <span className="text-base font-semibold tracking-tight">
                Washinn
              </span>
            </div>
          </div>
          <GreetingRow
            inicial={inicial}
            nombreCompleto={nombreCompleto}
            rol={user?.Rol}
            greeting={greeting}
            longDate={longDate}
            currentBreak={!!currentBreak}
            breakUsed={breakUsedToday}
            breakElapsed={breakElapsed}
            onToggleBreak={toggleBreak}
          />
        </div>
      </header>

      {/* DESKTOP: header propio de la pantalla ("Inicio" + fecha), como el resto. */}
      <header className="safe-top sticky top-0 z-40 hidden items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-6 pb-4 pt-6 backdrop-blur-md md:flex lg:px-8">
        <h1 className="text-lg font-semibold tracking-tight">Inicio</h1>
        <span className="text-sm text-muted-foreground">{longDate}</span>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-5 md:px-6 md:pt-6 lg:px-8">
        {/* DESKTOP: saludo como card contenida (mantiene Descanso accesible). */}
        <div className="relative mb-5 hidden overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-blue-700 text-primary-foreground shadow-lg md:block lg:mb-6 dark:to-blue-900">
          <HeroDecor />
          <div className="relative p-5 lg:p-6">
            <GreetingRow
              inicial={inicial}
              nombreCompleto={nombreCompleto}
              rol={user?.Rol}
              greeting={greeting}
              longDate={longDate}
              currentBreak={!!currentBreak}
              breakUsed={breakUsedToday}
              breakElapsed={breakElapsed}
              onToggleBreak={toggleBreak}
            />
          </div>
        </div>

        {/* Dashboard apilado en una columna. Orden mobile: KPIs → Módulos → Registros
            (lo transaccional queda debajo de los módulos para que no los empuje fuera de
            vista). En md+ los Módulos se ocultan: ya los lista el Sidebar, así que en la
            home serían redundantes; quedan KPIs + Registros a todo el ancho. */}
        <div className="flex flex-col gap-5 lg:gap-6">
          {/* KPIs */}
          <section className="order-1">
            <h2 className="mb-3 hidden px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground md:block">
              Indicadores del día
            </h2>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {kpis.map((k) => (
                <Link key={k.label} to={k.to} className="group block">
                  <Card className="relative h-full overflow-hidden rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                        k.tint,
                      )}
                    />
                    <CardContent className="relative flex flex-col gap-1.5 p-3 md:p-4 lg:p-5">
                      <div className="flex items-center justify-between">
                        <k.icon className="size-4 opacity-80 md:size-5 lg:size-6" />
                        <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="text-2xl font-bold leading-none tracking-tight md:text-3xl lg:text-4xl">
                        {k.value}
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground md:text-xs lg:text-sm">
                        {k.label}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Registros del día (transaccional) */}
          <Card className="order-3 rounded-2xl">
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Registros del día</CardTitle>
              <span className="text-xs text-muted-foreground">{today}</span>
            </CardHeader>
            <CardContent className="p-0">
              {registros.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Sin registros para hoy"
                  description="Cuando se asignen visitas aparecerán acá."
                  className="py-12"
                />
              ) : (
                <>
                  {/* Mobile/tablet: lista de filas */}
                  <ul className="divide-y md:hidden">
                    {registros.map((r) => (
                      <li
                        key={r.ID}
                        className="flex items-center gap-1 pr-2 transition-colors hover:bg-muted/40"
                      >
                        <Link
                          to="/planificaciones"
                          className="group flex min-w-0 flex-1 items-center gap-3 py-3 pl-4"
                        >
                          <Avatar className="size-11 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {r.Edificio.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            {/* Edificio: protagonista de la fila. */}
                            <p className="truncate text-[15px] font-semibold leading-tight">
                              {r.Edificio}
                            </p>
                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <StatusBadge status={r.Estado} />
                              {r.HoraVisita ? (
                                <span className="shrink-0 font-medium tabular-nums">
                                  {r.HoraVisita}
                                </span>
                              ) : null}
                              {typeof r.Completitud === "number" &&
                              r.Completitud > 0 ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                    completitudSoft(r.Completitud),
                                  )}
                                >
                                  {r.Completitud}%
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                        {anulable(r) ? (
                          <button
                            type="button"
                            onClick={() => setRegAAnular(r)}
                            aria-label="Anular registro"
                            title="Anular registro"
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : (
                          <ChevronRight className="mr-1 size-4 shrink-0 text-muted-foreground" />
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: tabla real */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Edificio</th>
                          <th className="px-4 py-3 font-medium">Técnico</th>
                          <th className="px-4 py-3 font-medium">Hora</th>
                          <th className="px-4 py-3 font-medium">Estado</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Completitud
                          </th>
                          <th className="w-20 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((r) => (
                          <tr
                            key={r.ID}
                            onClick={() => navigate("/planificaciones")}
                            className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="size-8">
                                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                                    {r.Edificio.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {r.Edificio}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {r.Nombre}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {r.HoraVisita || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={r.Estado} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {typeof r.Completitud === "number" &&
                              r.Completitud > 0 ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full border-transparent px-2 py-0.5 text-[11px] font-semibold",
                                    completitudSoft(r.Completitud),
                                  )}
                                >
                                  {r.Completitud}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {anulable(r) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRegAAnular(r);
                                    }}
                                    aria-label="Anular registro"
                                    title="Anular registro"
                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : null}
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Módulos: SOLO mobile/tablet-chico. En md+ los cubre el Sidebar, por eso md:hidden. */}
          <aside className="order-2 flex flex-col gap-3 md:hidden">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Módulos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {modules.map((m) => {
                const v = MODULE_VISUALS[m.Modulo_LPM] ?? DEFAULT_VISUAL;
                const Icon = v.icon;
                const label =
                  HOME_LABEL_OVERRIDES[m.Modulo_LPM] ?? m.Modulo_LPM;
                return (
                  <Link key={m.Modulo_LPM} to={m.ruta} className="group block">
                    <Card
                      className={cn(
                        "h-full rounded-2xl ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md",
                        v.hoverRing,
                      )}
                    >
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                            v.iconBg,
                            v.iconText,
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-tight">
                            {label}
                          </div>
                          {v.description ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {v.description}
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* Confirmación de anulación (Admin/Supervisor). */}
      <AlertDialog
        open={!!regAAnular}
        onOpenChange={(open) => {
          if (!open && !anularMut.isPending) setRegAAnular(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {regAAnular
                ? `Se va a anular la visita de ${regAAnular.Edificio}${
                    regAAnular.HoraVisita ? ` (${regAAnular.HoraVisita})` : ""
                  }. El registro quedará marcado como "Anulado".`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anularMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (regAAnular) anularMut.mutate(regAAnular.ID);
              }}
              disabled={anularMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {anularMut.isPending ? "Anulando…" : "Anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
