import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardList,
  MapPin,
  Navigation,
  Play,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import {
  posicionActual,
  distanciaAEdificio,
  RADIO_VISITA_M,
} from "@/lib/geo";
import {
  getEdificiosAVisitar,
  getVisitaEnCurso,
  iniciarVisita,
  cancelarVisita,
  type EdificioVisitar,
  type EstadoEdificio,
} from "@/lib/api-client";

const MOTIVOS = [
  "Falta De Respuesta",
  "Encargado No Puede Recibirme",
  "No hay luz",
  "Sin Contacto Para Ingresar",
];

const ESTADO_LABEL: Record<EstadoEdificio, string> = {
  Pendiente: "Pendiente",
  EnProceso: "En Proceso",
  Finalizado: "Finalizado",
  Cancelado: "Cancelado",
};

type CancelTarget = { Codigo: string; Edificio: string; Direccion: string };

// Edificios a visitar de un circuito (18.EdificiosVisitar). El estado real se deriva de
// 01.Registros. Para INICIAR una visita el técnico verifica presencia por QR del edificio o por
// geolocalización (radio). Solo se permite una visita "en curso" a la vez (bloqueo concurrente).
export default function ScreenEdificios() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const circuito = params.get("circuito"); // NroCircuito
  const { setCurrentVisit } = useSession();

  const { data: edificios = [], isLoading } = useQuery({
    queryKey: ["edificios-visitar"],
    queryFn: getEdificiosAVisitar,
  });
  const { data: enCurso } = useQuery({
    queryKey: ["visita-en-curso"],
    queryFn: getVisitaEnCurso,
  });

  const lista = useMemo(
    () => (circuito ? edificios.filter((e) => e.NroCircuito === circuito) : edificios),
    [edificios, circuito],
  );

  const [iniciando, setIniciando] = useState<EdificioVisitar | null>(null);
  const [cancelarEl, setCancelarEl] = useState<CancelTarget | null>(null);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificando, setVerificando] = useState(false);

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

  async function doIniciar(e: EdificioVisitar) {
    setBusy(true);
    try {
      const r = await iniciarVisita({
        codigo: e.Codigo,
        edificio: e.Edificio,
        direccion: e.Direccion,
        idUnivocoCircuito: e.IDUnivocoCircuito,
        idUnivocoRuta: e.IDUnivocoRuta,
        nroCircuito: e.NroCircuito,
        nroRuta: e.NroRuta,
        horaSugerida: e.HoraSugerida,
        observacion: e.Observacion,
      });
      qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
      qc.invalidateQueries({ queryKey: ["visita-en-curso"] });
      setIniciando(null);
      irAlChecklist({
        idUnico: r.idUnico,
        codigo: e.Codigo,
        edificio: e.Edificio,
        direccion: e.Direccion,
        fecha: r.fecha,
        hora: r.hora,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar");
      setBusy(false);
    }
  }

  // Verificación por QR: el código escaneado debe coincidir con el del edificio.
  function verificarQr(e: EdificioVisitar, code: string) {
    if (code.trim().toUpperCase() !== e.Codigo.trim().toUpperCase()) {
      toast.error("El QR no corresponde a este edificio", {
        description: `Escaneaste "${code}"`,
      });
      return;
    }
    void doIniciar(e);
  }

  // Verificación por geolocalización: distancia al edificio dentro del radio.
  async function verificarGeo(e: EdificioVisitar) {
    if (!e.coords.length) {
      toast.error("El edificio no tiene ubicación cargada", {
        description: "Usá el QR para iniciar la visita.",
      });
      return;
    }
    setVerificando(true);
    try {
      const pos = await posicionActual();
      const d = distanciaAEdificio(pos, e.coords);
      if (d == null) {
        toast.error("El edificio no tiene ubicación válida");
        return;
      }
      if (d > RADIO_VISITA_M) {
        toast.error("Estás lejos del edificio", {
          description: `A ~${Math.round(d)} m (máximo ${RADIO_VISITA_M} m)`,
        });
        return;
      }
      await doIniciar(e);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo verificar la ubicación",
      );
    } finally {
      setVerificando(false);
    }
  }

  function continuar(v: { idUnico: string; codigo: string; edificio: string; direccion: string }) {
    irAlChecklist(v);
  }

  async function doCancelar() {
    if (!cancelarEl || !motivo) {
      toast.error("Elegí un motivo");
      return;
    }
    setBusy(true);
    try {
      await cancelarVisita({
        codigo: cancelarEl.Codigo,
        edificio: cancelarEl.Edificio,
        direccion: cancelarEl.Direccion,
        motivo,
        observacion: obs,
      });
      qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
      qc.invalidateQueries({ queryKey: ["visita-en-curso"] });
      toast.info("Visita cancelada", { description: motivo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    } finally {
      setBusy(false);
      setCancelarEl(null);
      setMotivo("");
      setObs("");
    }
  }

  const titulo = circuito ? `Circuito ${circuito}` : "Edificios a visitar";
  const subtitle = `${lista.length} edificio${lista.length === 1 ? "" : "s"}`;

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        className="md:hidden"
        back="/planificaciones"
        title={titulo}
        subtitle={subtitle}
      />
      <ModuleHeader back="/planificaciones" title={titulo} subtitle={subtitle} />

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
                  continuar({
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
                onClick={() =>
                  setCancelarEl({
                    Codigo: enCurso.codigo,
                    Edificio: enCurso.edificio,
                    Direccion: enCurso.direccion,
                  })
                }
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <Ban className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && lista.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Sin edificios"
            description="No hay edificios pendientes en este circuito."
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lista.map((e) => (
            <EdificioVisitarCard
              key={e.ID}
              e={e}
              bloqueado={!!enCurso && enCurso.codigo !== e.Codigo}
              onIniciar={() => setIniciando(e)}
              onContinuar={() =>
                continuar({
                  idUnico: e.idUnico ?? "",
                  codigo: e.Codigo,
                  edificio: e.Edificio,
                  direccion: e.Direccion,
                })
              }
              onCancelar={() =>
                setCancelarEl({
                  Codigo: e.Codigo,
                  Edificio: e.Edificio,
                  Direccion: e.Direccion,
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Iniciar visita: verificar presencia por QR o geolocalización */}
      <ResponsiveDialog
        open={!!iniciando}
        onOpenChange={(o) => !o && !busy && setIniciando(null)}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-sm rounded-2xl"
        >
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Iniciar visita</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {iniciando?.Edificio}
              {iniciando?.Direccion ? ` · ${iniciando.Direccion}` : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            <p className="text-sm text-muted-foreground">
              Verificá que estás en el edificio para iniciar la visita:
            </p>
            <div className="grid gap-2">
              <QrScannerButton
                label="Escanear QR del edificio"
                onScan={(code) => iniciando && verificarQr(iniciando, code)}
              />
              <Button
                variant="outline"
                onClick={() => iniciando && verificarGeo(iniciando)}
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

      {/* Cancelar visita (no pude acceder) */}
      <ResponsiveDialog
        open={!!cancelarEl}
        onOpenChange={(o) => {
          if (!o) {
            setCancelarEl(null);
            setMotivo("");
            setObs("");
          }
        }}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-md rounded-2xl"
        >
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Cancelar visita</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {cancelarEl?.Edificio}
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
            <Button
              variant="destructive"
              onClick={doCancelar}
              disabled={busy || !motivo}
            >
              {busy ? "Cancelando…" : "Cancelar visita"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function EdificioVisitarCard({
  e,
  bloqueado,
  onIniciar,
  onContinuar,
  onCancelar,
}: {
  e: EdificioVisitar;
  bloqueado: boolean;
  onIniciar: () => void;
  onContinuar: () => void;
  onCancelar: () => void;
}) {
  const done = e.estado === "Finalizado";
  const cancelled = e.estado === "Cancelado";
  const enProceso = e.estado === "EnProceso";
  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-tight text-primary">
              {e.Edificio}
            </p>
            {e.Direccion ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{e.Direccion}</span>
              </p>
            ) : null}
          </div>
          <StatusBadge status={ESTADO_LABEL[e.estado]} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono font-semibold text-foreground/80">
            {e.Codigo}
          </span>
          {e.HoraSugerida ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {e.HoraSugerida}
            </span>
          ) : null}
          {e.Encargado ? (
            <span className="flex min-w-0 items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{e.Encargado}</span>
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="gap-2 border-t bg-muted/30 p-3">
        {done ? (
          <span className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Visitado
          </span>
        ) : cancelled ? (
          <span className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-medium text-muted-foreground">
            <Ban className="h-4 w-4" /> Cancelada
          </span>
        ) : enProceso ? (
          <>
            <Button size="sm" className="flex-1" onClick={onContinuar}>
              <ClipboardList className="mr-1 h-4 w-4" /> Continuar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelar}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <Ban className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={onIniciar}
            disabled={bloqueado}
            title={bloqueado ? "Terminá la visita en curso primero" : undefined}
          >
            <Play className="mr-1 h-4 w-4" />
            {bloqueado ? "Visita en curso" : "Iniciar visita"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
