import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { RepuestosPicker } from "@/components/shared/RepuestosPicker";
import {
  getRepuestosDeIncidente,
  resolverIncidente,
  type Incidente,
  type RepuestoUsado,
  type ResolverModo,
} from "@/lib/api-client";

// ── Resolver incidente (4 modos PowerApps) ─────────────────────────────────
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
  const [estado, setEstado] = useState<"Resuelto" | "NoResuelto">("Resuelto");
  const [modo, setModo] = useState<ResolverModo>("Cambio Repuesto");
  const [descripcion, setDescripcion] = useState("");
  const [repuestos, setRepuestos] = useState<RepuestoUsado[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset al abrir un incidente distinto.
  useEffect(() => {
    if (incidente) {
      setEstado("Resuelto");
      setModo("Cambio Repuesto");
      setDescripcion("");
      setRepuestos([]);
    }
  }, [incidente?.ID]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeEstado(v: string) {
    if (v !== "Resuelto" && v !== "NoResuelto") return;
    setEstado(v);
    setModo(v === "Resuelto" ? "Cambio Repuesto" : "Requiere Repuesto");
  }

  const requierePartes =
    modo === "Cambio Repuesto" || modo === "Requiere Repuesto";

  async function submit() {
    if (!incidente) return;
    if (!descripcion.trim()) {
      toast.error("Agregá una observación");
      return;
    }
    if (requierePartes && repuestos.length === 0) {
      toast.error("Elegí al menos un repuesto");
      return;
    }
    setSaving(true);
    try {
      await resolverIncidente({
        id: incidente.ID,
        modo,
        Descripcion: descripcion,
        repuestos,
        nombreEdificio: incidente.NombreEdificio_IN,
        concatMaquina: incidente.ConcatMaquina_IN,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      return;
    } finally {
      setSaving(false);
    }
    toast.success(
      estado === "Resuelto" ? "Incidente resuelto" : "Incidente actualizado",
    );
    onResolved();
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent
        className="p-0"
        desktopClassName="max-w-lg rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>
            Resolver incidente #{incidente?.IDIncidente}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {incidente?.NombreEdificio_IN}
            {incidente?.ConcatMaquina_IN
              ? ` · ${incidente.ConcatMaquina_IN}`
              : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 pt-3">
          {/* ¿Se resolvió? */}
          <div className="space-y-1.5">
            <Label>¿Se resolvió?</Label>
            <ToggleGroup
              type="single"
              value={estado}
              onValueChange={changeEstado}
              variant="outline"
              className="grid grid-cols-2"
            >
              <ToggleGroupItem value="Resuelto">Resuelto</ToggleGroupItem>
              <ToggleGroupItem value="NoResuelto">No resuelto</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Modo */}
          <div className="space-y-1.5">
            <Label>¿Cómo?</Label>
            <ToggleGroup
              type="single"
              value={modo}
              onValueChange={(v) => v && setModo(v as ResolverModo)}
              variant="outline"
              className="grid grid-cols-2"
            >
              {estado === "Resuelto" ? (
                <>
                  <ToggleGroupItem value="Cambio Repuesto">
                    Con repuesto
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Resuelto Sin Repuesto">
                    Sin repuesto
                  </ToggleGroupItem>
                </>
              ) : (
                <>
                  <ToggleGroupItem value="Requiere Repuesto">
                    Requiere repuesto
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Cambio de Maquina">
                    Cambio de máquina
                  </ToggleGroupItem>
                </>
              )}
            </ToggleGroup>
          </div>

          {/* Selector de repuestos según el modo */}
          <RepuestosPicker modo={modo} onChange={setRepuestos} />

          {/* Observación */}
          <div className="space-y-1.5">
            <Label htmlFor="obs-resolver">
              {estado === "Resuelto" ? "Observación de resolución" : "Observación"}
            </Label>
            <Textarea
              id="obs-resolver"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder={
                estado === "Resuelto"
                  ? "Qué se hizo / qué se cambió…"
                  : "Qué falta / qué repuesto se necesita…"
              }
            />
          </div>
        </div>

        <ResponsiveDialogFooter className="px-5 pb-5 pt-4">
          <ResponsiveDialogClose asChild>
            <Button variant="outline" disabled={saving}>
              Cancelar
            </Button>
          </ResponsiveDialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving
              ? "Guardando…"
              : estado === "Resuelto"
                ? "Resolver"
                : "Guardar"}
          </Button>
        </ResponsiveDialogFooter>
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
