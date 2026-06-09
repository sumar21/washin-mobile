import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardEdit,
  HelpCircle,
  MessageSquareText,
  Package,
  Plus,
  Send,
  Trash2,
  User,
  Wind,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/shared/Combobox";
import {
  ResolverIncidenteDialog,
  VerRepuestosDialog,
} from "@/components/shared/ResolverIncidenteDialog";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  getIncidentes,
  crearIncidente,
  anularIncidente,
  crearVentilacionDesdeIncidente,
  getEdificios,
  getDetalleMaquina,
  getUsuarios,
  type Incidente,
} from "@/lib/api-client";

// Franja de color por estado (estados reales de 10.Incidentes).
function stripeFor(status: string) {
  switch (status) {
    case "Resuelto":
      return "bg-emerald-500";
    case "Anulado":
      return "bg-rose-500";
    case "Asignado":
    case "Aprobada":
    case "En Aprobacion":
      return "bg-blue-500";
    default:
      return "bg-amber-500"; // Pendiente / A Revisar / etc.
  }
}

export default function ScreenIncidentes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"abiertos" | "cerrados">("abiertos");
  const [q, setQ] = useState("");
  const [anular, setAnular] = useState<Incidente | null>(null);
  const [resolver, setResolver] = useState<Incidente | null>(null);
  const [revisar, setRevisar] = useState<Incidente | null>(null); // popup "?" (Continuar/Anular)
  const [verObs, setVerObs] = useState<Incidente | null>(null); // ver observación del reporte
  const [verRepuestos, setVerRepuestos] = useState<Incidente | null>(null);
  const [obsAnular, setObsAnular] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [reportarOpen, setReportarOpen] = useState(false);
  const [ventOpen, setVentOpen] = useState(false);

  // Si se llega desde el botón "Nuevo incidente" (ej. historial de máquina, con ?nuevo=1),
  // abrir directo el popup de elección Reportar / Registrar.
  useEffect(() => {
    if (searchParams.get("nuevo") === "1") {
      setTipoOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("nuevo");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  // Reportar (alta rápida): reportarEdif = NOMBRE del edificio (Combobox).
  const [reportarEdif, setReportarEdif] = useState("");
  const [reportarTec, setReportarTec] = useState("");
  const [reportarMaq, setReportarMaq] = useState(""); // "" = sin máquina (ID del ítem)
  const [reportarDesc, setReportarDesc] = useState("");
  // Ventilación
  const [ventEdif, setVentEdif] = useState("");
  const [ventDesc, setVentDesc] = useState("");

  // El backend scopea por técnico y separa por estado (NO=abiertos, SI=cerrados).
  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ["incidentes", tab],
    queryFn: () => getIncidentes(tab === "cerrados" ? "SI" : "NO"),
  });
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: maquinas = [] } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => getDetalleMaquina(),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: getUsuarios,
  });

  const myName = user?.Concat_Nombre_Apellido;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return incidentes;
    return incidentes.filter(
      (i) =>
        i.NombreEdificio_IN.toLowerCase().includes(t) ||
        i.ConcatMaquina_IN.toLowerCase().includes(t) ||
        i.Descripcion_IN.toLowerCase().includes(t),
    );
  }, [incidentes, q]);

  // Default del técnico en "Reportar" = usuario logueado (cuando llega el dato).
  useEffect(() => {
    if (myName && !reportarTec) setReportarTec(myName);
  }, [myName, reportarTec]);

  // Máquinas del edificio elegido en "Reportar" (reportarEdif = CÓDIGO; hay nombres repetidos).
  const reportarEdifSel = edificios.find((e) => e.Codigo === reportarEdif);
  const reportarMaquinas = reportarEdifSel
    ? maquinas.filter((m) => m.CodigoEdificio_DM === reportarEdifSel.Codigo)
    : [];
  // Opciones de edificio con value=Codigo (único). Si el nombre se repite, se muestra el código.
  const edificioOpts = useMemo(() => {
    const activos = edificios.filter((e) => e.Status === "ALTA");
    const dup = new Map<string, number>();
    for (const e of activos) dup.set(e.Edificio, (dup.get(e.Edificio) ?? 0) + 1);
    return activos
      .map((e) => ({
        value: e.Codigo,
        label:
          (dup.get(e.Edificio) ?? 0) > 1
            ? `${e.Edificio} · ${e.Codigo}`
            : e.Edificio,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [edificios]);
  const tecnicoNames = Array.from(
    new Set(
      usuarios
        .filter((u) => u.Rol === "Tecnico" && u.Status === "ALTA")
        .map((u) => u.Concat_Nombre_Apellido),
    ),
  ).sort();

  async function onAnular() {
    if (!anular) return;
    if (!obsAnular.trim()) {
      toast.error("Indicá el motivo de anulación");
      return;
    }
    try {
      await anularIncidente(anular.ID, obsAnular);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular");
      return;
    }
    setAnular(null);
    setObsAnular("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente anulado");
  }

  // Alta RÁPIDA (PowerApps "reportar"): crea el incidente "A Revisar" + WhatsApp al técnico.
  // Máquina opcional; Categoría "Agua" la pone el backend.
  async function onReportar() {
    if (!reportarEdif || !reportarDesc.trim()) {
      toast.error("Falta el edificio o la descripción");
      return;
    }
    const e = reportarEdifSel;
    if (!e) {
      toast.error("Edificio no válido");
      return;
    }
    const m = reportarMaq
      ? reportarMaquinas.find((x) => String(x.ID) === reportarMaq)
      : undefined;
    const maqId = m?.IDMaquina_DM ?? "";
    let nuevoId: string;
    try {
      const res = await crearIncidente({
        IDMaquina_IN: maqId,
        ConcatMaquina_IN: m?.ConcatMaquina_DM ?? "",
        CodigoEdifcio_IN: e.Codigo,
        NombreEdificio_IN: e.Edificio,
        TecnicoAsignado_IN: reportarTec,
        Descripcion: reportarDesc,
      });
      nuevoId = res.id;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear el incidente",
      );
      return;
    }
    // WhatsApp al técnico (como PowerApps).
    const tel = usuarios.find(
      (u) => u.Concat_Nombre_Apellido === reportarTec,
    )?.Telefono;
    if (tel) {
      const msg = `INCIDENTE N: ${nuevoId}\nEDIFICIO: ${e.Edificio}\nMAQUINA: ${m?.ConcatMaquina_DM ?? "(sin máquina)"}\nOBSERVACIONES: ${reportarDesc}`;
      window.open(
        `https://wa.me/54${tel.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }
    setReportarOpen(false);
    setReportarEdif("");
    setReportarMaq("");
    setReportarDesc("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente reportado");
  }

  async function onGenerarVentilacion() {
    if (!ventEdif) {
      toast.error("Elegí un edificio para la ventilación");
      return;
    }
    const e = edificios.find((x) => x.Codigo === ventEdif);
    try {
      await crearVentilacionDesdeIncidente({
        edificio: e?.Edificio ?? ventEdif,
        idEdificio: e?.ID,
        observacion: ventDesc.trim() || undefined,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo generar la ventilación",
      );
      return;
    }
    setVentOpen(false);
    setVentEdif("");
    setVentDesc("");
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación generada");
  }

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setVentOpen(true)}
        aria-label="Generar ventilación"
        className="h-10 gap-1.5 rounded-xl border-cyan-300 bg-cyan-50/50 px-3 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300"
      >
        <Wind className="h-4 w-4" />
        <span className="hidden sm:inline">Ventilación</span>
      </Button>
      <Button
        type="button"
        onClick={() => setTipoOpen(true)}
        aria-label="Nuevo incidente"
        className="h-10 gap-1.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-3 shadow-sm shadow-blue-600/25 ring-1 ring-white/10 transition-transform hover:-translate-y-px"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Incidente</span>
      </Button>
    </>
  );

  const searchInput = (
    <div className="relative w-full">
      <SearchBar
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por edificio, máquina o descripción..."
        className="h-11 pr-10"
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

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader className="md:hidden" back="/home" action={actionButtons} />
      <ModuleHeader
        title="Incidentes"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "incidente" : "incidentes"}`}
      >
        <div className="w-72 lg:w-80">{searchInput}</div>
        {actionButtons}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-4 md:px-6 md:py-5">
        {/* Buscador mobile (en desktop está en el ModuleHeader). */}
        <div className="md:hidden">{searchInput}</div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid h-10 w-full grid-cols-2 md:w-64">
            <TabsTrigger value="abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados">Cerrados</TabsTrigger>
          </TabsList>
          <TabsContent
            value={tab}
            className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {isLoading ? <InlineLoader /> : null}
            {!isLoading && filtered.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Sin incidentes"
                className="md:col-span-full"
              />
            ) : null}
            {filtered.map((i) => {
              const isClosed =
                i.Status_IN === "Anulado" || i.Status_IN === "Resuelto";
              const isRevisarState = i.Status_IN === "A Revisar";
              return (
                <Card
                  key={i.ID}
                  className="relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1 ${stripeFor(i.Status_IN)}`}
                  />
                  <CardContent className="space-y-2 p-3 pl-4">
                    {/* Top row: avatar + edificio + status */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight text-primary">
                          {i.NombreEdificio_IN}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono font-semibold text-foreground/80">
                            #{i.IDIncidente}
                          </span>
                          <span className="truncate font-medium text-foreground/70">
                            {i.ConcatMaquina_IN}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={i.Status_IN} />
                    </div>

                    {/* Pendiente de revisión (A Revisar) */}
                    {isRevisarState ? (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                        Pendiente de revisión
                      </p>
                    ) : null}

                    {/* Descripción / observación del reporte */}
                    <p className="text-sm leading-snug">
                      {isRevisarState ? i.DescripcionCarga_IN : i.Descripcion_IN}
                    </p>

                    {/* Footer: fecha + tecnico */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span className="font-medium tabular-nums tracking-tight">
                          {i.Fecha_IN}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate font-medium text-foreground/80">
                          {i.TecnicoAsignado_IN}
                        </span>
                      </span>
                    </div>

                    {/* Acciones por estado */}
                    {isRevisarState ? (
                      // A Revisar → ver observación + "?" (Continuar / Anular)
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVerObs(i)}
                          className="h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <MessageSquareText className="h-3.5 w-3.5" /> Observación
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setRevisar(i)}
                          className="ml-auto h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <HelpCircle className="h-3.5 w-3.5" /> Revisar
                        </Button>
                      </div>
                    ) : !isClosed ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVerRepuestos(i)}
                          className="h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <Package className="h-3.5 w-3.5" /> Repuestos
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setResolver(i)}
                          className="h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnular(i)}
                          className="ml-auto h-8 gap-1.5 border-rose-200 px-2.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Anular
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Tipo Incidente — choice popup */}
      <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-destructive/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-red-500/5 text-red-600 ring-1 ring-red-200/60 dark:text-red-400 dark:ring-red-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Tipo de incidente
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Cómo querés registrar el incidente?
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setTipoOpen(false);
                navigate("/incidentes/nuevo");
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Registrar</p>
                <p className="text-xs text-muted-foreground">
                  Carga completa: categoría, estado, repuestos y foto.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoOpen(false);
                setReportarOpen(true);
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Reportar</p>
                <p className="text-xs text-muted-foreground">
                  Alta rápida del incidente y aviso al técnico por WhatsApp.
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 w-full sm:w-auto">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reportar incidente — envío por mail */}
      <Dialog open={reportarOpen} onOpenChange={setReportarOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 ring-1 ring-amber-200/60 dark:text-amber-400 dark:ring-amber-500/20">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Reportar incidente
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alta rápida + aviso al técnico por WhatsApp.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio <span className="text-destructive">*</span>
              </label>
              <Combobox
                value={reportarEdif}
                onChange={(v) => {
                  setReportarEdif(v);
                  setReportarMaq("");
                }}
                options={edificioOpts}
                showAll={false}
                placeholder="Elegir edificio"
                searchPlaceholder="Buscar edificio…"
                emptyText="Sin edificios"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Técnico
              </label>
              <Combobox
                value={reportarTec}
                onChange={setReportarTec}
                options={tecnicoNames}
                showAll={false}
                placeholder="Elegir técnico"
                searchPlaceholder="Buscar técnico…"
                emptyText="Sin técnicos"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Máquina (opcional)
              </label>
              <Combobox
                value={reportarMaq}
                onChange={setReportarMaq}
                options={reportarMaquinas.map((m) => ({
                  value: String(m.ID),
                  label: `${m.ConcatMaquina_DM} · N° ${m.NroSerie_DM}`,
                }))}
                showAll={false}
                disabled={!reportarEdifSel}
                placeholder={
                  reportarEdifSel ? "Elegir máquina" : "Elegí un edificio primero"
                }
                searchPlaceholder="Buscar máquina…"
                emptyText="Sin máquinas"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Descripción <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={reportarDesc}
                onChange={(e) => setReportarDesc(e.target.value)}
                rows={3}
                placeholder="Detalle breve del incidente..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={onReportar}
              disabled={!reportarEdif || !reportarDesc.trim()}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-amber-500 to-amber-600 sm:flex-none"
            >
              <Send className="h-4 w-4" />
              Reportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generar ventilación */}
      <Dialog open={ventOpen} onOpenChange={setVentOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-500/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 text-cyan-600 ring-1 ring-cyan-200/60 dark:text-cyan-300 dark:ring-cyan-500/20">
                <Wind className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Generar ventilación
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Para qué edificio desea generar la ventilación?
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio <span className="text-destructive">*</span>
              </label>
              <Select value={ventEdif} onValueChange={setVentEdif}>
                <SelectTrigger className="h-11 md:h-10">
                  <SelectValue placeholder="Buscar elementos..." />
                </SelectTrigger>
                <SelectContent>
                  {edificios
                    .filter((e) => e.Status === "ALTA")
                    .map((e) => (
                      <SelectItem key={e.ID} value={e.Codigo}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {e.Edificio}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Descripción
              </label>
              <Textarea
                value={ventDesc}
                onChange={(e) => setVentDesc(e.target.value)}
                rows={3}
                placeholder="Notas u observaciones (opcional)..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={onGenerarVentilacion}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-cyan-500 to-cyan-600 sm:flex-none"
            >
              <Wind className="h-4 w-4" />
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revisar (A Revisar) — elegir Continuar o Anular */}
      <Dialog open={!!revisar} onOpenChange={(o) => !o && setRevisar(null)}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 text-indigo-600 ring-1 ring-indigo-200/60 dark:text-indigo-400 dark:ring-indigo-500/20">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Revisar incidente #{revisar?.IDIncidente}
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {revisar?.NombreEdificio_IN}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                const inc = revisar;
                setRevisar(null);
                if (inc)
                  navigate(`/incidentes/${inc.ID}/revisar`, {
                    state: { incidente: inc },
                  });
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Continuar</p>
                <p className="text-xs text-muted-foreground">
                  Cargar máquina, categoría, repuestos y resolver.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                const inc = revisar;
                setRevisar(null);
                setAnular(inc);
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Anular</p>
                <p className="text-xs text-muted-foreground">
                  Descartar el incidente con un motivo.
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 w-full sm:w-auto">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver observación del reporte (A Revisar) */}
      <Dialog open={!!verObs} onOpenChange={(o) => !o && setVerObs(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle>Observación del incidente</DialogTitle>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {verObs?.DescripcionCarga_IN || "Sin observación."}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={!!anular} onOpenChange={(o) => !o && setAnular(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Anular incidente #{anular?.IDIncidente}</DrawerTitle>
            <DrawerDescription>
              Indicá el motivo. Se enviará una notificación.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Textarea
              value={obsAnular}
              onChange={(e) => setObsAnular(e.target.value)}
              placeholder="Motivo de anulación..."
              rows={4}
            />
          </div>
          <DrawerFooter>
            <Button variant="destructive" onClick={onAnular}>
              Confirmar anulación
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Resolver incidente (con repuesto / sin repuesto / requiere repuesto / cambio de máquina) */}
      <ResolverIncidenteDialog
        incidente={resolver}
        onClose={() => setResolver(null)}
        onResolved={() => {
          setResolver(null);
          qc.invalidateQueries({ queryKey: ["incidentes"] });
          qc.invalidateQueries({ queryKey: ["stock-tecnico"] });
        }}
      />

      {/* Ver repuestos del incidente (13.RepuestosIncidentes) */}
      <VerRepuestosDialog
        incidente={verRepuestos}
        onClose={() => setVerRepuestos(null)}
      />
    </div>
  );
}
