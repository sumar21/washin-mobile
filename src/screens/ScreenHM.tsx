import { useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Package,
  Power,
  Quote,
  User,
  Wrench,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  getDetalleMaquina,
  getHistorialMaquina,
  getRepuestosIncidente,
  type HistorialIncidente,
} from "@/lib/api-client";

export default function ScreenHM() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const decoded = id ? decodeURIComponent(id) : undefined;

  // IDMaquina_DM NO es único (misma numeración se repite entre segmentos, p. ej. lavadoras y
  // encendedoras) → el path :id sólo no basta para identificar la máquina. ScreenDetalleMaquina
  // pasa además el id de ítem SharePoint (mid, único) y el código de edificio para desambiguar.
  const midParam = searchParams.get("mid");
  const edificioParam = searchParams.get("edificio") || undefined;

  // Volver al listado preservando el filtro aplicado (lo pasa ScreenDetalleMaquina por state).
  const listSearch = (location.state as { listSearch?: string } | null)
    ?.listSearch;
  const listBackUrl = listSearch ? `/maquinas?${listSearch}` : "/maquinas";

  const { data: maquinas = [] } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => getDetalleMaquina(),
  });

  // Máquina exacta por id de ítem (mid) cuando llega; fallback al primer IDMaquina_DM (deeplink
  // viejo sin mid) — ambiguo pero es el comportamiento previo.
  const maquina = useMemo(() => {
    if (midParam) {
      const byId = maquinas.find((m) => m.ID === Number(midParam));
      if (byId) return byId;
    }
    return maquinas.find((m) => m.IDMaquina_DM === decoded);
  }, [maquinas, decoded, midParam]);

  // El historial se filtra por IDMaquina_IN + edificio (clave compuesta que evita mezclar
  // incidentes de máquinas con IDMaquina repetido en otro edificio). Ver docs/incidentes-por-maquina.md.
  const codigoEdificio = maquina?.CodigoEdificio_DM ?? edificioParam;

  const { data = [], isLoading } = useQuery({
    queryKey: ["historial-maquina", decoded, codigoEdificio],
    queryFn: () => getHistorialMaquina(decoded!, codigoEdificio),
    enabled: !!decoded,
  });

  const [observacion, setObservacion] = useState<HistorialIncidente | null>(
    null,
  );
  const [repuestosFor, setRepuestosFor] = useState<HistorialIncidente | null>(
    null,
  );

  // PA: bt_NewIncidenteDesdeHM setea NavigateFromHM + MaquinaHistorial para que
  // el alta de incidente arranque con la máquina del historial pre-seleccionada
  // (Screen_Incidentes DefaultSelectedItems = If(NavigateFromHM,[MaquinaHistorial])).
  // Replicamos pasando la máquina (IDMaquina_DM) y su edificio (Codigo) a la pantalla
  // de incidentes, además del contexto legible vía location.state.
  const nuevoIncidenteUrl = useMemo(() => {
    if (!maquina) return "/incidentes?nuevo=1";
    const params = new URLSearchParams({ nuevo: "1" });
    params.set("maquina", maquina.IDMaquina_DM);
    if (maquina.CodigoEdificio_DM)
      params.set("edificio", maquina.CodigoEdificio_DM);
    return `/incidentes?${params.toString()}`;
  }, [maquina]);

  const irANuevoIncidente = () =>
    navigate(nuevoIncidenteUrl, {
      state: maquina
        ? {
            maquinaHistorial: {
              IDMaquina_DM: maquina.IDMaquina_DM,
              ConcatMaquina_DM: maquina.ConcatMaquina_DM,
              CodigoEdificio_DM: maquina.CodigoEdificio_DM,
              Edificio_DM: maquina.Edificio_DM,
            },
          }
        : undefined,
    });

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      {/* Header mobile (centrado). Desktop usa el ModuleHeader de abajo. */}
      <ScreenHeader
        className="md:hidden"
        back={listBackUrl}
        title="Historial de máquina"
        subtitle={maquina?.ConcatMaquina_DM ?? decoded}
        subtitleClassName="line-clamp-2 whitespace-normal"
        action={
          maquina ? (
            <Button
              type="button"
              size="icon"
              onClick={irANuevoIncidente}
              aria-label="Nuevo incidente"
              className="h-9 w-9 rounded-xl"
            >
              <AlertTriangle />
            </Button>
          ) : null
        }
      />

      {/* Header desktop/tablet. La flecha vuelve al listado preservando el filtro. */}
      <ModuleHeader
        back={listBackUrl}
        title="Historial de máquina"
        subtitle={maquina?.ConcatMaquina_DM ?? decoded}
      >
        {maquina ? (
          <Button
            type="button"
            onClick={irANuevoIncidente}
            className="gap-1.5 rounded-xl"
          >
            <AlertTriangle />
            Nuevo incidente
          </Button>
        ) : null}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-3 md:px-6 md:py-4">
        {/* Desktop ancho: contexto (izq, sticky) + timeline (der). Mobile: apilado. */}
        <div className="grid gap-4 xl:grid-cols-[340px_1fr] xl:items-start">
          {/* Card de contexto de la máquina */}
          {maquina ? (
            <div className="xl:sticky xl:top-20">
              <div className="rounded-2xl border bg-card p-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold leading-tight text-primary">
                      {maquina.ConcatMaquina_DM}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{maquina.Edificio_DM}</span>
                    </p>
                  </div>
                </div>

                {maquina.Encendido_DM ? (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      <Power className="h-3.5 w-3.5" />
                      {maquina.Encendido_DM}
                    </span>
                  </div>
                ) : null}

                <dl className="mt-3 divide-y divide-border/60 border-t border-border/60">
                  <InfoRow label="N° Serie" value={maquina.NroSerie_DM} mono />
                  {/* ID de negocio de la máquina (IDMaquina_DM), NO el id de ítem de SharePoint. */}
                  <InfoRow label="ID" value={maquina.IDMaquina_DM} mono />
                  <InfoRow label="Marca" value={maquina.Marca_DM} />
                  <InfoRow label="Modelo" value={maquina.Modelo_DM} />
                  {maquina.Segmento_DM ? (
                    <InfoRow label="Segmento" value={maquina.Segmento_DM} />
                  ) : null}
                  {maquina.CodigoEdificio_DM ? (
                    <InfoRow
                      label="Cód. edificio"
                      value={maquina.CodigoEdificio_DM}
                      mono
                    />
                  ) : null}
                  {maquina.FechaIngreso_DM ? (
                    <InfoRow
                      label="Fecha de ingreso"
                      value={maquina.FechaIngreso_DM}
                    />
                  ) : null}
                </dl>
              </div>
            </div>
          ) : null}

          {/* Timeline de eventos */}
          <div className="min-w-0 space-y-3">
            {isLoading ? <InlineLoader /> : null}

            {!isLoading && data.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sin historial"
                description="Esta máquina todavía no tiene eventos registrados."
              />
            ) : null}

            {data.length > 0 ? (
              <>
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {data.length} evento{data.length === 1 ? "" : "s"}
                </h2>
                <div className="grid gap-2 2xl:grid-cols-2">
                  {data.map((h) => (
                    <HistorialCard
                      key={h.ID}
                      item={h}
                      onObservacion={() => setObservacion(h)}
                      onVerRepuestos={() => setRepuestosFor(h)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dialog de observación */}
      <ObservacionDialog
        item={observacion}
        onClose={() => setObservacion(null)}
      />

      {/* Dialog de repuestos */}
      <RepuestosDialog
        item={repuestosFor}
        onClose={() => setRepuestosFor(null)}
      />
    </div>
  );
}

function ObservacionDialog({
  item,
  onClose,
}: {
  item: HistorialIncidente | null;
  onClose: () => void;
}) {
  const isCerrado = item?.Status === "Resuelto";
  const heroTone = isCerrado
    ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
    : "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400";
  const StatusIcon = isCerrado ? CheckCircle2 : Clock;

  return (
    <ResponsiveDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="overflow-hidden p-0"
        desktopClassName="max-w-sm rounded-3xl sm:rounded-3xl"
        mobileClassName="rounded-t-3xl"
      >
        {/* Hero del evento. pr extra en desktop para no chocar con la X del Dialog. */}
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4 md:pr-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${heroTone}`}
            >
              <StatusIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Motivo
              </p>
              <ResponsiveDialogTitle className="text-base font-semibold leading-snug">
                {item?.Descripcion || "Incidente"}
              </ResponsiveDialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {/* PA muestra la fecha del evento en mayúsculas (Upper(Fecha_IN)). */}
                  <span className="font-mono">{item?.Fecha?.toUpperCase()}</span>
                </span>
                {item ? <StatusBadge status={item.Status} /> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-2.5 px-5 py-4">
          <MetaRow
            icon={Building2}
            label="Edificio"
            value={proper(item?.Edificio) || "—"}
          />
          <MetaRow icon={User} label="Técnico" value={item?.Tecnico ?? "—"} />
          <MetaRow
            icon={Package}
            label="Repuestos"
            value={item?.Repuestos ?? "—"}
            tone={
              item?.Repuestos === "Pendiente de Revision"
                ? "warning"
                : item?.Repuestos === "Ver Repuestos"
                  ? "primary"
                  : "muted"
            }
          />
        </div>

        {/* Nota */}
        <div className="border-t bg-muted/20 px-5 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Nota del técnico
          </p>
          {item?.Observacion ? (
            <blockquote className="relative rounded-lg border bg-card p-3 pl-9 text-sm leading-relaxed shadow-xs">
              <Quote
                aria-hidden
                className="absolute left-2.5 top-2.5 h-4 w-4 text-primary/40"
              />
              {item.Observacion}
              <footer className="mt-2 text-[11px] text-muted-foreground">
                — {item.Tecnico}
              </footer>
            </blockquote>
          ) : (
            <div className="rounded-lg border border-dashed bg-card/50 p-3 text-center text-xs text-muted-foreground">
              Sin observaciones registradas para este evento.
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <ResponsiveDialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function RepuestosDialog({
  item,
  onClose,
}: {
  item: HistorialIncidente | null;
  onClose: () => void;
}) {
  const { data: repuestos = [], isLoading } = useQuery({
    queryKey: ["repuestos-incidente", item?.ID],
    queryFn: () => getRepuestosIncidente(item!.ID),
    enabled: !!item,
  });

  const totalUnidades = repuestos.reduce((acc, r) => acc + r.Cantidad, 0);

  return (
    <ResponsiveDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="overflow-hidden p-0"
        desktopClassName="max-w-md rounded-3xl sm:rounded-3xl"
        mobileClassName="rounded-t-3xl"
      >
        {/* Hero. pr extra en desktop para no chocar con la X del Dialog. */}
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4 md:pr-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <ResponsiveDialogTitle className="text-base font-semibold leading-tight">
                Repuestos necesarios
              </ResponsiveDialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item?.Descripcion}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{proper(item?.Edificio)}</span>
                <span className="opacity-50">·</span>
                {/* PA muestra la fecha del evento en mayúsculas (Upper(Fecha_IN)). */}
                <span className="font-mono">{item?.Fecha?.toUpperCase()}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Lista de repuestos */}
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando repuestos...</span>
            </div>
          ) : repuestos.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
              No hay repuestos registrados para este evento.
            </div>
          ) : (
            <ul className="space-y-2">
              {repuestos.map((r) => (
                <li
                  key={r.ID}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                    <Package className="h-4 w-4" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.Repuesto}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    <span className="text-[10px] opacity-70">×</span>
                    {r.Cantidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totales */}
        {!isLoading && repuestos.length > 0 ? (
          <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-2.5 text-xs">
            <span className="text-muted-foreground">
              {repuestos.length} ítem{repuestos.length === 1 ? "" : "s"}
            </span>
            <span className="font-semibold text-foreground">
              {totalUnidades} unidad{totalUnidades === 1 ? "" : "es"}
            </span>
          </div>
        ) : null}

        <ResponsiveDialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <ResponsiveDialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "primary" | "warning" | "muted";
}) {
  const valueClass =
    tone === "primary"
      ? "font-semibold text-primary"
      : tone === "warning"
        ? "font-semibold text-amber-700 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground/90";
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`truncate text-sm ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-right text-sm ${
          mono ? "font-mono text-foreground/90" : "font-medium"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function HistorialCard({
  item,
  onObservacion,
  onVerRepuestos,
}: {
  item: HistorialIncidente;
  onObservacion: () => void;
  onVerRepuestos: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-3">
        {/* Top row: edificio + fecha + status */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-primary">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {/* PA: txt_edificioHM = Proper(NombreEdificio_IN). */}
              <span className="truncate">{proper(item.Edificio)}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {item.Descripcion}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {/* PA: txt_tecnicoHM_1 = Upper(Fecha_IN). */}
              <span className="font-mono">{item.Fecha.toUpperCase()}</span>
            </span>
            <StatusBadge status={item.Status} />
          </div>
        </div>

        {/* Bottom row: tecnico + repuestos + chat button */}
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-foreground/80">
                {item.Tecnico}
              </span>
            </span>
            <RepuestoLine repuestos={item.Repuestos} onClick={onVerRepuestos} />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onObservacion}
            aria-label="Ver observación"
            className="h-10 w-10 shrink-0 md:h-9 md:w-9"
          >
            <MessageSquare />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Réplica de Proper() de PowerApps: capitaliza la primera letra de cada palabra
// y pasa el resto a minúsculas. PA usa Proper(NombreEdificio_IN) para el nombre
// del edificio (Screen_HM.pa.yaml:87, txt_edificioHM).
function proper(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .toLocaleLowerCase("es-AR")
    .replace(/\p{L}+/gu, (w) => w.charAt(0).toLocaleUpperCase("es-AR") + w.slice(1));
}

function RepuestoLine({
  repuestos,
  onClick,
}: {
  repuestos: string;
  onClick: () => void;
}) {
  if (repuestos === "Ver Repuestos") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-fit items-center gap-1 rounded-md text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      >
        <Package className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium">Ver repuestos</span>
      </button>
    );
  }
  const tone =
    repuestos === "Pendiente de Revision"
      ? "text-amber-700 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1 ${tone}`}>
      <Package className="h-3 w-3 shrink-0" />
      <span className="truncate font-medium">{repuestos}</span>
    </span>
  );
}
