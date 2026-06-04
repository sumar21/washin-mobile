import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Quote,
  User,
  Wrench,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const decoded = id ? decodeURIComponent(id) : undefined;

  const { data = [], isLoading } = useQuery({
    queryKey: ["historial-maquina", decoded],
    queryFn: () => getHistorialMaquina(decoded!),
    enabled: !!decoded,
  });

  const { data: maquinas = [] } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: getDetalleMaquina,
  });

  const maquina = useMemo(
    () => maquinas.find((m) => m.IDMaquina_DM === decoded),
    [maquinas, decoded],
  );

  const [observacion, setObservacion] = useState<HistorialIncidente | null>(
    null,
  );
  const [repuestosFor, setRepuestosFor] = useState<HistorialIncidente | null>(
    null,
  );

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        title="Historial de máquina"
        subtitle={maquina?.ConcatMaquina_DM ?? decoded}
        action={
          maquina ? (
            <Button
              type="button"
              size="icon"
              onClick={() => navigate("/incidentes?nuevo=1")}
              aria-label="Nuevo incidente"
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm shadow-blue-600/25 ring-1 ring-white/10 transition-transform hover:-translate-y-px"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-6">
        {/* Card de contexto de la máquina */}
        {maquina ? (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-primary">
                {maquina.ConcatMaquina_DM}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{maquina.Edificio_DM}</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    N° Serie
                  </span>
                  <span className="font-mono text-[11px] text-foreground/90">
                    {maquina.NroSerie_DM}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </span>
                  <span className="font-mono text-[11px] text-foreground/90">
                    {maquina.IDExterno_DM}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && data.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin historial"
            description="Esta máquina todavía no tiene eventos registrados."
          />
        ) : null}

        {data.length > 0 ? (
          <div className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {data.length} evento{data.length === 1 ? "" : "s"}
            </h2>
            {data.map((h) => (
              <HistorialCard
                key={h.ID}
                item={h}
                onObservacion={() => setObservacion(h)}
                onVerRepuestos={() => setRepuestosFor(h)}
              />
            ))}
          </div>
        ) : null}
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
    ? "from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-emerald-200/60 dark:text-emerald-400 dark:ring-emerald-500/20"
    : "from-amber-500/15 to-amber-500/5 text-amber-600 ring-amber-200/60 dark:text-amber-400 dark:ring-amber-500/20";
  const StatusIcon = isCerrado ? CheckCircle2 : Clock;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        {/* Hero del evento */}
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${heroTone}`}
            >
              <StatusIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                {item?.Descripcion || "Incidente"}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  <span className="font-mono">{item?.Fecha}</span>
                </span>
                {item ? <StatusBadge status={item.Status} /> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2.5 px-5 py-4">
          <MetaRow
            icon={Building2}
            label="Edificio"
            value={item?.Edificio ?? "—"}
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
            <blockquote className="relative rounded-lg border bg-card p-3 pl-9 text-sm leading-relaxed shadow-sm">
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

        <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        {/* Hero */}
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                Repuestos necesarios
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item?.Descripcion}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{item?.Edificio}</span>
                <span className="opacity-50">·</span>
                <span className="font-mono">{item?.Fecha}</span>
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
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
                    <Package className="h-4 w-4" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.Repuesto}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    <span className="text-[10px] opacity-70">×</span>
                    {r.Cantidad_RH}
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

        <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <Icon className="h-3.5 w-3.5" />
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
              <span className="truncate">{item.Edificio}</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.Descripcion}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span className="font-mono">{item.Fecha}</span>
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
            className="h-8 w-8 shrink-0"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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
