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

// Opción del combobox: un string (value === label) o un objeto cuando el value debe ser único
// pero el texto puede repetirse (p. ej. máquinas con el mismo nombre).
//
// `sublabel` es una SEGUNDA línea, más chica y en monoespaciada. Existe para los datos que el
// técnico tiene que poder LEER Y VERIFICAR contra la chapa de la máquina (N° de serie, ID): antes
// iban pegados al final del label y el `line-clamp-1` del trigger los cortaba justo a ellos, así
// que el técnico elegía una máquina sin poder confirmar cuál era y quedaba con la duda de haber
// cargado mal el incidente.
export type ComboOption =
  | string
  | { value: string; label: string; sublabel?: string };

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
    typeof o === "string" ? { value: o, label: o, sublabel: undefined } : o,
  );
  const selected = value === ALL ? null : opts.find((o) => o.value === value);
  const selectedLabel = value === ALL ? allLabel : (selected?.label ?? value);
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
          <span className={cn("min-w-0 flex-1 text-left", isPlaceholder && "text-muted-foreground")}>
            <span className={cn("block", selected?.sublabel ? "truncate" : "line-clamp-1")}>
              {isPlaceholder ? placeholder : selectedLabel}
            </span>
            {/* 2ª línea: el dato que el técnico VERIFICA contra la chapa de la máquina. Va en su
                propia línea justamente para que el recorte del label no se lo coma. */}
            {selected?.sublabel && (
              <span className="block truncate font-mono text-[11px] leading-tight text-muted-foreground">
                {selected.sublabel}
              </span>
            )}
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
                keywords={[opt.label, opt.sublabel ?? ""]}
                onSelect={() => pick(opt.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === opt.value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block font-mono text-[11px] leading-tight text-muted-foreground">
                      {opt.sublabel}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
