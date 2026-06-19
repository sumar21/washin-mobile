import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Quote,
  User,
  X,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRegistroDetalle, type RegistroDetalleItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Detalle READ-ONLY de un registro/checklist confirmado (01.Registros + 02.Detalles).
// Se llega desde el Home (HomeRegistro.IDUnico → /registros?u=<IDUnico>). Va por query param
// porque el IDUnico contiene barras (Codigo/USR/fecha) y rompería un path param. NO es editable.

// % de completitud → tint suave (mismos cortes que el Home: completitudSoft).
function completitudSoft(pct: number): string {
  if (pct >= 100) return "bg-success/10 text-success";
  if (pct >= 60) return "bg-primary/10 text-primary";
  if (pct >= 30) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

// Réplica de Proper() de PowerApps para nombres de edificio (capitaliza cada palabra).
function proper(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .toLocaleLowerCase("es-AR")
    .replace(/\p{L}+/gu, (w) => w.charAt(0).toLocaleUpperCase("es-AR") + w.slice(1));
}

export default function ScreenRegistroDetalle() {
  const [searchParams] = useSearchParams();
  // useSearchParams ya decodifica; el IDUnico trae barras (Codigo/USR/fecha) → va en query, no en path.
  const decoded = searchParams.get("u") || undefined;

  const {
    data: registro,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["registro-detalle", decoded],
    queryFn: () => getRegistroDetalle(decoded!),
    enabled: !!decoded,
  });

  const edificio = proper(registro?.Edificio) || registro?.Edificio || "Registro";
  const tituloDesktop = registro
    ? `${edificio}${registro.Fecha ? ` · ${registro.Fecha}` : ""}`
    : "Detalle del registro";

  // Completitud: usa el % que da el backend; si no viene, deriva de OK/total.
  const total = registro ? registro.items.length : 0;
  const completitud = useMemo(() => {
    if (!registro) return undefined;
    if (typeof registro.completitud === "number") return registro.completitud;
    if (total === 0) return undefined;
    return Math.round((registro.okCount / total) * 100);
  }, [registro, total]);

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      {/* Header mobile (centrado). Vuelve al Home. */}
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title={edificio}
        subtitle={registro?.Fecha || undefined}
        action={
          registro ? (
            <div className="flex items-center">
              <StatusBadge status={registro.Estado} />
            </div>
          ) : null
        }
      />

      {/* Header desktop/tablet. */}
      <ModuleHeader back="/home" title={tituloDesktop}>
        {registro ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={registro.Estado} />
            {typeof completitud === "number" ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  completitudSoft(completitud),
                )}
              >
                {completitud}%
              </span>
            ) : null}
          </div>
        ) : null}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-3 md:px-6 md:py-4">
        {isLoading ? <InlineLoader label="Cargando registro..." /> : null}

        {!isLoading && (isError || !registro) ? (
          <EmptyState
            icon={ClipboardList}
            title="Registro no disponible"
            description="No encontramos este registro o no pertenece a tu usuario."
          />
        ) : null}

        {registro ? (
          // Desktop ancho: contexto (izq, sticky) + checklist (der). Mobile: apilado.
          // grid-cols-1 (= minmax(0,1fr)) es clave: sin él la columna implícita queda en `auto`
          // y crece con el contenido → desborda el viewport en mobile (todo se corta a la derecha).
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
            {/* Columna de contexto */}
            <div className="space-y-3 xl:sticky xl:top-20">
              <div className="rounded-2xl border bg-card p-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold leading-tight text-primary">
                      {edificio}
                    </p>
                    {registro.Direccion ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{registro.Direccion}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Estado + completitud */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={registro.Estado} />
                  {typeof completitud === "number" ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        completitudSoft(completitud),
                      )}
                    >
                      {completitud}% completo
                    </span>
                  ) : null}
                </div>

                {/* Barra de completitud */}
                {typeof completitud === "number" ? (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${completitud}%` }}
                    />
                  </div>
                ) : null}

                {/* Counters OK / NO */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Counter
                    tone="ok"
                    count={registro.okCount}
                    label="OK"
                    icon={<Check className="h-3.5 w-3.5" />}
                  />
                  <Counter
                    tone="no"
                    count={registro.noCount}
                    label="Con observación"
                    icon={<X className="h-3.5 w-3.5" />}
                  />
                </div>

                {/* Metadata del registro */}
                <dl className="mt-3 divide-y divide-border/60 border-t border-border/60">
                  {registro.Tecnico ? (
                    <MetaRow icon={User} label="Técnico" value={registro.Tecnico} />
                  ) : null}
                  {registro.Fecha ? (
                    <MetaRow
                      icon={CalendarDays}
                      label="Fecha"
                      value={registro.Fecha}
                    />
                  ) : null}
                  {registro.HoraInicio ? (
                    <MetaRow
                      icon={LogIn}
                      label="Hora inicio"
                      value={registro.HoraInicio}
                    />
                  ) : null}
                  {registro.HoraFinal ? (
                    <MetaRow
                      icon={LogOut}
                      label="Hora fin"
                      value={registro.HoraFinal}
                    />
                  ) : null}
                  {registro.HoraVisita ? (
                    <MetaRow
                      icon={Clock}
                      label="Hora visita"
                      value={registro.HoraVisita}
                    />
                  ) : null}
                  {registro.Codigo ? (
                    <MetaRow
                      icon={Building2}
                      label="Cód. edificio"
                      value={registro.Codigo}
                      mono
                    />
                  ) : null}
                </dl>
              </div>

              {/* Observación general del registro (01.Registros.ObservacionGeneral).
                  El contrato del backend (RegistroDetalle) no expone una foto general,
                  así que solo se muestra el texto. */}
              {registro.ObservacionGeneral ? (
                <div className="rounded-2xl border bg-card p-3 shadow-xs">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Observación general
                  </p>
                  <blockquote className="relative rounded-lg border bg-muted/30 p-3 pl-9 text-sm leading-relaxed">
                    <Quote
                      aria-hidden
                      className="absolute left-2.5 top-2.5 h-4 w-4 text-primary/40"
                    />
                    {registro.ObservacionGeneral}
                  </blockquote>
                </div>
              ) : null}
            </div>

            {/* Columna del checklist */}
            <div className="min-w-0 space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checklist
                {total > 0 ? ` · ${total} ítem${total === 1 ? "" : "s"}` : ""}
              </h2>

              {total === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Sin ítems registrados"
                  description="Este registro no tiene ítems de checklist guardados."
                  className="py-12"
                />
              ) : (
                <ul className="space-y-1.5">
                  {registro.items.map((it, idx) => (
                    <ChecklistItemCard key={it.ID} item={it} index={idx} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChecklistItemCard({
  item,
  index,
}: {
  item: RegistroDetalleItem;
  index: number;
}) {
  const isOk = item.Check === "Ok";
  const isNo = item.Check === "No";
  const stripe = isOk
    ? "bg-success"
    : isNo
      ? "bg-destructive"
      : "bg-muted-foreground/20";

  return (
    <li className="relative overflow-hidden rounded-xl border bg-card py-2.5 pl-4 pr-3 shadow-xs">
      {/* Stripe lateral según resultado */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", stripe)}
      />

      <div className="flex items-start gap-3">
        {/* Número de ítem */}
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60 font-mono text-[10px] font-bold text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
              {item.Item || "—"}
            </p>
            <ResultPill check={item.Check} />
          </div>

          {/* Observación del ítem */}
          {item.ObservacionItem ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="italic">{item.ObservacionItem}</span>
            </p>
          ) : null}

          {/* Foto del ítem (02.Detalles no la guarda; se renderiza solo si llega). */}
          {item.foto ? (
            <div className="mt-2 overflow-hidden rounded-lg border">
              <img
                src={item.foto}
                alt={`Foto del ítem ${item.Item}`}
                className="h-auto max-h-64 w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ResultPill({ check }: { check: RegistroDetalleItem["Check"] }) {
  if (check === "Ok") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        OK
      </span>
    );
  }
  if (check === "No") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
        <X className="h-3.5 w-3.5" />
        NO
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      Sin dato
    </span>
  );
}

function Counter({
  tone,
  count,
  label,
  icon,
}: {
  tone: "ok" | "no";
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  const styles = tone === "ok" ? "text-success" : "text-destructive";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-2">
      <span className={cn("flex items-center gap-1 text-lg font-bold tabular-nums", styles)}>
        {icon}
        {count}
      </span>
      <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="flex shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-sm",
          mono ? "font-mono text-foreground/90" : "font-medium",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
