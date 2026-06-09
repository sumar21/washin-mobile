import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const ALL = "__all__";

// Opción del combobox: un string (value === label) o un par {value, label} cuando el value
// debe ser único pero el texto puede repetirse (p. ej. máquinas con el mismo nombre).
export type ComboOption = string | { value: string; label: string };

// Combobox buscable para listas largas (p. ej. 400+ edificios). Replica el ComboBox
// con SearchFields de PowerApps; reemplaza al <Select> plano cuando hay que filtrar
// escribiendo. `value === "__all__"` representa la opción "Todos".
export function Combobox({
  value,
  onChange,
  options,
  allLabel = "Todos",
  showAll = true,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  allLabel?: string;
  // En filtros muestra la opción "Todos" (value "__all__"). En altas/selección directa
  // pasar showAll={false}: el value es directamente la opción elegida (sin sentinel).
  showAll?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selectedLabel =
    value === ALL
      ? allLabel
      : (opts.find((o) => o.value === value)?.label ?? value);
  const isPlaceholder = value === "" || value == null;

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10",
            className,
          )}
        >
          <span className={cn("line-clamp-1 text-left", isPlaceholder && "text-muted-foreground")}>
            {isPlaceholder ? placeholder : selectedLabel}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {showAll ? (
              <CommandItem value={allLabel} onSelect={() => pick(ALL)}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === ALL ? "opacity-100" : "opacity-0",
                  )}
                />
                {allLabel}
              </CommandItem>
            ) : null}
            {opts.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.value}
                keywords={[opt.label]}
                onSelect={() => pick(opt.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === opt.value ? "opacity-100" : "opacity-0",
                  )}
                />
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
