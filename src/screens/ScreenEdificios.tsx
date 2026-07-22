import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  ClipboardList,
  Info,
  Mail,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Play,
  QrCode,
  RotateCcw,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pill } from "@/components/shared/Pill";
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
  getMotivosCancelacion,
  iniciarVisita,
  cancelarVisita,
  type EdificioVisitar,
  type EstadoEdificio,
} from "@/lib/api-client";

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
  const location = useLocation();
  const circuito = params.get("circuito"); // NroCircuito
  const { currentVisit, setCurrentVisit } = useSession();

  // Observación del circuito (ObservacionCircuito_DP). Planificaciones la pasa por location.state
  // al navegar; si no llega, no se muestra el banner (img_obsCircuito de PA solo es visible
  // cuando ObservacionesCircuito <> Blank()).
  const obsCircuito =
    typeof (location.state as { obsCircuito?: unknown } | null)?.obsCircuito ===
    "string"
      ? ((location.state as { obsCircuito: string }).obsCircuito ?? "").trim()
      : "";

  const { data: edificios = [], isLoading } = useQuery({
    queryKey: ["edificios-visitar"],
    queryFn: getEdificiosAVisitar,
  });
  const { data: enCurso } = useQuery({
    queryKey: ["visita-en-curso"],
    queryFn: getVisitaEnCurso,
  });
  // Motivos de cancelación desde el catálogo 99.MotivosCancelacion (Status='Activo'),
  // administrable en SharePoint — reemplaza el array hardcodeado (paridad PA).
  const { data: motivos = [] } = useQuery({
    queryKey: ["motivos-cancelacion"],
    queryFn: getMotivosCancelacion,
  });

  const lista = useMemo(
    () => (circuito ? edificios.filter((e) => e.NroCircuito === circuito) : edificios),
    [edificios, circuito],
  );

  const [iniciando, setIniciando] = useState<EdificioVisitar | null>(null);
  // El escáner se renderiza a nivel raíz (NO anidado en el Drawer, si no la cámara no decodifica).
  // scanTarget indica qué hacer con el código leído; el Drawer correspondiente se oculta mientras escanea.
  const [scanTarget, setScanTarget] = useState<"iniciar" | "presencia" | null>(
    null,
  );
  const [detalle, setDetalle] = useState<EdificioVisitar | null>(null);
  const [cancelarEl, setCancelarEl] = useState<CancelTarget | null>(null);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificando, setVerificando] = useState(false);
  // Doble-QR de presencia (PA): tras verificar GEO se crea la visita "Pendiente" pero el técnico
  // todavía debe escanear el QR del edificio para confirmar presencia. Acá guardamos esa visita
  // "Pendiente sin QR" para mostrar el escáner de confirmación (paridad qr_scanCheckList_EAV,
  // visible mientras hay Pendiente y CollectHoraInicio está vacío).
  const [pendientePresencia, setPendientePresencia] =
    useState<{ idUnico: string; codigo: string; edificio: string; direccion: string } | null>(
      null,
    );

  // Navega al checklist marcando presencia: qrScanned controla el gate de PA (CollectHoraInicio).
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

  // Crea la visita (iniciarVisita → queda "Pendiente"). Con `entrar=false` (vía GEO) NO navega:
  // deja la visita Pendiente esperando el QR de presencia (img_RegistrarVisita_EAV abre la visita,
  // qr_scanCheckList_EAV la confirma). Con `entrar=true` (vía QR del edificio) ese mismo escaneo
  // cuenta como presencia → marca HoraInicio y entra al checklist.
  async function doIniciar(e: EdificioVisitar, entrar: boolean) {
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
      if (entrar) {
        // QR de presencia ya validado: setea qrScanned:true y navega al checklist.
        irAlChecklist({
          idUnico: r.idUnico,
          codigo: e.Codigo,
          edificio: e.Edificio,
          direccion: e.Direccion,
          fecha: r.fecha,
          hora: r.hora,
          qrScanned: true,
        });
      } else {
        // GEO: visita Pendiente sin presencia. Guardar currentVisit con qrScanned:false (NO navega)
        // y mostrar el escáner de confirmación de presencia.
        setCurrentVisit({
          IDUnico: r.idUnico,
          Codigo: e.Codigo,
          Edificio: e.Edificio,
          Direccion: e.Direccion,
          Fecha: r.fecha ?? "",
          HoraInicio: "",
          qrScanned: false,
        });
        setPendientePresencia({
          idUnico: r.idUnico,
          codigo: e.Codigo,
          edificio: e.Edificio,
          direccion: e.Direccion,
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

  // Verificación por QR en el diálogo de iniciar: el código escaneado debe coincidir con el del
  // edificio. El QR como vía de inicio cuenta como presencia (entrar=true) → marca HoraInicio y entra.
  function verificarQr(e: EdificioVisitar, code: string) {
    if (code.trim().toUpperCase() !== e.Codigo.trim().toUpperCase()) {
      // Paridad PA: PopUpQRIncorrecto.
      toast.error("QR incorrecto", {
        description: `Escaneaste "${code}"`,
      });
      return;
    }
    void doIniciar(e, true);
  }

  // Verificación por geolocalización: distancia al edificio dentro del radio. La GEO abre la visita
  // Pendiente pero NO confirma presencia (entrar=false): luego se exige escanear el QR del edificio.
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
      await doIniciar(e, false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo verificar la ubicación",
      );
    } finally {
      setVerificando(false);
    }
  }

  // Confirma presencia escaneando el QR del edificio sobre una visita ya abierta (Pendiente).
  // Si el código coincide con el del edificio → qrScanned:true + entra al checklist (HoraInicio se
  // marca al entrar, como CollectHoraInicio de PA). Si no coincide → "QR incorrecto", no navega.
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

  // CONTINUAR una visita en curso. Si la presencia ya fue confirmada antes (qrScanned), entra
  // directo al checklist; si no (visita Pendiente sin QR, p. ej. recuperada de sesión o recién
  // abierta por GEO), exige escanear el QR del edificio primero (gate de presencia de PA).
  function continuar(v: { idUnico: string; codigo: string; edificio: string; direccion: string }) {
    if (currentVisit?.IDUnico === v.idUnico && currentVisit.qrScanned === true) {
      irAlChecklist({ ...v, qrScanned: true });
      return;
    }
    setPendientePresencia(v);
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

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
        {/* Observación del circuito (ObservacionCircuito_DP) — solo si Planificaciones la pasó. */}
        {obsCircuito ? (
          <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardContent className="flex items-start gap-2 p-3">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Observación del circuito
                </p>
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  {obsCircuito}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Visita en curso (bloquea iniciar otra) */}
        {enCurso ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <UserCheck className="size-5" />
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
              {/* Si la presencia ya fue confirmada (qrScanned) → "Continuar"; si no → exige el QR
                  del edificio (gate de presencia de PA) con etiqueta clara. */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    continuar({
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
                  size="icon"
                  variant="outline"
                  aria-label="Cancelar visita"
                  onClick={() =>
                    setCancelarEl({
                      Codigo: enCurso.codigo,
                      Edificio: enCurso.edificio,
                      Direccion: enCurso.direccion,
                    })
                  }
                  className="h-9 w-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <Ban />
                </Button>
              </div>
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

        {!isLoading && lista.length > 0 ? (
          <>
            {/* Mobile: cards apiladas (una por edificio). */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {lista.map((e) => (
                <EdificioVisitarCard
                  key={e.ID}
                  e={e}
                  bloqueado={!!enCurso && enCurso.codigo !== e.Codigo}
                  onIniciar={() => setIniciando(e)}
                  onDetalle={() => setDetalle(e)}
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

            {/* Desktop/tablet: grilla estándar (DataTable: columna principal flexible + sortable).
                Sin navegación por fila: las acciones se disparan con botones (Iniciar/Continuar/Cancelar). */}
            <DataTable
              className="hidden md:block"
              data={lista}
              getRowKey={(e) => e.ID}
              initialSort={{ key: "edificio" }}
              columns={[
                {
                  key: "edificio",
                  header: "Edificio",
                  primary: true,
                  sortable: true,
                  sortAccessor: (e) => e.Edificio,
                  cell: (e) => (
                    <CellTitleSubtitle
                      icon={Building2}
                      title={e.Edificio}
                      subtitle={e.Direccion || e.Codigo}
                    />
                  ),
                },
                {
                  key: "hora",
                  header: "Hora",
                  sortable: true,
                  sortAccessor: (e) => e.HoraSugerida,
                  cell: (e) =>
                    e.HoraSugerida ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" /> {e.HoraSugerida}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "encargado",
                  header: "Encargado",
                  sortable: true,
                  sortAccessor: (e) => e.Encargado,
                  className: "max-w-[14rem]",
                  cell: (e) =>
                    e.Encargado ? (
                      <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.Encargado}</span>
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "visitas",
                  header: "Visitas",
                  sortable: true,
                  sortAccessor: (e) => e.cantidadVisitas,
                  cell: (e) => (
                    // Replica lbl_ultimaVisitas_EAV de PA: "Visita Tecnico: {ultimaVisita} | Ult
                    // Visita {ultimaVisitaEdificio}". La 2ª fecha es la última visita del edificio
                    // por CUALQUIER técnico; si está vacía no se muestra esa parte.
                    <div className="flex flex-col items-start gap-0.5">
                      <Pill tone="neutral">
                        <CheckCircle2 className="h-3 w-3" /> {e.cantidadVisitas}
                      </Pill>
                      {e.ultimaVisita ? (
                        <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                          <CalendarClock className="h-3 w-3" /> Téc.{" "}
                          {e.ultimaVisita}
                        </span>
                      ) : null}
                      {e.ultimaVisitaEdificio ? (
                        <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                          <CalendarClock className="h-3 w-3" /> Últ.{" "}
                          {e.ultimaVisitaEdificio}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "estado",
                  header: "Estado",
                  sortable: true,
                  sortAccessor: (e) => ESTADO_LABEL[e.estado],
                  cell: (e) => <StatusBadge status={ESTADO_LABEL[e.estado]} />,
                },
                {
                  key: "accion",
                  header: "Acción",
                  align: "right",
                  cell: (e) => (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground"
                        aria-label="Ver detalle del edificio"
                        title="Ver detalle del edificio"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDetalle(e);
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <EdificioVisitarAccion
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
                    </div>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </div>

      {/* Iniciar visita: verificar presencia por QR o geolocalización */}
      <ResponsiveDialog
        open={!!iniciando && !scanTarget}
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
              <Button onClick={() => setScanTarget("iniciar")} disabled={busy}>
                <QrCode className="mr-2 h-4 w-4" />
                Escanear QR del edificio
              </Button>
              <Button
                variant="outline"
                className="h-11 gap-2"
                onClick={() => iniciando && verificarGeo(iniciando)}
                disabled={verificando || busy}
              >
                <Navigation />
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

      {/* Confirmar presencia con el QR del edificio (qr_scanCheckList_EAV de PA). Aparece cuando hay
          una visita Pendiente sin presencia (abierta por GEO o recuperada de sesión sin qrScanned).
          Escaneo correcto (code === Código del edificio) → marca HoraInicio + entra al checklist;
          escaneo incorrecto → "QR incorrecto", no navega. */}
      <ResponsiveDialog
        open={!!pendientePresencia && !scanTarget}
        onOpenChange={(o) => !o && setPendientePresencia(null)}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-sm rounded-2xl"
        >
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
          if (target === "iniciar" && iniciando) verificarQr(iniciando, code);
          else if (target === "presencia" && pendientePresencia)
            confirmarPresencia(pendientePresencia, code);
        }}
      />

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
                  {motivos.map((m) => (
                    <SelectItem key={m.ID} value={m.Motivo}>
                      {m.Motivo}
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

      {/* Ver detalle del edificio (datos de contacto/horario/observación, ya en EdificioVisitar).
          Paridad con PopUpVerDetalleEdificio de PA. */}
      <ResponsiveDialog
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
      >
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-md rounded-2xl"
        >
          <ResponsiveDialogHeader className="px-5 pt-5">
            <ResponsiveDialogTitle>Detalle del edificio</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {detalle?.Edificio}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {detalle ? (
            <div className="space-y-3 px-5 pt-3">
              <DetalleRow icon={Building2} label="Código" value={detalle.Codigo} />
              <DetalleRow
                icon={MapPin}
                label="Dirección"
                value={detalle.Direccion}
              />
              <DetalleRow
                icon={User}
                label="Encargado"
                value={detalle.Encargado}
              />
              <DetalleRow
                icon={Phone}
                label="Celular"
                value={detalle.Celular}
                href={detalle.Celular ? `tel:${detalle.Celular}` : undefined}
              />
              <DetalleRow
                icon={Mail}
                label="Mail"
                value={detalle.Mail}
                href={detalle.Mail ? `mailto:${detalle.Mail}` : undefined}
              />
              <DetalleRow
                icon={Clock}
                label="Horario sugerido"
                value={detalle.HoraSugerida}
              />
              <DetalleRow
                icon={MessageSquareText}
                label="Observación"
                value={detalle.Observacion}
              />
            </div>
          ) : null}
          <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
            <ResponsiveDialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

// Fila de dato del popup de detalle (ícono + label + valor). Muestra "—" si no hay valor.
function DetalleRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Building2;
  label: string;
  value?: string;
  href?: string;
}) {
  const v = (value ?? "").trim();
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {v ? (
          href ? (
            <a
              href={href}
              className="break-words text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {v}
            </a>
          ) : (
            <p className="break-words text-sm">{v}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}

function EdificioVisitarCard({
  e,
  bloqueado,
  onIniciar,
  onDetalle,
  onContinuar,
  onCancelar,
}: {
  e: EdificioVisitar;
  bloqueado: boolean;
  onIniciar: () => void;
  onDetalle: () => void;
  onContinuar: () => void;
  onCancelar: () => void;
}) {
  const done = e.estado === "Finalizado";
  const cancelled = e.estado === "Cancelado";
  const enProceso = e.estado === "EnProceso";
  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Building2 className="size-5" />
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
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={ESTADO_LABEL[e.estado]} />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Ver detalle del edificio"
              onClick={onDetalle}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
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

        {/* Contador "Visitas: N" (CountRows Finalizado del técnico) + última visita.
            Replica lbl_ultimaVisitas_EAV de PA: "Visita Tecnico: {ultimaVisita} | Ult Visita
            {ultimaVisitaEdificio}". La segunda fecha es la última visita del edificio por
            CUALQUIER técnico; si está vacía no se muestra. */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Pill tone="neutral">
            <CheckCircle2 className="h-3 w-3" /> Visitas: {e.cantidadVisitas}
          </Pill>
          {e.ultimaVisita ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Visita técnico:{" "}
              {e.ultimaVisita}
            </span>
          ) : null}
          {e.ultimaVisitaEdificio ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Últ. visita:{" "}
              {e.ultimaVisitaEdificio}
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="gap-2 border-t bg-muted/30 p-3">
        {enProceso ? (
          <>
            <Button className="h-10 flex-1 gap-1.5" onClick={onContinuar}>
              <ClipboardList /> Continuar
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Cancelar visita"
              onClick={onCancelar}
              className="h-10 w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <Ban />
            </Button>
          </>
        ) : (
          // Finalizado, Cancelado y Pendiente comparten el botón de (re)iniciar. `iniciarVisita`
          // SIEMPRE crea un registro nuevo "Pendiente" (no reactiva el anterior), así que un edificio
          // cancelado se puede volver a hacer desde acá, sin tener que cargarlo como espontánea. El
          // único gate es `bloqueado` (otra visita en curso). Antes "Cancelado" era un callejón sin
          // botón y obligaba a la espontánea (reporte de Paul).
          <div className="flex w-full flex-col gap-2">
            {done ? (
              <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Visitado
              </span>
            ) : cancelled ? (
              <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                <Ban className="h-3.5 w-3.5" /> Cancelada
              </span>
            ) : null}
            <Button
              className="h-10 w-full gap-1.5"
              onClick={onIniciar}
              disabled={bloqueado}
              title={bloqueado ? "Terminá la visita en curso primero" : undefined}
            >
              {done || cancelled ? <RotateCcw /> : <Play />}
              {bloqueado
                ? "Visita en curso"
                : done
                  ? "Re-visitar"
                  : cancelled
                    ? "Reiniciar visita"
                    : "Iniciar visita"}
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// Acciones de la fila (desktop/tablet) — mismas acciones por estado que la card de mobile.
// La fila no navega: los botones disparan iniciar/continuar/cancelar (stopPropagation por las dudas).
function EdificioVisitarAccion({
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

  if (enProceso) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={(ev) => {
            ev.stopPropagation();
            onContinuar();
          }}
        >
          <ClipboardList /> Continuar
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={(ev) => {
            ev.stopPropagation();
            onCancelar();
          }}
          aria-label="Cancelar visita"
          className="h-9 w-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          <Ban />
        </Button>
      </div>
    );
  }
  // Pendiente, Finalizado o Cancelado comparten el botón de (re)iniciar: `iniciarVisita` crea siempre
  // un registro nuevo, no reactiva el anterior, así que un cancelado se puede rehacer sin pasar por
  // una espontánea. Solo lo deshabilita `bloqueado` (otra visita en curso). Para Finalizado/Cancelado
  // mostramos el hint del estado + label de reintento.
  return (
    <div className="flex items-center justify-end gap-2">
      {done ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Visitado
        </span>
      ) : cancelled ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-rose-600 dark:text-rose-400">
          <Ban className="h-3.5 w-3.5" /> Cancelada
        </span>
      ) : null}
      <Button
        size="sm"
        className="gap-1.5 whitespace-nowrap"
        onClick={(ev) => {
          ev.stopPropagation();
          onIniciar();
        }}
        disabled={bloqueado}
        title={bloqueado ? "Terminá la visita en curso primero" : undefined}
      >
        {done || cancelled ? <RotateCcw /> : <Play />}
        {bloqueado
          ? "Visita en curso"
          : done
            ? "Re-visitar"
            : cancelled
              ? "Reiniciar visita"
              : "Iniciar visita"}
      </Button>
    </div>
  );
}
