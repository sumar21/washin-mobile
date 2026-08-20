import { useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { cantidadContraStock } from "@/lib/borrador";
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

// Stepper de cantidad reutilizable. Touch targets: 40px en mobile / 36px en desktop
// (el técnico opera en obra; los 28px anteriores quedaban por debajo del mínimo táctil).
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
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 md:h-9 md:w-9"
        onClick={() => onDelta(-1)}
        disabled={value <= min}
        aria-label="Menos"
      >
        <Minus />
      </Button>
      <span className="w-7 text-center text-base font-semibold tabular-nums md:text-sm">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 md:h-9 md:w-9"
        onClick={() => onDelta(1)}
        aria-label="Más"
      >
        <Plus />
      </Button>
    </div>
  );
}

// Concat_RT llega como "L82 - Correa Verde Speed Queen" y tenemos el Codigo ("L82") por
// separado. Mostramos el nombre sin el prefijo del código (que ya se ve aparte), sin tocar
// el valor que se envía (RepuestoUsado.repuesto sigue siendo el Concat completo).
function nombreLimpio(concat: string, codigo: string): string {
  const cod = codigo.trim();
  if (cod) {
    const re = new RegExp(
      `^${cod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`,
      "i",
    );
    const sinCodigo = concat.replace(re, "").trim();
    if (sinCodigo) return sinCodigo;
  }
  return concat.trim();
}

// Selector de repuestos según el modo de resolución. Maneja su propio estado y notifica el
// resultado (RepuestoUsado[]) por onChange. Resetea al cambiar el modo.
//   "Cambio Repuesto"   → stock del técnico (consume) — muestra el stock actual a la IZQUIERDA del stepper.
//   "Requiere Repuesto" → catálogo general (pide, no consume).
//   otros               → sin selector.
export function RepuestosPicker({
  modo,
  onChange,
  inicial,
}: {
  modo: ResolverModo;
  onChange: (repuestos: RepuestoUsado[]) => void;
  /**
   * Selección con la que arrancar. La usa la recuperación de borradores (useBorrador): si al
   * técnico se le descartó la pestaña al sacar la foto, los repuestos que ya había elegido
   * vuelven con el resto del formulario. Se consume UNA vez por identidad: si después cambia el
   * modo, se resetea como siempre.
   */
  inicial?: RepuestoUsado[];
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

  // Reset al cambiar de modo — sembrando `inicial` la primera vez que llega (borrador restaurado).
  const semillaAplicadaRef = useRef<RepuestoUsado[] | null>(null);
  useEffect(() => {
    const semilla =
      inicial && inicial.length && inicial !== semillaAplicadaRef.current ? inicial : null;
    if (semilla) semillaAplicadaRef.current = semilla;

    if (semilla && modo === "Cambio Repuesto") {
      const q: Record<number, number> = {};
      for (const r of semilla) {
        if (typeof r.stockId === "number") q[r.stockId] = r.cantidad;
      }
      setQtyStock(q);
      setCartReq([]);
      return;
    }
    if (semilla && modo === "Requiere Repuesto") {
      setQtyStock({});
      setCartReq(semilla.map((r) => ({ repuesto: r.repuesto, cantidad: r.cantidad })));
      return;
    }
    setQtyStock({});
    setCartReq([]);
  }, [modo, inicial]);

  // Cantidad efectiva de una línea: la selección clampeada contra el stock de AHORA. Ver
  // `cantidadContraStock` (lib/borrador.ts) — se aplica en los TRES puntos de lectura.
  const cantidadEfectiva = (id: number, max: number) =>
    cantidadContraStock(qtyStock[id], max);

  function deltaStock(id: number, max: number, delta: number) {
    setQtyStock((q) => {
      // Se parte del valor ya clampeado: si no, con qty=3 y stock=1 el "−" calculaba
      // min(1, 3−1)=1 y el botón quedaba trabado en 1.
      const actual = cantidadContraStock(q[id], max);
      const next = Math.max(0, Math.min(max, actual + delta));
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
      // El filtro va sobre la cantidad CLAMPEADA, no sobre la cruda: un repuesto cuyo stock cayó
      // a 0 no tiene que salir como línea en 0.
      return stock
        .map((s) => ({
          stockId: s.ID,
          repuesto: s.Repuesto,
          cantidad: cantidadContraStock(qtyStock[s.ID], s.Cantidad),
        }))
        .filter((r) => r.cantidad > 0);
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
          <div className="space-y-2">
            {stock.map((s) => {
              const qty = cantidadEfectiva(s.ID, s.Cantidad);
              return (
                <div
                  key={s.ID}
                  className={cn(
                    "rounded-lg border p-2.5 transition-colors",
                    qty > 0 && "border-primary/40 bg-primary/[0.03]",
                  )}
                >
                  {/* Nombre a lo ancho: es lo que el técnico necesita leer, no se trunca. */}
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2">
                      {nombreLimpio(s.Repuesto, s.Codigo)}
                    </p>
                  </div>
                  {/* Fila de control: código + stock actual (izq) · cantidad a usar (der). */}
                  <div className="mt-2 flex items-center justify-between gap-2 pl-6">
                    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      {s.Codigo.trim() ? (
                        <span className="shrink-0 font-mono font-semibold text-foreground/70">
                          {s.Codigo.trim()}
                        </span>
                      ) : null}
                      <span className="shrink-0 rounded-md border bg-muted/50 px-1.5 py-0.5 font-semibold tabular-nums text-foreground/70">
                        Stock {s.Cantidad}
                      </span>
                    </div>
                    <Stepper
                      value={qty}
                      onDelta={(d) => deltaStock(s.ID, s.Cantidad, d)}
                    />
                  </div>
                </div>
              );
            })}
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
          <div className="space-y-2">
            {cartReq.map((c) => (
              <div key={c.repuesto} className="rounded-lg border p-2.5">
                {/* Nombre a lo ancho, no se trunca. */}
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2">
                    {c.repuesto}
                  </p>
                </div>
                {/* Fila de control: cantidad pedida + quitar. */}
                <div className="mt-2 flex items-center justify-end gap-2 pl-6">
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
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive md:h-9 md:w-9"
                    onClick={() =>
                      setCartReq((cart) =>
                        cart.filter((x) => x.repuesto !== c.repuesto),
                      )
                    }
                    aria-label="Quitar"
                  >
                    <Trash2 />
                  </Button>
                </div>
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
