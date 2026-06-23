import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ComboOption } from "@/components/shared/Combobox";

// Combobox buscable de SELECCIÓN MÚLTIPLE (para filtros). value = array de valores elegidos;
// vacío = "Todos" (sin filtro). El popover NO se cierra al elegir (permite marcar varios).
// Reusa los mismos primitivos que Combobox para mantener una sola estética.
export function MultiCombobox({
  value,
  onChange,
  options,
  allLabel = "Todos",
  summaryNoun = "seleccionados",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  disabled = false,
  className,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboOption[];
  allLabel?: string;
  /** Sustantivo para el resumen "3 {noun}" cuando hay varios elegidos (p. ej. "meses"). */
  summaryNoun?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selected = value ?? [];
  const isEmpty = selected.length === 0;
  const labelOf = (v: string) =>
    opts.find((o) => o.value === v)?.label ?? v;
  const triggerLabel = isEmpty
    ? allLabel
    : selected.length === 1
      ? labelOf(selected[0])
      : `${selected.length} ${summaryNoun}`;

  function toggle(v: string) {
    onChange(
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v],
    );
  }

  function box(on: boolean) {
    return (
      <span
        className={cn(
          "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input",
        )}
      >
        {on ? <Check className="h-3 w-3" /> : null}
      </span>
    );
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
          <span
            className={cn(
              "line-clamp-1 text-left",
              isEmpty && "text-muted-foreground",
            )}
          >
            {triggerLabel}
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
            <CommandItem value={allLabel} onSelect={() => onChange([])}>
              {box(isEmpty)}
              {allLabel}
            </CommandItem>
            {opts.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.value}
                keywords={[opt.label]}
                onSelect={() => toggle(opt.value)}
              >
                {box(selected.includes(opt.value))}
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
