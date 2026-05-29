import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ClipboardEdit,
  Mail,
  Plus,
  Send,
  Trash2,
  User,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import type { EstadoIncidente, Incidente } from "@/data/types";

function stripeFor(status: EstadoIncidente) {
  switch (status) {
    case "Resuelto":
      return "bg-emerald-500";
    case "Anulado":
      return "bg-rose-500";
    case "En proceso":
      return "bg-blue-500";
    default:
      return "bg-amber-500";
  }
}

function IncidentePill({ status }: { status: EstadoIncidente }) {
  const styles: Record<EstadoIncidente, string> = {
    Pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    "En proceso": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    Resuelto:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    Anulado: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function ScreenIncidentes() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [tab, setTab] = useState<"abiertos" | "cerrados">("abiertos");
  const [q, setQ] = useState("");
  const [crear, setCrear] = useState(false);
  const [anular, setAnular] = useState<Incidente | null>(null);
  const [obsAnular, setObsAnular] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [reportarOpen, setReportarOpen] = useState(false);
  const [ventOpen, setVentOpen] = useState(false);
  // Reportar
  const [reportarEdif, setReportarEdif] = useState("");
  const [reportarDesc, setReportarDesc] = useState("");
  // Ventilación
  const [ventEdif, setVentEdif] = useState("");
  const [ventDesc, setVentDesc] = useState("");

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ["incidentes"],
    queryFn: () => api.listIncidentes(),
  });
  const { data: edificios = [] } = useQuery({ queryKey: ["edificios"], queryFn: () => api.listEdificios() });
  const { data: maquinas = [] } = useQuery({ queryKey: ["detalle-maquina"], queryFn: () => api.listDetalleMaquina() });
  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios"], queryFn: () => api.listUsuarios() });

  const myName = user?.Concat_Nombre_Apellido;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return incidentes
      .filter((i) => (user?.Rol === "Tecnico" ? i.TecnicoAsignado_IN === myName : true))
      .filter((i) =>
        tab === "abiertos" ? !["Resuelto", "Anulado"].includes(i.Status_IN) : ["Resuelto", "Anulado"].includes(i.Status_IN),
      )
      .filter(
        (i) =>
          !t ||
          i.NombreEdificio_IN.toLowerCase().includes(t) ||
          i.ConcatMaquina_IN.toLowerCase().includes(t) ||
          i.Descripcion_IN.toLowerCase().includes(t),
      )
      .sort((a, b) => b.IDIncidente - a.IDIncidente);
  }, [incidentes, q, tab, user, myName]);

  // formulario crear
  const [edif, setEdif] = useState<string>("");
  const [maq, setMaq] = useState<string>("");
  const [tec, setTec] = useState<string>(myName ?? "");
  const [desc, setDesc] = useState<string>("");
  const [foto, setFoto] = useState<string | null>(null);

  async function onCrear() {
    if (!edif || !maq || !desc.trim()) {
      toast.error("Faltan campos", { description: "Edificio, máquina y descripción son obligatorios" });
      return;
    }
    const m = maquinas.find((x) => x.IDMaquina_DM === maq);
    const e = edificios.find((x) => x.Codigo === edif);
    await api.createIncidente({
      IDMaquina_IN: maq,
      ConcatMaquina_IN: m?.ConcatMaquina_DM ?? maq,
      CodigoEdifcio_IN: edif,
      NombreEdificio_IN: e?.Edificio ?? "",
      TecnicoAsignado_IN: tec,
      Descripcion_IN: desc,
      Fecha_IN: new Date().toLocaleDateString("es-AR"),
      Status_IN: "Pendiente",
      Resuelto_IN: "NO",
      RequiereRepuesto_IN: "NO",
      Foto: foto ?? undefined,
    });
    setCrear(false);
    setEdif("");
    setMaq("");
    setDesc("");
    setFoto(null);
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente creado");
  }

  async function onAnular() {
    if (!anular) return;
    if (!obsAnular.trim()) {
      toast.error("Indicá el motivo de anulación");
      return;
    }
    await api.patchIncidente(anular.ID, {
      Status_IN: "Anulado",
      Resuelto_IN: "SI",
      DescripcionAnulado_IN: obsAnular,
    });
    await api.sendEmail({
      to: "paul.risau@wash-innsystem.com.ar",
      subject: `Incidente N: ${anular.IDIncidente} Anulado`,
      html: `<p>El incidente <b>${anular.IDIncidente}</b> fue anulado.</p><p>Motivo: ${obsAnular}</p>`,
    });
    setAnular(null);
    setObsAnular("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente anulado", { description: "Se envió la notificación" });
  }

  async function onReportar() {
    if (!reportarEdif || !reportarDesc.trim()) {
      toast.error("Falta el edificio o la descripción");
      return;
    }
    const e = edificios.find((x) => x.Codigo === reportarEdif);
    await api.sendEmail({
      to: e?.Correo || "paul.risau@wash-innsystem.com.ar",
      subject: `Reporte de incidente — ${e?.Edificio ?? reportarEdif}`,
      html: `<p>Reportado por <b>${myName}</b>.</p><p>${reportarDesc}</p>`,
    });
    setReportarOpen(false);
    setReportarEdif("");
    setReportarDesc("");
    toast.success("Reporte enviado", { description: "Se notificó por mail" });
  }

  async function onGenerarVentilacion() {
    if (!ventEdif) {
      toast.error("Elegí un edificio para la ventilación");
      return;
    }
    const e = edificios.find((x) => x.Codigo === ventEdif);
    await api.createVentilacion({
      IDAsignado_VE: user?.ID ?? 0,
      Edificio_VE: e?.Edificio ?? ventEdif,
      Grupo_VE: "Grupo A - Lavandería",
      Frecuencia_VE: "Mensual",
      Estado_VE: "Asignada",
      Orden_VE: "1",
      EsIncidente_VE: "SI",
      ObservacionResuelto_VE: ventDesc.trim() || undefined,
    });
    setVentOpen(false);
    setVentEdif("");
    setVentDesc("");
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación generada");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        back="/home"
        action={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVentOpen(true)}
              aria-label="Generar ventilación"
              className="h-10 gap-1 rounded-xl border-cyan-300 bg-cyan-50/50 px-2.5 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300"
            >
              <Wind className="h-4 w-4" />
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              onClick={() => setTipoOpen(true)}
              aria-label="Nuevo incidente"
              className="relative h-10 gap-1 overflow-hidden rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 px-2.5 ring-1 ring-white/10 transition-transform hover:-translate-y-px"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent"
              />
              <span aria-hidden className="relative text-base leading-none">
                🏢
              </span>
              <Plus className="relative h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-3 md:p-6">
        <div className="relative">
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid h-10 w-full grid-cols-2">
            <TabsTrigger value="abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados">Cerrados</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3 grid gap-2 md:grid-cols-2">
            {isLoading ? <InlineLoader /> : null}
            {!isLoading && filtered.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Sin incidentes" className="md:col-span-2" />
            ) : null}
            {filtered.map((i) => {
              const isClosed = i.Status_IN === "Anulado" || i.Status_IN === "Resuelto";
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
                      <IncidentePill status={i.Status_IN} />
                    </div>

                    {/* Descripción */}
                    <p className="text-sm leading-snug">{i.Descripcion_IN}</p>

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

                    {/* Acciones (solo cuando está abierto) */}
                    {!isClosed ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.info("Ver repuestos (mock)")}
                          className="h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Repuestos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.info("Notificar (mock)")}
                          className="h-8 gap-1.5 px-2.5 text-xs"
                        >
                          <Mail className="h-3.5 w-3.5" /> Notificar
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
                setCrear(true);
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Registrar</p>
                <p className="text-xs text-muted-foreground">
                  Carga completa: máquina, repuestos y descripción.
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
                  Aviso rápido por mail con edificio y descripción.
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
                  Mandamos un mail al encargado del edificio.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio <span className="text-destructive">*</span>
              </label>
              <Select value={reportarEdif} onValueChange={setReportarEdif}>
                <SelectTrigger className="h-11 md:h-10">
                  <SelectValue placeholder="Buscar elementos..." />
                </SelectTrigger>
                <SelectContent>
                  {edificios
                    .filter((e) => e.Status === "ALTA")
                    .map((e) => (
                      <SelectItem key={e.ID} value={e.Codigo}>
                        {e.Edificio}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-amber-500 to-amber-600 sm:flex-none"
            >
              <Send className="h-4 w-4" />
              Enviar
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

      <Drawer open={crear} onOpenChange={setCrear}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nuevo incidente</DrawerTitle>
            <DrawerDescription>Registrar problema en una máquina</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-2">
            <div>
              <Label>Edificio</Label>
              <Select value={edif} onValueChange={setEdif}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar edificio" />
                </SelectTrigger>
                <SelectContent>
                  {edificios
                    .filter((e) => e.Status === "ALTA")
                    .map((e) => (
                      <SelectItem key={e.ID} value={e.Codigo}>
                        {e.Edificio}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Máquina</Label>
              <Select value={maq} onValueChange={setMaq} disabled={!edif}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={edif ? "Seleccionar máquina" : "Elegí un edificio primero"} />
                </SelectTrigger>
                <SelectContent>
                  {maquinas
                    .filter((m) => m.CodigoEdificio_DM === edif)
                    .map((m) => (
                      <SelectItem key={m.ID} value={m.IDMaquina_DM}>
                        {m.ConcatMaquina_DM}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Técnico asignado</Label>
              <Select value={tec} onValueChange={setTec}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios
                    .filter((u) => u.Rol === "Tecnico" && u.Status === "ALTA")
                    .map((u) => (
                      <SelectItem key={u.ID} value={u.Concat_Nombre_Apellido}>
                        {u.Concat_Nombre_Apellido}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Detalle del problema..."
                className="mt-1"
              />
            </div>
            <PhotoCapture label="Foto del incidente" value={foto} onChange={setFoto} />
          </div>
          <DrawerFooter>
            <Button onClick={onCrear}>Crear incidente</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={!!anular} onOpenChange={(o) => !o && setAnular(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Anular incidente #{anular?.IDIncidente}</DrawerTitle>
            <DrawerDescription>Indicá el motivo. Se enviará una notificación.</DrawerDescription>
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
    </div>
  );
}
