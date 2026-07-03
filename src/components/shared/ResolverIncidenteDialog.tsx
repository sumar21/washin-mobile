import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  getRepuestosDeIncidente,
  resolverAsignadoIncidente,
  type Incidente,
} from "@/lib/api-client";

// ── Resolver incidente ASIGNADO (paridad PowerApps "Confirmar reparación", ~L1499) ─────────
// Flujo de 2 pasos, DISTINTO de "Revisar" (que elige resuelto/no, requiere repuesto o cambio de
// máquina, en ScreenIncidenteForm). Acá los repuestos ya vienen asignados:
//   Paso 1: confirmar repuestos → toggle "Todos los repuestos" (usó todo) o editar cantidad / borrar.
//   Paso 2: observación + foto (opcional) → confirma y marca Resuelto.

// Línea editable de repuesto (copia local de 13.RepuestosIncidentes).
interface LineaEdit {
  lineId: number;
  repuesto: string;
  cantidadOriginal: number;
  cantidad: number; // usado (editable)
  activa: boolean; // false = eliminada (se enviará cantidad 0 → Anulada)
}

export function ResolverIncidenteDialog({
  incidente,
  onClose,
  onResolved,
}: {
  incidente: Incidente | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const isOpen = !!incidente;
  // "Cambio de Maquina": no hay repuestos que confirmar; se resuelve + swap de máquinas (backend).
  const esCambioMaquina = incidente?.NoResuelto_IN === "Cambio de Maquina";
  const [paso, setPaso] = useState<1 | 2>(1);
  const [todos, setTodos] = useState(true); // "Todos los repuestos" (usó todo lo asignado)
  const [lineas, setLineas] = useState<LineaEdit[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Repuestos ya asignados al incidente (13.RepuestosIncidentes).
  const { data: repuestos = [], isLoading } = useQuery({
    queryKey: ["repuestos-incidente", incidente?.ID],
    queryFn: () => getRepuestosDeIncidente(incidente!.ID),
    enabled: isOpen,
  });

  // Reset al abrir un incidente distinto.
  useEffect(() => {
    if (incidente) {
      setPaso(1);
      setTodos(true);
      setDescripcion("");
      setFoto(null);
    }
  }, [incidente?.ID]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar las líneas editables cuando llegan los repuestos asignados.
  useEffect(() => {
    setLineas(
      repuestos.map((r) => ({
        lineId: r.ID,
        repuesto: r.Repuesto,
        cantidadOriginal: r.Cantidad,
        cantidad: r.Cantidad,
        activa: true,
      })),
    );
  }, [repuestos]);

  // Con "Todos" activo, las líneas van tal cual se asignaron (sin ediciones ni borrados).
  const lineasFinales = useMemo<LineaEdit[]>(
    () =>
      todos
        ? lineas.map((l) => ({
            ...l,
            cantidad: l.cantidadOriginal,
            activa: true,
          }))
        : lineas,
    [todos, lineas],
  );

  function setCantidad(lineId: number, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setLineas((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, cantidad: n } : l)),
    );
  }
  function quitarLinea(lineId: number) {
    setLineas((prev) =>
      prev.map((l) =>
        l.lineId === lineId ? { ...l, activa: false, cantidad: 0 } : l,
      ),
    );
  }

  async function submit() {
    if (!incidente) return;
    if (!descripcion.trim()) {
      toast.error("Agregá una observación");
      return;
    }
    setSaving(true);
    try {
      await resolverAsignadoIncidente({
        id: incidente.ID,
        descripcion,
        fotoBase64: foto ?? undefined,
        nombreEdificio: incidente.NombreEdificio_IN,
        concatMaquina: incidente.ConcatMaquina_IN,
        ...(esCambioMaquina
          ? {
              cambioMaquina: {
                concatMaquinaVieja: incidente.ConcatMaquina_IN,
                concatMaquinaNueva: incidente.MaquinaAsignada_IN,
                codigoEdificio: incidente.CodigoEdifcio_IN,
                nombreEdificio: incidente.NombreEdificio_IN,
              },
            }
          : {
              // Enviamos TODAS las líneas (las eliminadas con cantidad 0 → se anulan en el backend).
              lineas: lineasFinales.map((l) => ({
                lineId: l.lineId,
                repuesto: l.repuesto,
                cantidad: l.activa ? l.cantidad : 0,
              })),
            }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success("Incidente resuelto");
    onResolved();
  }

  // Filas visibles del paso 1 (ocultamos las eliminadas cuando se editó).
  const filasVisibles = lineasFinales.filter((l) => todos || l.activa);

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="p-0"
        desktopClassName="max-w-lg rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>
            {esCambioMaquina
              ? "Confirmar cambio de máquina"
              : paso === 1
                ? "Resolver incidente"
                : "Confirmar reparación del incidente"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            #{incidente?.IDIncidente} · {incidente?.NombreEdificio_IN}
            {incidente?.ConcatMaquina_IN
              ? ` · ${incidente.ConcatMaquina_IN}`
              : ""}
            {incidente?.IDMaquina_IN ? ` · ID ${incidente.IDMaquina_IN}` : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {esCambioMaquina ? (
          <>
            {/* Cambio de máquina: resumen del swap + observación + foto (sin paso de repuestos). */}
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-3">
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Sale (a depósito · Wash Inn)
                    </p>
                    <p className="font-medium">
                      {incidente?.ConcatMaquina_IN}
                      {incidente?.IDMaquina_IN
                        ? ` · ID ${incidente.IDMaquina_IN}`
                        : ""}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Entra (a {incidente?.NombreEdificio_IN})
                    </p>
                    <p className="font-medium">
                      {incidente?.MaquinaAsignada_IN || "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs-cambio">Observación</Label>
                <Textarea
                  id="obs-cambio"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  placeholder="Qué se hizo en el cambio…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fotografía (opcional)</Label>
                <PhotoCapture
                  label="Agregar fotografía"
                  value={foto}
                  onChange={setFoto}
                />
              </div>
            </div>
            <ResponsiveDialogFooter className="px-5 pb-5 pt-2">
              <ResponsiveDialogClose asChild>
                <Button variant="outline" disabled={saving}>
                  Cancelar
                </Button>
              </ResponsiveDialogClose>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Guardando…" : "Confirmar"}
              </Button>
            </ResponsiveDialogFooter>
          </>
        ) : paso === 1 ? (
          <>
            {/* Paso 1: confirmar repuestos usados */}
            <div className="flex items-center justify-between gap-3 px-5 pt-3">
              <Label htmlFor="todos-repuestos" className="font-medium">
                Todos los repuestos
              </Label>
              <Switch
                id="todos-repuestos"
                checked={todos}
                onCheckedChange={setTodos}
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </div>
              ) : filasVisibles.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  Este incidente no tiene repuestos asignados.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Repuestos</span>
                    <span className="text-center">Cantidad</span>
                    <span className="text-right">Acciones</span>
                  </div>
                  {filasVisibles.map((l) => (
                    <div
                      key={l.lineId}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {l.repuesto}
                      </span>
                      {todos ? (
                        <span className="w-16 text-center text-sm tabular-nums">
                          {l.cantidad}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          value={String(l.cantidad)}
                          onChange={(e) => setCantidad(l.lineId, e.target.value)}
                          className="h-9 w-16 text-center"
                          aria-label={`Cantidad de ${l.repuesto}`}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => quitarLinea(l.lineId)}
                        disabled={todos}
                        aria-label={`Quitar ${l.repuesto}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ResponsiveDialogFooter className="px-5 pb-5 pt-2">
              <ResponsiveDialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </ResponsiveDialogClose>
              <Button onClick={() => setPaso(2)} disabled={isLoading}>
                Aceptar
              </Button>
            </ResponsiveDialogFooter>
          </>
        ) : (
          <>
            {/* Paso 2: observación + foto (opcional) */}
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="obs-reparacion">Observación</Label>
                <Textarea
                  id="obs-reparacion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  placeholder="Qué se hizo en la reparación…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fotografía (opcional)</Label>
                <PhotoCapture
                  label="Agregar fotografía"
                  value={foto}
                  onChange={setFoto}
                />
              </div>
            </div>

            <ResponsiveDialogFooter className="px-5 pb-5 pt-2">
              <Button
                variant="outline"
                onClick={() => setPaso(1)}
                disabled={saving}
              >
                Volver
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Guardando…" : "Confirmar"}
              </Button>
            </ResponsiveDialogFooter>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ── Ver repuestos de un incidente (13.RepuestosIncidentes) ─────────────────
export function VerRepuestosDialog({
  incidente,
  onClose,
}: {
  incidente: Incidente | null;
  onClose: () => void;
}) {
  const { data: repuestos = [], isLoading } = useQuery({
    queryKey: ["repuestos-incidente", incidente?.ID],
    queryFn: () => getRepuestosDeIncidente(incidente!.ID),
    enabled: !!incidente,
  });

  return (
    <ResponsiveDialog open={!!incidente} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="p-0"
        desktopClassName="max-w-md rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>
            Repuestos del incidente #{incidente?.IDIncidente}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {incidente?.NombreEdificio_IN}
            {incidente?.ConcatMaquina_IN
              ? ` · ${incidente.ConcatMaquina_IN}`
              : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : repuestos.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              Este incidente no tiene repuestos registrados.
            </div>
          ) : (
            <ul className="space-y-2">
              {repuestos.map((r) => (
                <li
                  key={r.ID}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.Repuesto}</p>
                    {r.Status ? (
                      <div className="mt-0.5">
                        <StatusBadge status={r.Status} />
                      </div>
                    ) : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    <span className="text-[10px] opacity-70">×</span>
                    {r.Cantidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ResponsiveDialogFooter className="px-5 pb-5 pt-3">
          <ResponsiveDialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
