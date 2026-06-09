import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageSquare,
  Navigation,
  Route as RouteIcon,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { QrScannerButton } from "@/components/shared/QrScannerButton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { posicionActual, distanciaMetros, RADIO_VISITA_M } from "@/lib/geo";
import {
  getCircuitos,
  getEdificios,
  getVisitaEnCurso,
  iniciarVisita,
  cancelarVisita,
  type Circuito,
  type Edificio,
} from "@/lib/api-client";

const MOTIVOS = [
  "Falta De Respuesta",
  "Encargado No Puede Recibirme",
  "No hay luz",
  "Sin Contacto Para Ingresar",
];

// Módulo Visitas por rutas/circuitos. Lista los circuitos del técnico del mes
// (16.DetallePlanificaciones) y permite registrar una VISITA ESPONTÁNEA (edificio fuera del
// circuito) verificando presencia por QR o geolocalización. Una sola visita en curso a la vez.
export default function ScreenPlanificaciones() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setCurrentVisit } = useSession();

  const { data: circuitos = [], isLoading } = useQuery({
    queryKey: ["circuitos"],
    queryFn: getCircuitos,
  });
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: enCurso } = useQuery({
    queryKey: ["visita-en-curso"],
    queryFn: getVisitaEnCurso,
  });

  const [espontaneaOpen, setEspontaneaOpen] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  const subtitle = circuitos.length
    ? `${circuitos.length} circuito${circuitos.length === 1 ? "" : "s"} este mes`
    : "Mis visitas del mes";

  function irAlChecklist(v: {
    idUnico: string;
    codigo: string;
    edificio: string;
    direccion: string;
    fecha?: string;
    hora?: string;
  }) {
    setCurrentVisit({
      IDUnico: v.idUnico,
      Codigo: v.codigo,
      Edificio: v.edificio,
      Direccion: v.direccion,
      Fecha: v.fecha ?? "",
      HoraInicio: v.hora ?? "",
      qrScanned: true,
    });
    navigate("/checklist");
  }

  // Registra una visita espontánea (sin circuito) en el edificio verificado.
  async function iniciarEspontanea(ed: Edificio) {
    setBusy(true);
    try {
      const r = await iniciarVisita({
        codigo: ed.Codigo,
        edificio: ed.Edificio,
        direccion: ed.Direccion,
        idUnivocoCircuito: "",
        idUnivocoRuta: "",
        nroCircuito: "",
        nroRuta: "",
      });
      qc.invalidateQueries({ queryKey: ["visita-en-curso"] });
      qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
      setEspontaneaOpen(false);
      irAlChecklist({
        idUnico: r.idUnico,
        codigo: ed.Codigo,
        edificio: ed.Edificio,
        direccion: ed.Direccion,
        fecha: r.fecha,
        hora: r.hora,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar");
      setBusy(false);
    }
  }

  function verificarQrEspontanea(code: string) {
    const c = code.trim().toUpperCase();
    const ed = edificios.find(
      (e) => e.Status === "ALTA" && e.Codigo.trim().toUpperCase() === c,
    );
    if (!ed) {
      toast.error("Código no reconocido", { description: `Escaneaste "${code}"` });
      return;
    }
    void iniciarEspontanea(ed);
  }

  async function verificarGeoEspontanea() {
    setVerificando(true);
    try {
      const pos = await posicionActual();
      let best: Edificio | null = null;
      let bestD = Infinity;
      for (const e of edificios) {
        if (e.Status !== "ALTA" || !e.Latitud || !e.Longitud) continue;
        const d = distanciaMetros(pos, { lat: e.Latitud, lng: e.Longitud });
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best && bestD <= RADIO_VISITA_M) {
        await iniciarEspontanea(best);
      } else {
        toast.error("Ubicación incorrecta", {
          description: best
            ? `El edificio más cercano está a ~${Math.round(bestD)} m`
            : "No hay edificios con ubicación cargada",
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo verificar la ubicación",
      );
    } finally {
      setVerificando(false);
    }
  }

  async function doCancelarEnCurso() {
    if (!enCurso || !motivo) {
      toast.error("Elegí un motivo");
      return;
    }
    setBusy(true);
    try {
      await cancelarVisita({
        codigo: enCurso.codigo,
        edificio: enCurso.edificio,
        direccion: enCurso.direccion,
        motivo,
        observacion: obs,
      });
      qc.invalidateQueries({ queryKey: ["visita-en-curso"] });
      qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
      toast.info("Visita cancelada", { description: motivo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    } finally {
      setBusy(false);
      setCancelOpen(false);
      setMotivo("");
      setObs("");
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader className="md:hidden" back="/home" title="Mis Visitas" subtitle={subtitle} />
      <ModuleHeader title="Mis Visitas" subtitle={subtitle}>
        {!enCurso ? (
          <Button onClick={() => setEspontaneaOpen(true)} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Visita espontánea
          </Button>
        ) : null}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-4 md:px-6 md:py-5">
        {/* Visita en curso (bloquea iniciar otra) */}
        {enCurso ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Visita en curso{enCurso.espontanea ? " · espontánea" : ""}
                </p>
                <p className="truncate text-sm font-semibold">{enCurso.edificio}</p>
                {enCurso.direccion ? (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{enCurso.direccion}</span>
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                onClick={() =>
                  irAlChecklist({
                    idUnico: enCurso.idUnico,
                    codigo: enCurso.codigo,
                    edificio: enCurso.edificio,
                    direccion: enCurso.direccion,
                  })
                }
              >
                <ClipboardList className="mr-1 h-4 w-4" /> Continuar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <Ban className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Botón espontánea (mobile, donde el ModuleHeader no se ve) */}
        {!enCurso ? (
          <Button
            onClick={() => setEspontaneaOpen(true)}
            className="w-full gap-1.5 md:hidden"
          >
            <Sparkles className="h-4 w-4" /> Registrar visita espontánea
          </Button>
        ) : null}

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && circuitos.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sin ruta"
            description="No tenés circuitos asignados este mes."
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {circuitos.map((c) => (
            <CircuitoCard
              key={c.ID}
              c={c}
              onOpen={() =>
                navigate(`/edificios?circuito=${encodeURIComponent(c.NroCircuito)}`)
              }
            />
          ))}
        </div>
      </div>

      {/* Visita espontánea: verificar presencia por QR o geo */}
      <ResponsiveDialog
        open={espontaneaOpen}
        onOpenChange={(o) => !o && !busy && setEspontaneaOpen(false)}
      >
        <ResponsiveDialogContent className="p-0" desktopClassName="max-w-sm rounded-2xl">
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Visita espontánea</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Registrá una visita a un edificio fuera de tu circuito.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            <p className="text-sm text-muted-foreground">
              Verificá que estás en el edificio:
            </p>
            <div className="grid gap-2">
              <QrScannerButton
                label="Escanear QR del edificio"
                onScan={verificarQrEspontanea}
              />
              <Button
                variant="outline"
                onClick={verificarGeoEspontanea}
                disabled={verificando || busy}
              >
                <Navigation className="mr-2 h-4 w-4" />
                {verificando ? "Ubicando…" : "Usar mi ubicación"}
              </Button>
            </div>
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline" disabled={busy || verificando}>
                Cancelar
              </Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Cancelar la visita en curso */}
      <ResponsiveDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCancelOpen(false);
            setMotivo("");
            setObs("");
          }
        }}
      >
        <ResponsiveDialogContent className="p-0" desktopClassName="max-w-md rounded-2xl">
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Cancelar visita</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {enCurso?.edificio}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observación</Label>
              <Textarea
                value={obs}
                onChange={(ev) => setObs(ev.target.value)}
                rows={3}
                placeholder="Detalle adicional (opcional)…"
                className="resize-none"
              />
            </div>
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Volver
              </Button>
            </ResponsiveDialogClose>
            <Button variant="destructive" onClick={doCancelarEnCurso} disabled={busy || !motivo}>
              {busy ? "Cancelando…" : "Cancelar visita"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function CircuitoCard({ c, onOpen }: { c: Circuito; onOpen: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
          <RouteIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Circuito {c.NroCircuito}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground/70">
              {c.CantidadEdificios} edificio{c.CantidadEdificios === 1 ? "" : "s"}
            </span>
            <span className="opacity-50">·</span>
            <span>Ruta {c.NroRuta}</span>
          </p>
          {c.Observacion ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{c.Observacion}</span>
            </p>
          ) : null}
        </div>
        <StatusBadge status={c.Status} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
