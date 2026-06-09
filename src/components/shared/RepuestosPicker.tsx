import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronsUpDown,
  Loader2,
  Minus,
  Package,
  PackageSearch,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  getStockTecnico,
  getRepuestosCatalogo,
  type RepuestoUsado,
  type ResolverModo,
} from "@/lib/api-client";

// Stepper de cantidad reutilizable.
export function Stepper({
  value,
  min = 0,
  onDelta,
}: {
  value: number;
  min?: number;
  onDelta: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onDelta(-1)}
        disabled={value <= min}
        aria-label="Menos"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onDelta(1)}
        aria-label="Más"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Selector de repuestos según el modo de resolución. Maneja su propio estado y notifica el
// resultado (RepuestoUsado[]) por onChange. Resetea al cambiar el modo.
//   "Cambio Repuesto"   → stock del técnico (consume) — muestra el stock actual a la IZQUIERDA del stepper.
//   "Requiere Repuesto" → catálogo general (pide, no consume).
//   otros               → sin selector.
export function RepuestosPicker({
  modo,
  onChange,
}: {
  modo: ResolverModo;
  onChange: (repuestos: RepuestoUsado[]) => void;
}) {
  const [qtyStock, setQtyStock] = useState<Record<number, number>>({});
  const [cartReq, setCartReq] = useState<{ repuesto: string; cantidad: number }[]>(
    [],
  );
  const [catOpen, setCatOpen] = useState(false);

  const { data: stock = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-tecnico"],
    queryFn: getStockTecnico,
    enabled: modo === "Cambio Repuesto",
  });
  const { data: catalogo = [] } = useQuery({
    queryKey: ["repuestos-catalogo"],
    queryFn: getRepuestosCatalogo,
    enabled: modo === "Requiere Repuesto",
  });

  // Reset al cambiar de modo.
  useEffect(() => {
    setQtyStock({});
    setCartReq([]);
  }, [modo]);

  function deltaStock(id: number, max: number, delta: number) {
    setQtyStock((q) => {
      const next = Math.max(0, Math.min(max, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });
  }

  function addReq(repuesto: string) {
    setCartReq((c) =>
      c.some((x) => x.repuesto === repuesto)
        ? c
        : [...c, { repuesto, cantidad: 1 }],
    );
  }

  const repuestos: RepuestoUsado[] = useMemo(() => {
    if (modo === "Cambio Repuesto") {
      return stock
        .filter((s) => (qtyStock[s.ID] ?? 0) > 0)
        .map((s) => ({
          stockId: s.ID,
          repuesto: s.Repuesto,
          cantidad: qtyStock[s.ID],
        }));
    }
    if (modo === "Requiere Repuesto") return cartReq;
    return [];
  }, [modo, stock, qtyStock, cartReq]);

  // Notificar al padre cuando cambia la selección (onChange debe ser estable, p. ej. un setState).
  useEffect(() => {
    onChange(repuestos);
  }, [repuestos, onChange]);

  if (modo === "Cambio Repuesto") {
    return (
      <div className="space-y-1.5">
        <Label>Repuestos de tu stock</Label>
        {loadingStock ? (
          <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando stock…
          </div>
        ) : stock.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            No tenés repuestos en tu stock. Si necesitás uno, marcá
            <b> No resuelto → Requiere repuesto</b>.
          </div>
        ) : (
          <div className="space-y-1.5 rounded-lg border p-2">
            {stock.map((s) => (
              <div key={s.ID} className="flex items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {s.Repuesto}
                  {s.Codigo ? (
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      · {s.Codigo}
                    </span>
                  ) : null}
                </p>
                {/* Stock actual a la izquierda del input de cantidad. */}
                <span className="shrink-0 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/70">
                  Stock {s.Cantidad}
                </span>
                <Stepper
                  value={qtyStock[s.ID] ?? 0}
                  onDelta={(d) => deltaStock(s.ID, s.Cantidad, d)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (modo === "Requiere Repuesto") {
    return (
      <div className="space-y-2">
        <Label>Repuestos que se necesitan</Label>
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <PackageSearch className="h-4 w-4" />
                Buscar y agregar repuesto…
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Buscar repuesto…" />
              <CommandList>
                <CommandEmpty>Sin resultados</CommandEmpty>
                {catalogo.map((r) => (
                  <CommandItem
                    key={r.ID}
                    value={r.Nombre}
                    onSelect={() => {
                      addReq(r.Nombre);
                      setCatOpen(false);
                    }}
                  >
                    {r.Nombre}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {cartReq.length ? (
          <div className="space-y-1.5 rounded-lg border p-2">
            {cartReq.map((c) => (
              <div key={c.repuesto} className="flex items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.repuesto}
                </p>
                <Stepper
                  value={c.cantidad}
                  min={1}
                  onDelta={(d) =>
                    setCartReq((cart) =>
                      cart.map((x) =>
                        x.repuesto === c.repuesto
                          ? { ...x, cantidad: Math.max(1, x.cantidad + d) }
                          : x,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setCartReq((cart) =>
                      cart.filter((x) => x.repuesto !== c.repuesto),
                    )
                  }
                  aria-label="Quitar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (modo === "Cambio de Maquina") {
    return (
      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
        Se marca el incidente para <b>cambio de máquina</b>. El reemplazo y el
        movimiento de depósito los asigna el administrador.
      </p>
    );
  }

  return null; // Resuelto Sin Repuesto → sin selector
}
