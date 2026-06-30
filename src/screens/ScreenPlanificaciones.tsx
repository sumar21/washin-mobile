import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageSquare,
  Navigation,
  QrCode,
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
import { QrScannerDialog } from "@/components/shared/QrScannerButton";
import { Combobox } from "@/components/shared/Combobox";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { posicionActual, distanciaAEdificio, RADIO_VISITA_M } from "@/lib/geo";
import {
  getCircuitos,
  getEdificios,
  getMotivosCancelacion,
  getVisitaEnCurso,
  iniciarVisita,
  cancelarVisita,
  type Circuito,
  type Edificio,
} from "@/lib/api-client";

// Texto "Edificio + Dirección" para desambiguar cuando varios edificios caen en el mismo punto
// (replica Concat_Edificio_Direccion de PowerApps).
function concatEdificioDireccion(e: Edificio) {
  return e.Direccion ? `${e.Edificio} — ${e.Direccion}` : e.Edificio;
}

// Módulo Visitas por rutas/circuitos. Lista los circuitos del técnico del mes
// (16.DetallePlanificaciones) y permite registrar una VISITA ESPONTÁNEA (edificio fuera del
// circuito) verificando presencia por QR o geolocalización. Una sola visita en curso a la vez.
export default function ScreenPlanificaciones() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentVisit, setCurrentVisit } = useSession();

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
  // Motivos de cancelación administrables (99.MotivosCancelacion, Status='Activo'); reemplaza
  // la lista hardcodeada para que el ABM de motivos se refleje sin tocar código (paridad PA).
  const { data: motivos = [] } = useQuery({
    queryKey: ["motivos"],
    queryFn: getMotivosCancelacion,
  });

  const [espontaneaOpen, setEspontaneaOpen] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  // Desambiguación: cuando 2+ edificios ALTA caen dentro del radio, el técnico elige cuál visitar
  // (replica PopUpRegistrarVisitaMultiple + cmbox_RVM de PowerApps).
  const [multiOpen, setMultiOpen] = useState(false);
  const [candidatos, setCandidatos] = useState<Edificio[]>([]);
  const [elegido, setElegido] = useState("");
  // Doble-QR de presencia (PA): la espontánea registrada por GEO abre la visita "Pendiente" pero
  // NO confirma presencia; el técnico debe escanear el QR del edificio (code === Código) para entrar
  // (paridad qr_scanCheckList). Guardamos acá esa visita Pendiente sin QR para mostrar el escáner.
  const [pendientePresencia, setPendientePresencia] = useState<{
    idUnico: string;
    codigo: string;
    edificio: string;
    direccion: string;
  } | null>(null);
  // El escáner se renderiza a nivel raíz (NO anidado en el Drawer, si no la cámara no decodifica).
  // scanTarget indica qué hacer con el código leído; el Drawer correspondiente se oculta mientras escanea.
  const [scanTarget, setScanTarget] = useState<"espontanea" | "presencia" | null>(
    null,
  );

  const subtitle = circuitos.length
    ? `${circuitos.length} circuito${circuitos.length === 1 ? "" : "s"} este mes`
    : "Mis visitas del mes";

  // Navega al checklist marcando presencia: qrScanned controla el gate de PA (CollectHoraInicio).
  // Solo navega cuando qrScanned es true (presencia confirmada por el QR del edificio).
  function irAlChecklist(v: {
    idUnico: string;
    codigo: string;
    edificio: string;
    direccion: string;
    fecha?: string;
    hora?: string;
    qrScanned: boolean;
  }) {
    setCurrentVisit({
      IDUnico: v.idUnico,
      Codigo: v.codigo,
      Edificio: v.edificio,
      Direccion: v.direccion,
      Fecha: v.fecha ?? "",
      HoraInicio: v.hora ?? "",
      qrScanned: v.qrScanned,
    });
    if (v.qrScanned) navigate("/checklist");
  }

  // CONTINUAR la visita espontánea en curso. Si la presencia ya fue confirmada (qrScanned), entra
  // directo; si no (Pendiente sin QR: abierta por GEO o recuperada de sesión), exige el QR del
  // edificio primero (gate de presencia de PA).
  function continuarEnCurso(v: {
    idUnico: string;
    codigo: string;
    edificio: string;
    direccion: string;
  }) {
    if (currentVisit?.IDUnico === v.idUnico && currentVisit.qrScanned === true) {
      irAlChecklist({ ...v, qrScanned: true });
      return;
    }
    setPendientePresencia(v);
  }

  // Navega a los edificios del circuito y pasa la Observación del circuito vía location.state
  // (ObservacionCircuito_DP) para que ScreenEdificios muestre el banner de observación (paridad
  // img_obsCircuito / ViewObsCircuito de PowerApps).
  function irAEdificios(c: Circuito) {
    navigate(`/edificios?circuito=${encodeURIComponent(c.NroCircuito)}`, {
      state: { obsCircuito: c.Observacion },
    });
  }

  // Registra una visita espontánea (sin circuito) en el edificio verificado. `entrar` controla el
  // doble-QR de presencia: con QR del edificio (entrar=true) ese escaneo cuenta como presencia →
  // qrScanned:true + entra; con GEO (entrar=false) la visita queda Pendiente sin presencia y se
  // exige luego escanear el QR del edificio.
  async function iniciarEspontanea(ed: Edificio, entrar: boolean) {
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
        // Paridad PA: la espontánea persiste HoraSugerida_R/ObservacionEdificio_R del edificio.
        horaSugerida: ed.HoraVisita,
        observacion: ed.Observaciones,
      });
      qc.invalidateQueries({ queryKey: ["visita-en-curso"] });
      qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
      setEspontaneaOpen(false);
      if (entrar) {
        // Registro por QR: el escaneo ya matcheó el Código → cuenta como presencia, entra directo.
        irAlChecklist({
          idUnico: r.idUnico,
          codigo: ed.Codigo,
          edificio: ed.Edificio,
          direccion: ed.Direccion,
          fecha: r.fecha,
          hora: r.hora,
          qrScanned: true,
        });
      } else {
        // Registro por GEO: visita Pendiente sin presencia. currentVisit con qrScanned:false (no
        // navega) + mostrar el escáner del QR del edificio para confirmar presencia.
        setCurrentVisit({
          IDUnico: r.idUnico,
          Codigo: ed.Codigo,
          Edificio: ed.Edificio,
          Direccion: ed.Direccion,
          Fecha: r.fecha ?? "",
          HoraInicio: "",
          qrScanned: false,
        });
        setPendientePresencia({
          idUnico: r.idUnico,
          codigo: ed.Codigo,
          edificio: ed.Edificio,
          direccion: ed.Direccion,
        });
        toast.info("Visita abierta", {
          description: "Escaneá el QR del edificio para iniciar el checklist.",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar");
    } finally {
      setBusy(false);
    }
  }

  // Registro por QR de la espontánea: el código debe corresponder a un edificio ALTA. Ese mismo
  // escaneo confirma presencia (entrar=true) → marca HoraInicio y entra al checklist (mejora de
  // React respecto de PA: el QR sirve a la vez de registro y de confirmación de presencia).
  function verificarQrEspontanea(code: string) {
    const c = code.trim().toUpperCase();
    const ed = edificios.find(
      (e) => e.Status === "ALTA" && e.Codigo.trim().toUpperCase() === c,
    );
    if (!ed) {
      // Paridad PA: PopUpQRIncorrecto / código no reconocido.
      toast.error("QR incorrecto", { description: `Escaneaste "${code}"` });
      return;
    }
    void iniciarEspontanea(ed, true);
  }

  // Confirma presencia escaneando el QR del edificio sobre una visita espontánea ya abierta
  // (Pendiente, registrada por GEO o recuperada de sesión sin qrScanned). code === Código → entra;
  // si no coincide → "QR incorrecto", no navega.
  function confirmarPresencia(
    p: { idUnico: string; codigo: string; edificio: string; direccion: string },
    code: string,
  ) {
    if (code.trim().toUpperCase() !== p.codigo.trim().toUpperCase()) {
      toast.error("QR incorrecto", { description: `Escaneaste "${code}"` });
      return;
    }
    setPendientePresencia(null);
    irAlChecklist({
      idUnico: p.idUnico,
      codigo: p.codigo,
      edificio: p.edificio,
      direccion: p.direccion,
      qrScanned: true,
    });
  }

  async function verificarGeoEspontanea() {
    setVerificando(true);
    try {
      const pos = await posicionActual();
      // Evalúa los DOS pares de coordenadas por edificio (Latitud/Longitud y Latitud2/Longitud2),
      // como PowerApps: la distancia del edificio es la mínima a cualquiera de sus puntos.
      let best: Edificio | null = null;
      let bestD = Infinity;
      const dentroDelRadio: Edificio[] = [];
      for (const e of edificios) {
        if (e.Status !== "ALTA") continue;
        // Descartar pares (0,0) antes de medir, igual que parseCoords del backend:
        // un punto cuenta solo si lat!==0 || lng!==0 (evita medir contra el punto (0,0)
        // cuando el 2º par de coordenadas no está cargado).
        const puntos = [
          { lat: e.Latitud, lng: e.Longitud },
          { lat: e.Latitud2, lng: e.Longitud2 },
        ].filter((p) => p.lat !== 0 || p.lng !== 0);
        const d = distanciaAEdificio(pos, puntos);
        if (d == null) continue;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
        if (d <= RADIO_VISITA_M) dentroDelRadio.push(e);
      }
      if (dentroDelRadio.length === 0) {
        toast.error("Ubicación incorrecta", {
          description: best
            ? `El edificio más cercano está a ~${Math.round(bestD)} m`
            : "No hay edificios con ubicación cargada",
        });
        return;
      }
      // Exactamente uno: iniciar automático. 2+ (mismo predio/dirección): dejar elegir.
      // GEO no confirma presencia (entrar=false): abre la visita Pendiente y exige el QR del edificio.
      if (dentroDelRadio.length === 1) {
        await iniciarEspontanea(dentroDelRadio[0], false);
      } else {
        setCandidatos(dentroDelRadio);
        setElegido("");
        setEspontaneaOpen(false);
        setMultiOpen(true);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo verificar la ubicación",
      );
    } finally {
      setVerificando(false);
    }
  }

  // Confirma el edificio elegido en el selector de desambiguación e inicia la espontánea.
  async function iniciarElegido() {
    const ed = candidatos.find((e) => concatEdificioDireccion(e) === elegido);
    if (!ed) {
      toast.error("Elegí un edificio");
      return;
    }
    setMultiOpen(false);
    // Elegido vía desambiguación de GEO: tampoco confirma presencia (entrar=false).
    await iniciarEspontanea(ed, false);
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

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
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
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{enCurso.direccion}</span>
                  </p>
                ) : null}
              </div>
              {/* Si la presencia ya fue confirmada (qrScanned) → "Continuar"; si no → exige el QR
                  del edificio (gate de presencia de PA) con etiqueta clara. */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    continuarEnCurso({
                      idUnico: enCurso.idUnico,
                      codigo: enCurso.codigo,
                      edificio: enCurso.edificio,
                      direccion: enCurso.direccion,
                    })
                  }
                >
                  {currentVisit?.IDUnico === enCurso.idUnico &&
                  currentVisit.qrScanned === true ? (
                    <>
                      <ClipboardList /> Continuar
                    </>
                  ) : (
                    <>
                      <QrCode /> Escanear QR
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Cancelar visita"
                  onClick={() => setCancelOpen(true)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Ban />
                </Button>
              </div>
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
            icon={CalendarDays}
            title="Sin ruta"
            description="No tenés circuitos asignados este mes."
          />
        ) : null}

        {!isLoading && circuitos.length > 0 ? (
          <>
            {/* Mobile: cards apiladas (una por circuito). */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {circuitos.map((c) => (
                <CircuitoCard key={c.ID} c={c} onOpen={() => irAEdificios(c)} />
              ))}
            </div>

            {/* Desktop/tablet: grilla estándar (DataTable: columna principal flexible + sortable). */}
            <DataTable
              className="hidden md:block"
              data={circuitos}
              getRowKey={(c) => c.ID}
              onRowClick={(c) => irAEdificios(c)}
              initialSort={{ key: "circuito" }}
              columns={[
                {
                  key: "circuito",
                  header: "Circuito",
                  primary: true,
                  sortable: true,
                  sortAccessor: (c) => c.NroCircuito,
                  cell: (c) => (
                    <CellTitleSubtitle
                      icon={RouteIcon}
                      title={`Circuito ${c.NroCircuito}`}
                      subtitle={
                        c.Observacion ||
                        `Ruta ${c.NroRuta} · ${c.CantidadEdificios} edificio${c.CantidadEdificios === 1 ? "" : "s"}`
                      }
                    />
                  ),
                },
                {
                  key: "edificios",
                  header: "Edificios",
                  sortable: true,
                  sortAccessor: (c) => c.CantidadEdificios,
                  cell: (c) => (
                    <Pill tone="neutral">
                      {c.CantidadEdificios} edificio
                      {c.CantidadEdificios === 1 ? "" : "s"}
                    </Pill>
                  ),
                },
                {
                  key: "ruta",
                  header: "Ruta",
                  sortable: true,
                  sortAccessor: (c) => c.NroRuta,
                  cell: (c) => `Ruta ${c.NroRuta}`,
                },
                {
                  key: "estado",
                  header: "Estado",
                  sortable: true,
                  sortAccessor: (c) => c.Status,
                  cell: (c) => <StatusBadge status={c.Status} />,
                },
                {
                  key: "accion",
                  header: "Acción",
                  align: "right",
                  cell: (c) => (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        irAEdificios(c);
                      }}
                      aria-label="Ver edificios del circuito"
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </div>

      {/* Visita espontánea: verificar presencia por QR o geo */}
      <ResponsiveDialog
        open={espontaneaOpen && !scanTarget}
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
              <Button
                onClick={() => {
                  setEspontaneaOpen(false);
                  setScanTarget("espontanea");
                }}
                disabled={busy}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Escanear QR del edificio
              </Button>
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

      {/* Confirmar presencia con el QR del edificio (qr_scanCheckList de PA). Aparece cuando hay una
          visita espontánea Pendiente sin presencia (abierta por GEO o recuperada de sesión sin
          qrScanned). Escaneo correcto (code === Código) → marca HoraInicio + entra al checklist;
          escaneo incorrecto → "QR incorrecto", no navega. */}
      <ResponsiveDialog
        open={!!pendientePresencia && !scanTarget}
        onOpenChange={(o) => !o && setPendientePresencia(null)}
      >
        <ResponsiveDialogContent className="p-0" desktopClassName="max-w-sm rounded-2xl">
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Confirmá tu presencia</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {pendientePresencia?.edificio}
              {pendientePresencia?.direccion
                ? ` · ${pendientePresencia.direccion}`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 px-5 pt-3">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                La visita quedó abierta. Escaneá el QR del edificio para iniciar el
                checklist.
              </p>
            </div>
            <Button onClick={() => setScanTarget("presencia")}>
              <QrCode className="mr-2 h-4 w-4" />
              Escanear QR para iniciar checklist
            </Button>
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline">Más tarde</Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Escáner QR a nivel RAÍZ (no anidado en ningún Drawer; si no, la cámara no decodifica).
          El Drawer de origen se ocultó vía `!scanTarget`. Al leer, se rutea según scanTarget. */}
      <QrScannerDialog
        open={!!scanTarget}
        onOpenChange={(o) => {
          if (!o) setScanTarget(null);
        }}
        onScan={(code) => {
          const target = scanTarget;
          setScanTarget(null);
          if (target === "espontanea") verificarQrEspontanea(code);
          else if (target === "presencia" && pendientePresencia)
            confirmarPresencia(pendientePresencia, code);
        }}
      />

      {/* Desambiguación: 2+ edificios en la misma ubicación → elegir cuál visitar
          (replica PopUpRegistrarVisitaMultiple + cmbox_RVM de PowerApps). */}
      <ResponsiveDialog
        open={multiOpen}
        onOpenChange={(o) => !o && !busy && setMultiOpen(false)}
      >
        <ResponsiveDialogContent className="p-0" desktopClassName="max-w-sm rounded-2xl">
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Elegí el edificio</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Hay varios edificios en tu ubicación. Seleccioná cuál vas a visitar.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-2 px-5 pt-3">
            <Label>Edificio</Label>
            <Combobox
              value={elegido}
              onChange={setElegido}
              showAll={false}
              options={candidatos.map((e) => concatEdificioDireccion(e))}
              placeholder="Seleccionar un edificio"
              searchPlaceholder="Buscar edificio…"
              disabled={busy}
            />
          </div>
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Cancelar
              </Button>
            </ResponsiveDialogClose>
            <Button onClick={() => void iniciarElegido()} disabled={busy || !elegido}>
              {busy ? "Iniciando…" : "Iniciar visita"}
            </Button>
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
                  {/* Distinct(CollectMotivosCancelar, Motivo_MC): motivos únicos del catálogo. */}
                  {[...new Set(motivos.map((m) => m.Motivo))].map((m) => (
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
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <RouteIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Circuito {c.NroCircuito}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground/70">
              {c.CantidadEdificios} edificio{c.CantidadEdificios === 1 ? "" : "s"}
            </span>
            <span className="opacity-50">·</span>
            <span>Ruta {c.NroRuta}</span>
          </p>
          {c.Observacion ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
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
