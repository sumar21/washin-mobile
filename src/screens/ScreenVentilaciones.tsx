import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wind,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  History,
  MapPin,
  Repeat,
  AlertTriangle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { parseAR, dateToAR, isDueOrPast } from "@/lib/fecha";
import { useBorrador } from "@/hooks/use-borrador";
import {
  getVentilaciones,
  programarVentilacion,
  finalizarVentilacion,
  type Ventilacion,
} from "@/lib/api-client";

type EstadoFiltro = "todas" | "Asignada" | "Programada";

export default function ScreenVentilaciones() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("todas");

  // El backend ya scopea por usuario (técnico → solo las suyas) y trae solo las
  // activas (Asignada/Programada). Acá filtramos por estado + búsqueda.
  const { data: ventilaciones = [], isLoading } = useQuery({
    queryKey: ["ventilaciones"],
    queryFn: getVentilaciones,
  });

  const counts = useMemo(
    () => ({
      todas: ventilaciones.length,
      Asignada: ventilaciones.filter((v) => v.Estado_VE === "Asignada").length,
      Programada: ventilaciones.filter((v) => v.Estado_VE === "Programada")
        .length,
    }),
    [ventilaciones],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ventilaciones.filter((v) => {
      if (estado !== "todas" && v.Estado_VE !== estado) return false;
      if (!t) return true;
      return (
        v.Edificio_VE.toLowerCase().includes(t) ||
        v.DireccionEdificio_VE.toLowerCase().includes(t) ||
        v.Grupo_VE.toLowerCase().includes(t) ||
        v.Frecuencia_VE.toLowerCase().includes(t)
      );
    });
  }, [ventilaciones, q, estado]);

  const [programar, setProgramar] = useState<Ventilacion | null>(null);
  const [finalizar, setFinalizar] = useState<Ventilacion | null>(null);
  const [fechaProgDate, setFechaProgDate] = useState<Date | undefined>(undefined);
  const [obsFin, setObsFin] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Aislamiento entre ventilaciones ──────────────────────────────────────────────────────
  // Bug real, ya en producción: `confirmFinalizar` solo limpia `obsFin`/`foto` en el camino de
  // ÉXITO (después del `return` del catch), y cerrar el diálogo solo hace `setFinalizar(null)`.
  // Si el técnico cancela —o si el finalizar falla— y abre OTRO edificio, el textarea aparecía
  // precargado con la observación del anterior; como el único gate es `!obsFin.trim()`, podía
  // confirmarla sin darse cuenta y escribir el trabajo del edificio A en el registro del B
  // (irreversible desde la mobile: el mismo handler marca "Realizada" y genera el próximo ciclo).
  //
  // Se limpia SOLO al cambiar de ventilación, no al abrir. En mobile el diálogo es un Drawer que
  // se cierra con swipe o con un tap en el overlay: un reset ciego al abrir le borraría todo al
  // técnico por un roce y lo obligaría a abrir la cámara otra vez, que es justo el disparador del
  // descarte de pestaña que estamos combatiendo. PowerApps hacía `Reset()` también al cancelar
  // (Screen_Ventilaciones.pa.yaml:356,390,464), pero ahí no existía el gesto de descarte
  // accidental: los popups eran flags `Visible` con botones explícitos. Se desvía a propósito.
  const [borradorDe, setBorradorDe] = useState<number | null>(null);
  if (finalizar && finalizar.ID !== borradorDe) {
    setBorradorDe(finalizar.ID);
    setObsFin("");
    setFoto(null);
  }

  // Borrador local del "finalizar" (ver hooks/use-borrador.ts): el técnico saca la foto con la
  // cámara nativa y el sistema puede descartar la pestaña mientras tanto. Scopeado por
  // ventilación + técnico, así que nunca se restaura en el edificio equivocado.
  const { limpiar: limpiarBorrador } = useBorrador({
    scope: "ventilacion",
    id: finalizar?.ID ?? null,
    activo: !!finalizar,
    valor: { obsFin },
    foto,
    sucio: obsFin.trim() !== "" || foto !== null,
    descripcion: finalizar?.Edificio_VE,
    aplicar: (v, fotoGuardada) => {
      setObsFin(v.obsFin ?? "");
      setFoto(fotoGuardada);
    },
    descartar: () => {
      setObsFin("");
      setFoto(null);
    },
  });

  function openProgramar(v: Ventilacion) {
    // Default igual a PowerApps: si está Asignada usa la próxima limpieza; si ya está
    // Programada, la fecha programada.
    const base =
      v.Estado_VE === "Asignada" ? v.ProximaLimpieza_VE : v.FechaProgramada_VE;
    setFechaProgDate(parseAR(base) ?? undefined);
    setProgramar(v);
  }

  async function confirmProgramar() {
    if (!programar || !fechaProgDate) {
      toast.error("Seleccioná una fecha");
      return;
    }
    setSaving(true);
    try {
      await programarVentilacion(programar.ID, dateToAR(fechaProgDate));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo programar");
      return;
    } finally {
      setSaving(false);
    }
    setProgramar(null);
    setFechaProgDate(undefined);
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación programada");
  }

  async function confirmFinalizar() {
    if (!finalizar) return;
    if (!obsFin.trim()) {
      toast.error("Agregá una observación");
      return;
    }
    setSaving(true);
    try {
      // Nota: la foto se captura en la UI pero su subida (flujo Power Automate
      // "WashInn-FotoVentilacion") todavía no está portada al backend.
      await finalizarVentilacion(finalizar.ID, obsFin);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo finalizar");
      return;
    } finally {
      setSaving(false);
    }
    // Guardado en SharePoint → el borrador ya no sirve. Antes que el reset de estado, porque
    // `setFinalizar(null)` deja al hook sin clave.
    limpiarBorrador();
    setFinalizar(null);
    setObsFin("");
    setFoto(null);
    setBorradorDe(null);
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación finalizada");
  }

  const searchInput = (
    <div className="relative w-full">
      <SearchBar
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar edificio, dirección o grupo..."
        className="h-11 pr-9"
      />
      {q ? (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-accent"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  const estadoFilter = (
    <ToggleGroup
      type="single"
      value={estado}
      onValueChange={(v) => v && setEstado(v as EstadoFiltro)}
      variant="outline"
      size="sm"
      className="justify-start"
    >
      <ToggleGroupItem value="todas" className="gap-1.5">
        Todas
        <span className="text-xs text-muted-foreground">{counts.todas}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="Asignada" className="gap-1.5">
        Asignadas
        <span className="text-xs text-muted-foreground">{counts.Asignada}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="Programada" className="gap-1.5">
        Programadas
        <span className="text-xs text-muted-foreground">
          {counts.Programada}
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Ventilaciones"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "ventilación" : "ventilaciones"}`}
      />
      <ModuleHeader
        title="Ventilaciones"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "ventilación" : "ventilaciones"}`}
      >
        <div className="w-72 lg:w-80">{searchInput}</div>
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
        {/* Buscador mobile (en desktop está en el ModuleHeader). */}
        <div className="md:hidden">{searchInput}</div>
        <div className="overflow-x-auto">{estadoFilter}</div>

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Wind}
            title="Sin ventilaciones"
            description={
              estado === "todas"
                ? "No tenés ventilaciones asignadas."
                : "No hay ventilaciones con ese estado."
            }
          />
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <>
            {/* Mobile: cards apiladas (una por ventilación). */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filtered.map((v) => (
                <VentilacionCard
                  key={v.ID}
                  v={v}
                  onProgramar={() => openProgramar(v)}
                  onFinalizar={() => setFinalizar(v)}
                />
              ))}
            </div>

            {/* Desktop/tablet: grilla estándar (DataTable: columna principal flexible + sortable).
                Sin navegación por fila: las acciones viven en botones (Programar/Finalizar). */}
            <DataTable
              className="hidden md:block"
              data={filtered}
              getRowKey={(v) => v.ID}
              initialSort={{ key: "edificio" }}
              columns={[
                {
                  key: "edificio",
                  header: "Edificio",
                  primary: true,
                  sortable: true,
                  sortAccessor: (v) => v.Edificio_VE,
                  cell: (v) => (
                    <div className="flex items-center gap-2">
                      <CellTitleSubtitle
                        icon={Wind}
                        title={v.Edificio_VE}
                        subtitle={v.DireccionEdificio_VE || undefined}
                      />
                      {(v.EsIncidente_VE ?? "")
                        .trim()
                        .toUpperCase()
                        .startsWith("S") ? (
                        <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          Incidente
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "frecuencia",
                  header: "Frecuencia",
                  sortable: true,
                  sortAccessor: (v) => v.Frecuencia_VE,
                  cell: (v) =>
                    v.Frecuencia_VE ? (
                      <Pill tone="neutral">cada {v.Frecuencia_VE} días</Pill>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "fecha",
                  header: "Fecha",
                  sortable: true,
                  sortAccessor: (v) =>
                    v.FechaProgramada_VE || v.ProximaLimpieza_VE || "",
                  cell: (v) => {
                    const fecha =
                      v.FechaProgramada_VE || v.ProximaLimpieza_VE || "";
                    const fechaLabel = v.FechaProgramada_VE
                      ? "Programada"
                      : "Próxima";
                    return fecha ? (
                      <span className="block text-sm">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {fechaLabel}
                        </span>
                        <span className="font-medium">{fecha}</span>
                      </span>
                    ) : (
                      "—"
                    );
                  },
                },
                {
                  key: "ultima",
                  header: "Última",
                  sortable: true,
                  sortAccessor: (v) => v.FechaUltima_VE || "",
                  cell: (v) => (
                    <span className="text-sm">{v.FechaUltima_VE || "—"}</span>
                  ),
                },
                {
                  key: "estado",
                  header: "Estado",
                  sortable: true,
                  sortAccessor: (v) => v.Estado_VE,
                  cell: (v) => <StatusBadge status={v.Estado_VE} />,
                },
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right",
                  cell: (v) => {
                    const programada = v.Estado_VE === "Programada";
                    const puedeFinalizar =
                      programada && isDueOrPast(v.FechaProgramada_VE);
                    return (
                      <div className="flex items-center justify-end gap-2 flex-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 gap-1.5 px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProgramar(v);
                          }}
                        >
                          <CalendarDays />
                          {programada ? "Reprogramar" : "Programar"}
                        </Button>
                        {puedeFinalizar ? (
                          <Button
                            size="sm"
                            className="h-9 gap-1.5 px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFinalizar(v);
                            }}
                          >
                            <CheckCircle2 /> Finalizar
                          </Button>
                        ) : null}
                      </div>
                    );
                  },
                },
              ]}
            />
          </>
        ) : null}
      </div>

      {/* Programar visita: Dialog centrado en desktop, Drawer (bottom sheet) en mobile. */}
      <ResponsiveDialog
        open={!!programar}
        onOpenChange={(o) => !o && setProgramar(null)}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-md rounded-2xl"
        >
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Programar visita</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {programar?.Edificio_VE}
              {programar?.DireccionEdificio_VE
                ? ` · ${programar.DireccionEdificio_VE}`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            {/* Fecha elegida, grande y legible (pensado para uso en obra). */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha elegida
                </p>
                <p className="text-base font-semibold capitalize leading-tight">
                  {fechaProgDate
                    ? format(fechaProgDate, "EEEE d 'de' MMMM 'de' yyyy", {
                        locale: es,
                      })
                    : "Tocá un día en el calendario"}
                </p>
              </div>
            </div>
            {/* Calendario inline grande. */}
            <div className="flex justify-center rounded-xl border bg-card">
              <Calendar
                mode="single"
                locale={es}
                selected={fechaProgDate}
                onSelect={setFechaProgDate}
                defaultMonth={fechaProgDate}
              />
            </div>
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancelar
              </Button>
            </ResponsiveDialogClose>
            <Button
              onClick={confirmProgramar}
              disabled={saving || !fechaProgDate}
            >
              {saving ? "Guardando…" : "Confirmar"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Finalizar ventilación: Dialog en desktop, Drawer en mobile. */}
      <ResponsiveDialog
        open={!!finalizar}
        onOpenChange={(o) => !o && setFinalizar(null)}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-md rounded-2xl"
        >
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Finalizar ventilación</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {finalizar?.Edificio_VE}
              {finalizar?.DireccionEdificio_VE
                ? ` · ${finalizar.DireccionEdificio_VE}`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            <div>
              <Label htmlFor="obs-fin">Observación</Label>
              <Textarea
                id="obs-fin"
                value={obsFin}
                onChange={(e) => setObsFin(e.target.value)}
                placeholder="Detalle del trabajo realizado..."
                rows={3}
                className="mt-1"
              />
            </div>
            <PhotoCapture
              label="Foto de la ventilación"
              value={foto}
              onChange={setFoto}
            />
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancelar
              </Button>
            </ResponsiveDialogClose>
            <Button onClick={confirmFinalizar} disabled={saving}>
              {saving ? "Guardando…" : "Finalizar"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function VentilacionCard({
  v,
  onProgramar,
  onFinalizar,
}: {
  v: Ventilacion;
  onProgramar: () => void;
  onFinalizar: () => void;
}) {
  const programada = v.Estado_VE === "Programada";
  const fecha = v.FechaProgramada_VE || v.ProximaLimpieza_VE || "";
  const fechaLabel = v.FechaProgramada_VE ? "Programada" : "Próxima";
  const puedeFinalizar = programada && isDueOrPast(v.FechaProgramada_VE);
  const esIncidente = (v.EsIncidente_VE ?? "").trim().toUpperCase().startsWith("S");

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
            <Wind className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 font-semibold leading-tight text-primary">
              {v.Edificio_VE}
            </p>
            {v.DireccionEdificio_VE ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{v.DireccionEdificio_VE}</span>
              </p>
            ) : null}
          </div>
          <StatusBadge status={v.Estado_VE} />
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {v.Frecuencia_VE ? (
            <Meta
              icon={Repeat}
              label="Frecuencia"
              value={`cada ${v.Frecuencia_VE} días`}
            />
          ) : null}
          {fecha ? (
            <Meta icon={CalendarClock} label={fechaLabel} value={fecha} />
          ) : null}
          {v.FechaUltima_VE ? (
            <Meta icon={History} label="Última" value={v.FechaUltima_VE} />
          ) : null}
        </dl>

        {esIncidente ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
            <AlertTriangle className="h-3 w-3" />
            Incidente
          </span>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t bg-muted/30 p-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1 gap-1.5"
            onClick={onProgramar}
          >
            <CalendarDays />
            {programada ? "Reprogramar" : "Programar"}
          </Button>
          {puedeFinalizar ? (
            <Button className="h-10 flex-1 gap-1.5" onClick={onFinalizar}>
              <CheckCircle2 /> Finalizar
            </Button>
          ) : null}
        </div>
        {programada && !puedeFinalizar ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Finalizable desde el {v.FechaProgramada_VE}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground/90">
        {value}
      </dd>
    </div>
  );
}
