import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  IncidenteFilters,
  type IncidenteFiltersValue,
} from "@/components/shared/IncidenteFilters";
import { type ComboOption } from "@/components/shared/Combobox";
import { useIsDesktop } from "@/hooks/use-media-query";

const EMPTY: IncidenteFiltersValue = {
  mesAno: [],
  edificio: [],
  estado: [],
};

// Botón de filtros con modelo borrador → "Aplicar". Popover en desktop / Drawer en mobile.
// Misma mecánica que MaquinaFilterButton (CLAUDE.md › filtros), para Incidentes.
export function IncidenteFilterButton({
  current,
  mesAnoOpts,
  edificioNames,
  estados,
  onApply,
  className,
}: {
  current: IncidenteFiltersValue;
  mesAnoOpts: ComboOption[];
  edificioNames: string[];
  estados: string[];
  onApply: (value: IncidenteFiltersValue) => void;
  className?: string;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<IncidenteFiltersValue>(current);

  // Cuántas dimensiones de filtro tienen al menos una opción elegida (0–3).
  const activeCount = [current.mesAno, current.edificio, current.estado].filter(
    (v) => v.length > 0,
  ).length;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(current);
    setOpen(next);
  }

  function setField(field: keyof IncidenteFiltersValue, value: string[]) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function apply() {
    onApply(draft);
    setOpen(false);
  }

  function clear() {
    setDraft(EMPTY);
  }

  const triggerInner = (
    <>
      <Filter className="h-4 w-4" />
      <span className="hidden lg:inline">Filtros</span>
      {activeCount > 0 ? (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {activeCount}
        </span>
      ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={className}>
            {triggerInner}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-primary">Filtrar</p>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={clear}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <div className="p-4">
            <IncidenteFilters
              value={draft}
              onChange={setField}
              mesAnoOpts={mesAnoOpts}
              edificioNames={edificioNames}
              estados={estados}
            />
          </div>
          <div className="border-t p-4 pt-3">
            <Button className="w-full" onClick={apply}>
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        className={className}
        onClick={() => handleOpenChange(true)}
      >
        {triggerInner}
      </Button>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filtros</DrawerTitle>
          <DrawerDescription>
            Filtrá los incidentes por mes, edificio o estado.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <IncidenteFilters
            value={draft}
            onChange={setField}
            mesAnoOpts={mesAnoOpts}
            edificioNames={edificioNames}
            estados={estados}
          />
        </div>
        <DrawerFooter>
          <Button onClick={apply}>Aplicar</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
