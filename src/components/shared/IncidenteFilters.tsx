import { cn } from "@/lib/utils";
import { MultiCombobox } from "@/components/shared/MultiCombobox";
import { type ComboOption } from "@/components/shared/Combobox";

// Filtros del módulo Incidentes (Mes-Año / Edificio / Estado), de SELECCIÓN MÚLTIPLE.
// Cada campo es un array de valores elegidos; vacío = "Todos" (sin filtro). Dos presentaciones:
// layout="row" (barra inline) y layout="stack" (apilado en el Drawer mobile).
export interface IncidenteFiltersValue {
  mesAno: string[];
  edificio: string[];
  estado: string[];
}

interface IncidenteFiltersProps {
  value: IncidenteFiltersValue;
  onChange: (field: keyof IncidenteFiltersValue, value: string[]) => void;
  mesAnoOpts: ComboOption[];
  edificioNames: string[];
  estados: string[];
  layout?: "row" | "stack";
  className?: string;
}

export function IncidenteFilters({
  value,
  onChange,
  mesAnoOpts,
  edificioNames,
  estados,
  layout = "stack",
  className,
}: IncidenteFiltersProps) {
  const row = layout === "row";
  return (
    <div
      className={cn(
        row
          ? "flex flex-col gap-3 sm:flex-row sm:items-end"
          : "flex flex-col gap-3",
        className,
      )}
    >
      <Field label="Mes" className={row ? "min-w-0 flex-1" : undefined}>
        <MultiCombobox
          value={value.mesAno}
          onChange={(v) => onChange("mesAno", v)}
          options={mesAnoOpts}
          allLabel="Todos"
          summaryNoun="meses"
          searchPlaceholder="Buscar mes..."
          emptyText="Sin períodos"
        />
      </Field>
      <Field label="Edificio" className={row ? "min-w-0 flex-1" : undefined}>
        <MultiCombobox
          value={value.edificio}
          onChange={(v) => onChange("edificio", v)}
          options={edificioNames}
          allLabel="Todos"
          summaryNoun="edificios"
          searchPlaceholder="Buscar edificio..."
          emptyText="Sin edificios"
        />
      </Field>
      <Field label="Estado" className={row ? "min-w-0 flex-1" : undefined}>
        <MultiCombobox
          value={value.estado}
          onChange={(v) => onChange("estado", v)}
          options={estados}
          allLabel="Todos"
          summaryNoun="estados"
          searchPlaceholder="Buscar estado..."
          emptyText="Sin estados"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-[13px] font-semibold text-foreground/90">
        {label}
      </label>
      {children}
    </div>
  );
}
