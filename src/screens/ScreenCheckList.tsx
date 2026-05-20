import { useMemo, useState } from "react";
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
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import type { ChecklistResponse } from "@/data/types";

type Resp = Record<number, ChecklistResponse>;

export default function ScreenCheckList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentVisit, setCurrentVisit } = useSession();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["checklist"],
    queryFn: () => api.listChecklist(),
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
    setConfirmOpen(true);
  }

  async function doSave() {
    setSaving(true);
    // Si hay un currentVisit, marcamos el registro como Finalizado con su completitud
    if (currentVisit) {
      const completitud = Math.round((okCount / Math.max(1, total)) * 100);
      const now = new Date();
      const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      // Buscar el registro creado por IDUnico
      const registros = await api.listRegistros();
      const reg = registros.find((r) => r.IDUnico === currentVisit.IDUnico);
      if (reg) {
        await api.patchRegistro(reg.ID, {
          Estado: "Finalizado",
          HoraFinal: hora,
          Completitud: completitud,
          ObservacionGeneral: generalObs.trim() || undefined,
          FotoGeneral: generalPhoto ?? undefined,
        });
      }
      setCurrentVisit(null);
    }
    qc.invalidateQueries({ queryKey: ["registros"] });
    setSaving(false);
    setConfirmOpen(false);
    toast.success("Checklist registrado", {
      description: `${okCount} OK · ${noCount} con observación`,
    });
    navigate("/home");
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <div className="mx-auto w-full max-w-3xl space-y-3 p-3 pb-4 md:p-6 md:pb-6">
        {/* Hero: back + contexto + progreso + counters en una sola card */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50/80 via-card to-sky-50/60 p-3 shadow-sm dark:from-blue-500/10 dark:via-card dark:to-sky-500/5 md:p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative mb-3 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                currentVisit ? navigate("/planificaciones") : navigate(-1)
              }
              aria-label="Volver"
              className="h-9 w-9 shrink-0 rounded-lg bg-white/60 text-foreground/80 backdrop-blur-sm hover:bg-white dark:bg-card/60 dark:hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            {currentVisit ? (
              <>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
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
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-primary to-blue-700 transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Mini counters inline */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <InlineCount tone="ok" count={okCount} label="Ok" icon={<Check className="h-3 w-3" />} />
              <InlineCount tone="no" count={noCount} label="No" icon={<X className="h-3 w-3" />} />
              <InlineCount tone="pending" count={pendingCount} label="Pend." icon={<Clock className="h-3 w-3" />} />
            </div>
          </div>
        </div>

        {isLoading ? <InlineLoader /> : null}

        {/* Items */}
        <div className="space-y-2">
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
                className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card pl-3 pr-2 py-2.5 shadow-sm transition-shadow hover:shadow-md"
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
                      <FileText className="h-3 w-3 shrink-0 text-primary" />
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
            className="h-12 w-full gap-2 bg-gradient-to-br from-primary to-blue-700"
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
                    ? "bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-600 ring-rose-200/60 dark:text-rose-400 dark:ring-rose-500/20"
                    : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-primary/20"
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
              className={`h-10 flex-1 gap-2 sm:flex-none ${
                obsItem?.mode === "marcarNo"
                  ? "bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
                  : "bg-gradient-to-br from-primary to-blue-700"
              }`}
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
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
              <Button className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 sm:flex-none">
                <Check className="h-4 w-4" />
                Listo
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar guardado */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 ring-1 ring-amber-200/60 dark:text-amber-400 dark:ring-amber-500/20">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Registrar check
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Estás seguro que deseas registrar el checklist?
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-5 py-3 text-center">
            <div className="rounded-lg border bg-emerald-50/60 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="mx-auto h-3.5 w-3.5" />
              {okCount} OK
            </div>
            <div className="rounded-lg border bg-rose-50/60 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <X className="mx-auto h-3.5 w-3.5" />
              {noCount} NO
            </div>
            <div className="rounded-lg border bg-muted/40 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="mx-auto h-3.5 w-3.5" />
              {pendingCount}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={saving}
                className="h-10 flex-1 sm:flex-none"
              >
                Cerrar
              </Button>
            </DialogClose>
            <Button
              onClick={doSave}
              disabled={saving}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 sm:flex-none"
            >
              <Check className="h-4 w-4" />
              {saving ? "Guardando..." : "Aceptar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    <div className="flex items-center justify-center gap-1.5 rounded-lg border bg-card/60 px-2 py-1.5 text-xs">
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
      ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
      : tone === "no"
        ? "border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/30"
        : "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30";
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
