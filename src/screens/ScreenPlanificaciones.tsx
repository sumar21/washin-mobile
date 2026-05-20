import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  ListChecks,
  Lock,
  MapPin,
  QrCode,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GpsButton } from "@/components/shared/GpsButton";
import { QrScannerButton } from "@/components/shared/QrScannerButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";

export default function ScreenPlanificaciones() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, currentVisit, setCurrentVisit } = useSession();

  const { data: resumenes = [], isLoading } = useQuery({
    queryKey: ["planificaciones-resumen"],
    queryFn: () => api.listPlanificacionesResumen(),
  });
  const { data: detalles = [] } = useQuery({
    queryKey: ["planificaciones-detalle"],
    queryFn: () => api.listPlanificacionesDetalle(),
  });
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: () => api.listEdificios(),
  });

  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelObs, setCancelObs] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [edifSel, setEdifSel] = useState("");
  const [registering, setRegistering] = useState(false);

  const qrOk = !!currentVisit?.qrScanned;
  // QR no bloquea el checklist (sólo es informativo).
  const canChecklist = !!currentVisit;

  const myName = user?.Concat_Nombre_Apellido;
  const myResumenes = resumenes.filter((r) =>
    user?.Rol === "Tecnico" ? r.Tecnico_RP === myName : true,
  );

  const edificiosActivos = edificios.filter((e) => e.Status === "ALTA");

  async function onRegistrar() {
    if (!edifSel) {
      toast.error("Elegí un edificio para registrar la visita");
      return;
    }
    const e = edificios.find((x) => x.Codigo === edifSel);
    if (!e) return;
    setRegistering(true);
    const now = new Date();
    const fecha = now.toLocaleDateString("es-AR");
    const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const idUnico = `VST-${Date.now()}`;
    await api.createRegistro({
      IDUnico: idUnico,
      Codigo: e.Codigo,
      Edificio: e.Edificio,
      Direccion: e.Direccion,
      Nombre: myName ?? "",
      Estado: "En Proceso",
      HoraInicio: hora,
      HoraFinal: "",
      HoraVisita: hora,
      Fecha: fecha,
      MesAño: `${now.getMonth() + 1}-${now.getFullYear()}`,
    });
    setCurrentVisit({
      IDUnico: idUnico,
      Codigo: e.Codigo,
      Edificio: e.Edificio,
      Direccion: e.Direccion,
      Fecha: fecha,
      HoraInicio: hora,
    });
    qc.invalidateQueries({ queryKey: ["registros"] });
    setRegistering(false);
    setRegistrarOpen(false);
    setEdifSel("");
    toast.success("Visita registrada", {
      description: `${e.Edificio} · ${hora}`,
    });
  }

  const MOTIVOS_CANCELACION = [
    "Falta De Respuesta",
    "Encargado No Puede Recibirme",
    "No hay luz",
    "Sin Contacto Para Ingresar",
  ];

  async function confirmCancelVisit() {
    if (!cancelMotivo) {
      toast.error("Seleccioná un motivo");
      return;
    }
    setCancelling(true);
    if (currentVisit) {
      const registros = await api.listRegistros();
      const reg = registros.find((r) => r.IDUnico === currentVisit.IDUnico);
      if (reg) {
        await api.patchRegistro(reg.ID, {
          Estado: "Anulado",
          MotivoCancelacion: cancelMotivo,
          ObservacionGeneral: cancelObs.trim() || undefined,
        });
      }
    }
    setCurrentVisit(null);
    qc.invalidateQueries({ queryKey: ["registros"] });
    setCancelling(false);
    setCancelOpen(false);
    setCancelMotivo("");
    setCancelObs("");
    toast.info("Visita cancelada", { description: cancelMotivo });
  }

  function onQrScan(_code?: string) {
    if (!currentVisit) {
      toast.error("Primero seleccioná un edificio", {
        description: "Tocá 'Registro de visita' para empezar.",
      });
      return;
    }
    if (qrOk) {
      toast.info("Edificio ya confirmado por QR");
      return;
    }
    setCurrentVisit({ ...currentVisit, qrScanned: true });
    toast.success("QR validado", {
      description: "Ya podés realizar el checklist.",
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        title="Registro de visita"
        subtitle={currentVisit ? `En curso · ${currentVisit.Edificio}` : "Circuitos del mes"}
        back="/home"
        action={<HamburgerMenu />}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Visitas Espontáneas */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Visitas Espontáneas
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Registrar visita / Cancelar visita */}
            {currentVisit ? (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-rose-300/60 bg-gradient-to-br from-rose-50 to-red-100 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md dark:border-rose-500/40 dark:from-rose-500/10 dark:to-red-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm">
                  <Ban className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  Cancelar visita
                </p>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRegistrarOpen(true)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-blue-50 to-sky-100 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md dark:from-blue-500/10 dark:to-sky-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-700 text-primary-foreground shadow-sm">
                  <UserCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-primary">Registro de visita</p>
              </button>
            )}

            {/* Realizar Checklist */}
            <button
              type="button"
              onClick={() => navigate("/checklist")}
              disabled={!canChecklist}
              className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left shadow-sm transition-all ${
                canChecklist
                  ? "border-emerald-300/60 bg-gradient-to-br from-emerald-50 to-teal-100 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-500/40 dark:from-emerald-500/10 dark:to-teal-500/5"
                  : "cursor-not-allowed border-border bg-muted/40 opacity-60"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  canChecklist
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <ClipboardList className="h-5 w-5" />
              </div>
              <p
                className={`text-sm font-semibold ${
                  canChecklist
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                Realizar Checklist
              </p>
              {!canChecklist ? (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  {currentVisit && !qrOk ? (
                    <>
                      <QrCode className="h-3 w-3" />
                      Falta QR
                    </>
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </span>
              ) : null}
            </button>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <QrScannerButton
            label={qrOk ? "QR validado" : currentVisit ? "Validar QR" : "Escanear QR"}
            variant={qrOk ? "secondary" : "outline"}
            onScan={onQrScan}
          />
          <GpsButton
            label="Detectar edificio"
            onLocation={(c) =>
              toast.info("Ubicación detectada", {
                description: `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`,
              })
            }
          />
        </div>

        {/* Visita en curso (si la hay) */}
        {currentVisit ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Visita en curso
                </p>
                <p className="truncate text-sm font-semibold">{currentVisit.Edificio}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentVisit.Direccion}</span>
                  <span className="opacity-50">·</span>
                  <span className="font-mono">{currentVisit.HoraInicio}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentVisit(null)}
                aria-label="Cancelar visita"
                className="h-8"
              >
                Cerrar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Listado de rutas / empty state */}
        <div className="flex-1 space-y-3">
          {isLoading ? <InlineLoader /> : null}

          {!isLoading && myResumenes.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin Ruta"
              description="No hay circuitos asignados este mes."
            />
          ) : null}

          {myResumenes.map((r) => {
            const items = detalles.filter(
              (d) =>
                d.NroCircuito_DP === r.NroCircuito_RP &&
                d.Mes_DP === r.Mes_RP &&
                d.Año_DP === r.Año_RP,
            );
            return (
              <Card key={r.ID}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Ruta Nº {r.NroCircuito_RP}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.Mes_RP} {r.Año_RP} · {r.Tecnico_RP}
                      </p>
                    </div>
                    <StatusBadge status={r.Estado_RP} />
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {items.map((d) => (
                      <div
                        key={d.ID}
                        className="flex items-center gap-2 rounded-md border bg-card p-2 hover:border-primary"
                      >
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{d.Edificio_DP}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {d.Direccion_DP}
                          </p>
                        </div>
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          {d.Codigo_DP}
                        </Badge>
                        <StatusBadge status={d.Estado_DP} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button size="sm" variant="outline" onClick={() => navigate("/edificios")}>
                      Ver edificios <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>

      {/* Dialog: Registrar visita */}
      <Dialog open={registrarOpen} onOpenChange={setRegistrarOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Registrar visita
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Estás por registrar una visita en este edificio.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio <span className="text-destructive">*</span>
              </label>
              <Select value={edifSel} onValueChange={setEdifSel}>
                <SelectTrigger className="h-11 md:h-10">
                  <SelectValue placeholder="Seleccionar un edificio" />
                </SelectTrigger>
                <SelectContent>
                  {edificiosActivos.map((e) => (
                    <SelectItem key={e.ID} value={e.Codigo}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{e.Edificio}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {e.Direccion}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={registering}
                className="h-10 flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={onRegistrar}
              disabled={registering || !edifSel}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 sm:flex-none"
            >
              <Check className="h-4 w-4" />
              {registering ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cancelar visita con motivo + observación */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCancelOpen(false);
            setCancelMotivo("");
            setCancelObs("");
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          {/* Hero rojo */}
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-600 ring-1 ring-rose-200/60 dark:text-rose-400 dark:ring-rose-500/20">
                <Ban className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Cancelar visita
                </DialogTitle>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {currentVisit?.Edificio}
                </p>
                {qrOk ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Al cancelar se perderá el QR validado.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Motivo <span className="text-destructive">*</span>
              </label>
              <Select value={cancelMotivo} onValueChange={setCancelMotivo}>
                <SelectTrigger className="h-11 md:h-10">
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_CANCELACION.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Observación
              </label>
              <Textarea
                value={cancelObs}
                onChange={(e) => setCancelObs(e.target.value)}
                rows={3}
                placeholder="Detalle adicional (opcional)..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={cancelling}
                className="h-10 flex-1 gap-1 sm:flex-none"
              >
                <X className="h-4 w-4" />
                Volver
              </Button>
            </DialogClose>
            <Button
              onClick={confirmCancelVisit}
              disabled={cancelling || !cancelMotivo}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 sm:flex-none"
            >
              <Ban className="h-4 w-4" />
              {cancelling ? "Cancelando..." : "Cancelar visita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
