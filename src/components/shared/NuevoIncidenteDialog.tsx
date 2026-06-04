import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CircleSlash,
  Package,
  Plus,
  Save,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import { cn } from "@/lib/utils";
import { crearIncidente, type DetalleMaquina } from "@/lib/api-client";

const CATEGORIAS = ["Tildado", "Todo Funcionando", "Mecánico", "Placa"];

const ACCIONES = ["Requiere Repuesto", "Cambio de Máquina"];

const ESTADOS: { value: "SI" | "NO"; label: string }[] = [
  { value: "NO", label: "No Resuelto" },
  { value: "SI", label: "Resuelto" },
];

type RepuestoSel = { Repuesto: string; Cantidad: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquina: DetalleMaquina;
}

export function NuevoIncidenteDialog({ open, onOpenChange, maquina }: Props) {
  const qc = useQueryClient();
  const { user } = useSession();

  const { data: stock = [] } = useQuery({
    queryKey: ["stock"],
    queryFn: () => api.listStock(),
  });

  const [categoria, setCategoria] = useState("");
  const [accion, setAccion] = useState("");
  const [resuelto, setResuelto] = useState<"SI" | "NO">("NO");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [repuestos, setRepuestos] = useState<RepuestoSel[]>([]);
  const [repuestoPickerOpen, setRepuestoPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setCategoria("");
      setAccion("");
      setResuelto("NO");
      setDescripcion("");
      setFoto(null);
      setRepuestos([]);
    }
  }, [open]);

  async function onSave() {
    if (!descripcion.trim()) {
      toast.error("Falta la descripción del incidente");
      return;
    }
    setSaving(true);
    try {
      // Alta real (queda "A Revisar"). Nota: acción/foto/repuestos y el camino
      // "Resuelto" pertenecen al flujo de resolución (Fase 2) y aún no se persisten.
      await crearIncidente({
        IDMaquina_IN: maquina.IDMaquina_DM,
        ConcatMaquina_IN: maquina.ConcatMaquina_DM,
        CodigoEdifcio_IN: maquina.CodigoEdificio_DM,
        NombreEdificio_IN: maquina.Edificio_DM,
        TecnicoAsignado_IN: user?.Concat_Nombre_Apellido ?? "",
        Descripcion: descripcion.trim(),
        Categoria: categoria || undefined,
      });
    } catch (e) {
      setSaving(false);
      toast.error(
        e instanceof Error ? e.message : "No se pudo crear el incidente",
      );
      return;
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente creado");
    onOpenChange(false);
  }

  function removeRepuesto(idx: number) {
    setRepuestos((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          {/* Hero */}
          <div className="relative shrink-0 overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-destructive/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-red-500/5 text-red-600 ring-1 ring-red-200/60 dark:text-red-400 dark:ring-red-500/20">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Nuevo incidente
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Registrar problema en la máquina
                </p>
              </div>
            </div>
          </div>

          {/* Body scrollable */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {/* Máquina (read-only chip) */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Máquina
              </label>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
                  <Wrench className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">
                    {maquina.ConcatMaquina_DM}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Building2 className="size-3 shrink-0" />
                    <span className="truncate">{maquina.Edificio_DM}</span>
                    <span className="opacity-50">·</span>
                    <span className="font-mono">{maquina.NroSerie_DM}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Categoría + Acción */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Categoría">
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="h-11 md:h-10">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Acción">
                <Select value={accion} onValueChange={setAccion}>
                  <SelectTrigger className="h-11 md:h-10">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ACCIONES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Estado */}
            <FormField label="Estado">
              <Select
                value={resuelto}
                onValueChange={(v) => setResuelto(v as "SI" | "NO")}
              >
                <SelectTrigger className="h-11 md:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ESTADOS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>

            {/* Foto */}
            <FormField label="Fotografía">
              <PhotoCapture
                label="Agregar fotografía"
                value={foto}
                onChange={setFoto}
              />
            </FormField>

            {/* Repuestos */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Repuestos
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRepuestoPickerOpen(true)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Plus />
                  Agregar
                </Button>
              </div>

              {repuestos.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed bg-card/50 px-4 py-5 text-center">
                  <CircleSlash className="size-5 text-muted-foreground/60" />
                  <p className="text-xs font-medium text-muted-foreground">
                    No hay repuestos seleccionados
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {repuestos.map((r, idx) => (
                    <li
                      key={`${r.Repuesto}-${idx}`}
                      className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Package className="size-3.5" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {r.Repuesto}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                        ×{r.Cantidad}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRepuesto(idx)}
                        aria-label="Quitar repuesto"
                        className="size-7 shrink-0"
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Descripción */}
            <FormField label="Descripción" required>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalle del problema..."
                rows={3}
                className="resize-none"
              />
            </FormField>
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="h-10 flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 hover:shadow-lg sm:flex-none"
            >
              <Save />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RepuestosTotalesDialog
        open={repuestoPickerOpen}
        onOpenChange={setRepuestoPickerOpen}
        stock={stock.map((s) => s.Repuesto)}
        initial={repuestos}
        onSave={setRepuestos}
      />
    </>
  );
}

// Wrapper fino sobre Field/FieldLabel de shadcn, preservando el estilo de label
// (uppercase, muted, asterisco requerido) usado en toda la app.
function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {children}
    </Field>
  );
}

function RepuestosTotalesDialog({
  open,
  onOpenChange,
  stock,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stock: string[];
  initial: RepuestoSel[];
  onSave: (r: RepuestoSel[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  // Cuando abre, sincroniza con la selección actual
  useEffect(() => {
    if (open) {
      const map: Record<string, string> = {};
      initial.forEach((r) => {
        map[r.Repuesto] = String(r.Cantidad);
      });
      setQuantities(map);
      setSearch("");
    }
  }, [open, initial]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return stock;
    return stock.filter((s) => s.toLowerCase().includes(t));
  }, [stock, search]);

  function setQty(name: string, val: string) {
    setQuantities((prev) => {
      const next = { ...prev };
      if (val === "") {
        delete next[name];
      } else {
        next[name] = val;
      }
      return next;
    });
  }

  const selectedCount = useMemo(
    () =>
      Object.entries(quantities).filter(([, v]) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0;
      }).length,
    [quantities],
  );

  const totalUnidades = useMemo(
    () =>
      Object.entries(quantities).reduce((acc, [, v]) => {
        const n = parseInt(v, 10);
        return acc + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [quantities],
  );

  function handleSave() {
    const result: RepuestoSel[] = Object.entries(quantities)
      .map(([Repuesto, v]) => {
        const n = parseInt(v, 10);
        return { Repuesto, Cantidad: Number.isFinite(n) && n > 0 ? n : 0 };
      })
      .filter((r) => r.Cantidad > 0);
    onSave(result);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        {/* Hero */}
        <div className="relative shrink-0 overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                Repuestos totales
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ingresá la cantidad para cada repuesto que necesites.
              </p>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className="shrink-0 border-b bg-background px-5 py-3">
          <InputGroup className="h-10">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar repuesto..."
            />
            {search ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar"
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>

        {/* Tabla zebra */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
              <CircleSlash className="size-5 text-muted-foreground/60" />
              <p className="text-xs font-medium text-muted-foreground">
                No se encontró ningún repuesto.
              </p>
            </div>
          ) : (
            <>
              {/* Header de columnas */}
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/50 px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                <span className="flex-1">Repuesto</span>
                <span className="w-20 text-center">Cantidad</span>
              </div>
              <ul>
                {filtered.map((name, idx) => {
                  const qty = quantities[name] ?? "";
                  const active = qty !== "" && parseInt(qty, 10) > 0;
                  return (
                    <li
                      key={name}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 transition-colors",
                        idx % 2 === 0 ? "bg-background" : "bg-muted/30",
                        active && "ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Package className="size-3.5" />
                      </div>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          active
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/80",
                        )}
                      >
                        {name}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(name, e.target.value)}
                        placeholder="0"
                        className={cn(
                          "h-9 w-20 text-center font-mono text-sm",
                          active &&
                            "border-primary/40 bg-primary/5 font-bold text-primary",
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Totales */}
        <div className="flex shrink-0 items-center justify-between border-t bg-muted/30 px-5 py-2.5 text-xs">
          <span className="text-muted-foreground">
            {selectedCount} ítem{selectedCount === 1 ? "" : "s"} seleccionado
            {selectedCount === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-foreground">
            {totalUnidades} unidad{totalUnidades === 1 ? "" : "es"}
          </span>
        </div>

        <DialogFooter className="shrink-0 flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 flex-1 sm:flex-none">
              Cerrar
            </Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            className="h-10 flex-1 gap-2 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 hover:shadow-lg sm:flex-none"
          >
            <Save />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
