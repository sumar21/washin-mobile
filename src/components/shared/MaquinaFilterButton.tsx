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
  MaquinaFilters,
  type MaquinaFiltersValue,
} from "@/components/shared/MaquinaFilters";
import { useIsDesktop } from "@/hooks/use-media-query";

const ALL = "__all__";
const EMPTY: MaquinaFiltersValue = { edificio: ALL, modelo: ALL, marca: ALL };

// Botón de filtros con modelo borrador → "Aplicar". En desktop despliega un Popover anclado
// al botón; en mobile abre un Drawer (bottom sheet). Una sola fuente de verdad para ambos.
export function MaquinaFilterButton({
  current,
  edificioNames,
  modelos,
  marcas,
  onApply,
  className,
}: {
  current: MaquinaFiltersValue;
  edificioNames: string[];
  modelos: string[];
  marcas: string[];
  onApply: (value: MaquinaFiltersValue) => void;
  className?: string;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MaquinaFiltersValue>(current);

  const activeCount = [current.edificio, current.modelo, current.marca].filter(
    (v) => v !== ALL,
  ).length;

  // Al abrir, sincronizar el borrador con el filtro aplicado.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(current);
    setOpen(next);
  }

  function setField(field: keyof MaquinaFiltersValue, value: string) {
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
      Filtros
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
            <MaquinaFilters
              value={draft}
              onChange={setField}
              edificioNames={edificioNames}
              modelos={modelos}
              marcas={marcas}
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
            Filtrá las máquinas por edificio, modelo o marca.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <MaquinaFilters
            value={draft}
            onChange={setField}
            edificioNames={edificioNames}
            modelos={modelos}
            marcas={marcas}
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
