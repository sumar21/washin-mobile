import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  FileText,
  MessageSquare,
  Save,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { useBorrador } from "@/hooks/use-borrador";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import {
  getChecklistItems,
  finalizarVisita,
  CHECKLIST_ITEMS_FALLBACK,
} from "@/lib/api-client";
import type { ChecklistResponse } from "@/data/types";

type Resp = Record<number, ChecklistResponse>;

function nowHHmm() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScreenCheckList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentVisit, setCurrentVisit } = useSession();

  // Ítems hardcodeados como initialData: el checklist SIEMPRE se muestra, incluso sin wifi (el
  // técnico suele estar offline en el edificio). Con red, el fetch los refresca (mismos IDs → no
  // pierde respuestas). Ver CHECKLIST_ITEMS_FALLBACK en api-client.
  const { data: items = CHECKLIST_ITEMS_FALLBACK, isLoading } = useQuery({
    queryKey: ["checklist-items"],
    queryFn: getChecklistItems,
    initialData: CHECKLIST_ITEMS_FALLBACK,
    staleTime: 24 * 60 * 60 * 1000, // ~1 día: casi nunca cambia; evita refetch innecesario
  });

  const [resp, setResp] = useState<Resp>({});
  const [obsItem, setObsItem] = useState<{
    id: number;
    text: string;
    mode: "edit" | "marcarNo";
  } | null>(null);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [generalObs, setGeneralObs] = useState("");
  const [generalPhoto, setGeneralPhoto] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Conexión (equivale a Connection.Connected de PowerApps): indicador wifi + gate al guardar.
  const online = useOnline();
  // Horas del checklist: inicio (al abrir) y fin (cuando se completan todos los ítems, como
  // HoraFinCheck en PowerApps — "a pedido de Rodri"). Persisten junto con las respuestas.
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFinCheck, setHoraFinCheck] = useState("");

  // Guard de PRESENCIA (doble-QR de PA). HoraInicio (CollectHoraInicio) solo se marca tras escanear
  // el QR del edificio. Si hay una visita en curso pero la presencia NO fue confirmada
  // (qrScanned !== true) — p. ej. abierta por GEO o recuperada de sesión sin QR — no se puede usar
  // el checklist: se vuelve al origen (Edificios/Planificaciones) para escanear el QR del edificio.
  // (Una visita "manual" sin currentVisit no aplica al gate.)
  useEffect(() => {
    if (currentVisit && currentVisit.qrScanned !== true) {
      toast.error("Escaneá el QR del edificio para iniciar la visita");
      navigate(-1);
    }
  }, [currentVisit, navigate]);

  const total = items.length;
  const okCount = useMemo(
    () => Object.values(resp).filter((r) => r.Si === "Ok").length,
    [resp],
  );
  const noCount = useMemo(
    () => Object.values(resp).filter((r) => r.No === "Ok").length,
    [resp],
  );
  const pendingCount = Math.max(0, total - okCount - noCount);
  const percent = total > 0 ? Math.round(((okCount + noCount) / total) * 100) : 0;

  // Hora de inicio del checklist (CollectHoraInicio de PowerApps): se marca al abrir la pantalla.
  // Si hay un borrador, `aplicar` la pisa con la hora original de esa visita.
  useEffect(() => {
    setHoraInicio((h) => h || nowHHmm());
  }, []);

  // ── Borrador local del avance ────────────────────────────────────────────────────────────
  // Paridad PowerApps para la PERSISTENCIA (SaveData de CollectChecklistSV / CollectOBSGenerales
  // + ClearData() al cerrar, ScreenCheckList.pa.yaml:110,414,646,967). Lo que NO tiene equivalente
  // en PA —y es defensa nueva del port— es el resto: la clave scopeada por técnico, el TTL, el
  // aviso al restaurar y sacar la foto de localStorage. Ver hooks/use-borrador.ts.
  //
  // Sin visita en curso NO se persiste: `doSave` exige `currentVisit` para escribir en SharePoint,
  // así que un checklist "manual" no tiene a dónde ir; y meterlo en un bucket compartido lo haría
  // reaparecer en el edificio (o en el técnico) equivocado, que es peor que perderlo.
  const hayAvance =
    Object.keys(resp).length > 0 ||
    generalObs.trim() !== "" ||
    generalPhoto !== null;
  const { limpiar: limpiarBorrador } = useBorrador({
    scope: "checklist",
    id: currentVisit?.IDUnico ?? null,
    valor: { resp, generalObs, horaInicio, horaFinCheck },
    // La foto general va a IndexedDB, no a localStorage: pesa ~150-300 KB en base64 contra una
    // cuota de ~5 MB compartida con `washinn-session` (token + visita en curso).
    foto: generalPhoto,
    sucio: hayAvance,
    descripcion: currentVisit?.Edificio,
    aplicar: (v, foto) => {
      setResp(v.resp ?? {});
      setGeneralObs(v.generalObs ?? "");
      setGeneralPhoto(foto);
      if (v.horaInicio) setHoraInicio(v.horaInicio);
      setHoraFinCheck(v.horaFinCheck ?? "");
    },
    descartar: () => {
      setResp({});
      setGeneralObs("");
      setGeneralPhoto(null);
      setHoraFinCheck("");
    },
  });

  // Al completar todos los ítems, fijar la hora de fin (una sola vez), como PowerApps.
  useEffect(() => {
    if (total > 0 && pendingCount === 0 && !horaFinCheck) {
      setHoraFinCheck(nowHHmm());
    }
  }, [pendingCount, total, horaFinCheck]);

  function toggleSi(id: number) {
    setResp((p) => {
      const cur = p[id];
      const isOn = cur?.Si === "Ok";
      return {
        ...p,
        [id]: {
          ID: id,
          Si: isOn ? "" : "Ok",
          No: "",
          Observacion: cur?.Observacion ?? "",
          Foto: cur?.Foto,
        },
      };
    });
  }
  function handleNoClick(id: number) {
    const cur = resp[id];
    if (cur?.No === "Ok") {
      // Ya marcado: destildar
      setResp((p) => ({
        ...p,
        [id]: { ID: id, Si: "", No: "", Observacion: cur?.Observacion ?? "", Foto: cur?.Foto },
      }));
      return;
    }
    // Abrir dialog para registrar observación al marcar NO
    setObsItem({ id, text: cur?.Observacion ?? "", mode: "marcarNo" });
  }
  function openObs(id: number) {
    setObsItem({ id, text: resp[id]?.Observacion ?? "", mode: "edit" });
  }
  function saveObs() {
    if (!obsItem) return;
    if (obsItem.mode === "marcarNo" && !obsItem.text.trim()) {
      toast.error("La observación es obligatoria al marcar NO");
      return;
    }
    setResp((p) => {
      const prev = p[obsItem.id];
      return {
        ...p,
        [obsItem.id]: {
          ID: obsItem.id,
          Si: obsItem.mode === "marcarNo" ? "" : (prev?.Si ?? ""),
          No: obsItem.mode === "marcarNo" ? "Ok" : (prev?.No ?? ""),
          Observacion: obsItem.text.trim(),
          Foto: prev?.Foto,
        },
      };
    });
    setObsItem(null);
  }

  function confirmSave() {
    if (pendingCount > 0) {
      toast.error("Faltan ítems por responder", {
        description: `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`,
      });
      return;
    }
    // Verificación de conexión, como PowerApps (WarningNotConnected). Sin red no se puede
    // guardar en SharePoint, pero el avance ya quedó guardado en el dispositivo.
    if (!online) {
      toast.error("Sin conexión", {
        description:
          "Necesitás wifi o datos para guardar. Tu avance quedó guardado en el dispositivo.",
      });
      return;
    }
    setConfirmOpen(true);
  }

  async function doSave() {
    if (!online) {
      toast.error("Sin conexión", {
        description: "Tu avance quedó guardado en el dispositivo.",
      });
      return;
    }
    if (!currentVisit) {
      toast.error("No hay una visita en curso");
      return;
    }
    setSaving(true);
    // Una fila por ítem (todos respondidos: pendingCount === 0). Check = Ok/No.
    const itemsResueltos = items.map((it) => {
      const r = resp[it.ID];
      return {
        item: it.Descripcion,
        check: (r?.Si === "Ok" ? "Ok" : "No") as "Ok" | "No",
        observacion: r?.Observacion || undefined,
      };
    });
    try {
      // Guardado real: patch 01.Registros (Finalizado) + filas en 02.Detalles.
      await finalizarVisita({
        idUnico: currentVisit.IDUnico,
        items: itemsResueltos,
        okCount,
        noCount,
        horaInicio: currentVisit.HoraInicio || horaInicio,
        horaFinal: horaFinCheck || nowHHmm(),
        observacionGeneral: generalObs.trim() || undefined,
        fotoGeneral: generalPhoto ?? undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
      return;
    }
    setCurrentVisit(null);
    // Guardado en el backend → limpiar la copia local (como ClearData() de PowerApps).
    limpiarBorrador();
    qc.invalidateQueries({ queryKey: ["registros"] });
    qc.invalidateQueries({ queryKey: ["edificios-visitar"] });
    setSaving(false);
    setConfirmOpen(false);
    toast.success("Checklist registrado", {
      description: `${okCount} OK · ${noCount} con observación`,
    });
    navigate("/planificaciones");
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <div className="mx-auto w-full max-w-3xl space-y-2 p-3 pb-2 md:p-5 md:pb-3">
        {/* Hero: back + contexto + progreso + counters en una sola card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-xs md:p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/5 blur-3xl"
          />

          <div className="relative mb-2 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                currentVisit ? navigate("/planificaciones") : navigate(-1)
              }
              aria-label="Volver"
              className="h-9 w-9 shrink-0 rounded-lg text-foreground/80"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            {currentVisit ? (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight text-primary">
                    {currentVisit.Edificio}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {currentVisit.Direccion}
                  </p>
                </div>
                {qrOkLabel(currentVisit.qrScanned)}
              </>
            ) : (
              <p className="text-sm font-semibold text-foreground/80">Checklist</p>
            )}
            <WifiBadge online={online} />
          </div>

          {/* Progreso */}
          <div className="relative">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Progreso
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums leading-none text-primary">
                  {percent}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Mini counters inline */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <InlineCount tone="ok" count={okCount} label="Ok" icon={<Check className="h-3.5 w-3.5" />} />
              <InlineCount tone="no" count={noCount} label="No" icon={<X className="h-3.5 w-3.5" />} />
              <InlineCount tone="pending" count={pendingCount} label="Pend." icon={<Clock className="h-3.5 w-3.5" />} />
            </div>
          </div>
        </div>

        {isLoading ? <InlineLoader /> : null}

        {/* Items */}
        <div className="space-y-1.5">
          {items.map((it, idx) => {
            const r = resp[it.ID];
            const hasObs = !!r?.Observacion;
            const isSi = r?.Si === "Ok";
            const isNo = r?.No === "Ok";
            const stripe = isSi
              ? "bg-emerald-500"
              : isNo
                ? "bg-rose-500"
                : "bg-muted-foreground/20";
            return (
              <div
                key={it.ID}
                className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-card pl-3 pr-2 py-2 shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Stripe lateral */}
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1 ${stripe} transition-colors`}
                />

                {/* Número */}
                <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60 font-mono text-[10px] font-bold text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{it.Descripcion}</p>
                  {hasObs ? (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate italic">{r.Observacion}</span>
                    </p>
                  ) : null}
                </div>

                {/* Action group: 3 botones independientes de 44×44, con gap extra antes del X */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <ActionBtn
                    onClick={() => openObs(it.ID)}
                    label={hasObs ? "Editar observación" : "Agregar observación"}
                    active={hasObs}
                    tone="primary"
                  >
                    <FileText className="h-4 w-4" />
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => toggleSi(it.ID)}
                    label="Marcar OK"
                    active={isSi}
                    tone="ok"
                  >
                    <Check className="h-5 w-5" />
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => handleNoClick(it.ID)}
                    label="Marcar NO"
                    active={isNo}
                    tone="no"
                    className="ml-1"
                  >
                    <X className="h-5 w-5" />
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>

        {/* Observaciones generales button */}
        <Button
          variant="outline"
          onClick={() => setGeneralOpen(true)}
          className="h-11 w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
        >
          <MessageSquare className="h-4 w-4" />
          {generalObs.trim() || generalPhoto
            ? "Observaciones generales (editar)"
            : "Observaciones generales"}
        </Button>
      </div>

      {/* Sticky Guardar — mt-auto lo empuja al fondo del flex column aunque haya poco contenido */}
      <div className="safe-bottom sticky bottom-0 z-20 mt-auto border-t bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl p-3 md:p-4">
          <Button
            onClick={confirmSave}
            className="h-12 w-full gap-2"
            disabled={total === 0}
          >
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Dialog: Observación de un ítem */}
      <Dialog open={!!obsItem} onOpenChange={(o) => !o && setObsItem(null)}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${
                obsItem?.mode === "marcarNo" ? "bg-rose-500/15" : "bg-primary/10"
              }`}
            />
            <div className="relative flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  obsItem?.mode === "marcarNo"
                    ? "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400"
                    : "bg-primary/10 text-primary ring-primary/20"
                }`}
              >
                {obsItem?.mode === "marcarNo" ? (
                  <X className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  {obsItem?.mode === "marcarNo" ? "Agregar observación" : "Observación"}
                </DialogTitle>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {items.find((it) => it.ID === obsItem?.id)?.Descripcion}
                </p>
                {obsItem?.mode === "marcarNo" ? (
                  <p className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                    Al marcar NO es obligatorio detallar el motivo.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <Textarea
              autoFocus
              value={obsItem?.text ?? ""}
              onChange={(e) =>
                setObsItem(obsItem ? { ...obsItem, text: e.target.value } : null)
              }
              rows={4}
              placeholder={
                obsItem?.mode === "marcarNo"
                  ? "¿Por qué marcás este ítem como NO?"
                  : "Detalle de la observación..."
              }
              className="resize-none"
            />
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                Cerrar
              </Button>
            </DialogClose>
            <Button
              onClick={saveObs}
              variant={obsItem?.mode === "marcarNo" ? "destructive" : "default"}
              className="h-10 flex-1 gap-2 sm:flex-none"
            >
              <Check className="h-4 w-4" />
              {obsItem?.mode === "marcarNo" ? "Marcar NO" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Observaciones generales */}
      <Dialog open={generalOpen} onOpenChange={setGeneralOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Observaciones generales
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Comentarios y foto del recorrido completo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <Textarea
              value={generalObs}
              onChange={(e) => setGeneralObs(e.target.value)}
              rows={4}
              placeholder="Notas generales sobre la visita..."
              className="resize-none"
            />
            <PhotoCapture
              label="Tomar foto general"
              value={generalPhoto}
              onChange={setGeneralPhoto}
            />
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="h-10 flex-1 sm:flex-none"
              >
                Cerrar
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button className="h-10 flex-1 gap-2 sm:flex-none">
                <Check className="h-4 w-4" />
                Listo
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar guardado — Dialog centrado en desktop / Drawer (bottom sheet) en mobile */}
      <ResponsiveDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveDialogContent
          className="p-0"
          desktopClassName="max-w-sm overflow-hidden rounded-2xl"
        >
          {/* Encabezado: ícono coherente con "registrar check" + título + subtítulo */}
          <ResponsiveDialogHeader className="relative gap-0 overflow-hidden border-b bg-muted/30 px-5 pb-4 pt-5 text-left">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <ResponsiveDialogTitle className="text-base font-semibold leading-tight">
                  Registrar check
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="mt-0.5 text-xs leading-snug">
                  ¿Estás seguro que deseas registrar el checklist?
                </ResponsiveDialogDescription>
              </div>
            </div>
          </ResponsiveDialogHeader>

          {/* Resumen: 3 chips bien alineados (OK=success, NO=destructive, Pendientes=neutral) */}
          <div className="px-5 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Resumen del checklist
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ResumenChip
                tone="ok"
                count={okCount}
                label="OK"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <ResumenChip
                tone="no"
                count={noCount}
                label="No"
                icon={<X className="h-4 w-4" />}
              />
              <ResumenChip
                tone="pending"
                count={pendingCount}
                label="Pendientes"
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Footer: en mobile (Drawer) apila en columna con botón primario full-width; en
              desktop (Dialog) fila alineada a la derecha. */}
          <ResponsiveDialogFooter className="gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              onClick={doSave}
              disabled={saving}
              className="order-1 h-11 w-full gap-2 sm:order-2 sm:h-10 sm:w-auto"
            >
              <Check className="h-4 w-4" />
              {saving ? "Guardando..." : "Aceptar"}
            </Button>
            <ResponsiveDialogClose asChild>
              <Button
                variant="outline"
                disabled={saving}
                className="order-2 h-11 w-full sm:order-1 sm:h-10 sm:w-auto"
              >
                Cerrar
              </Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function ResumenChip({
  tone,
  count,
  label,
  icon,
}: {
  tone: "ok" | "no" | "pending";
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  const styles =
    tone === "ok"
      ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "no"
        ? "border-rose-200/70 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5",
        styles,
      )}
    >
      {icon}
      <span className="text-xl font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function WifiBadge({ online }: { online: boolean }) {
  return (
    <span
      title={online ? "Con conexión" : "Sin conexión"}
      aria-label={online ? "Con conexión" : "Sin conexión"}
      className={cn(
        "ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors",
        online
          ? "bg-emerald-100 text-emerald-600 ring-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20"
          : "bg-rose-100 text-rose-600 ring-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20",
      )}
    >
      {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
    </span>
  );
}

function qrOkLabel(scanned: boolean | undefined) {
  if (scanned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        QR ok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      Sin QR
    </span>
  );
}

function InlineCount({
  tone,
  count,
  label,
  icon,
}: {
  tone: "ok" | "no" | "pending";
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  const styles =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "no"
        ? "text-rose-700 dark:text-rose-400"
        : "text-muted-foreground";
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5 text-xs">
      <span className={`flex items-center gap-1 font-bold tabular-nums ${styles}`}>
        {icon}
        {count}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ActionBtn({
  onClick,
  label,
  active,
  tone,
  className,
  children,
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  tone: "primary" | "ok" | "no";
  className?: string;
  children: React.ReactNode;
}) {
  const activeStyles =
    tone === "ok"
      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
      : tone === "no"
        ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/25"
        : "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25";
  const idleStyles =
    tone === "ok"
      ? "border-border bg-card text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
      : tone === "no"
        ? "border-border bg-card text-muted-foreground hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-500/50 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
        : "border-primary/30 bg-card text-primary hover:bg-primary/5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
        active ? activeStyles : idleStyles
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
