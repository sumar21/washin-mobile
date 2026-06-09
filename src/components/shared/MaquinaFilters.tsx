import { cn } from "@/lib/utils";
import { Combobox } from "@/components/shared/Combobox";

// Filtros de Detalle Máquina (Edificio / Modelo / Marca) reutilizados en dos presentaciones:
//   - layout="row"   → barra inline en desktop/tablet (cada campo en una columna).
//   - layout="stack" → apilados a full-width dentro del Drawer en mobile.
// Cada Combobox es buscable (importante para los 400+ edificios). value "__all__" = "Todos".
export interface MaquinaFiltersValue {
  edificio: string;
  modelo: string;
  marca: string;
}

interface MaquinaFiltersProps {
  value: MaquinaFiltersValue;
  onChange: (field: keyof MaquinaFiltersValue, value: string) => void;
  edificioNames: string[];
  modelos: string[];
  marcas: string[];
  layout?: "row" | "stack";
  className?: string;
}

export function MaquinaFilters({
  value,
  onChange,
  edificioNames,
  modelos,
  marcas,
  layout = "stack",
  className,
}: MaquinaFiltersProps) {
  const row = layout === "row";
  return (
    <div
      className={cn(
        row ? "flex flex-col gap-3 sm:flex-row sm:items-end" : "flex flex-col gap-3",
        className,
      )}
    >
      <Field label="Edificio" className={row ? "min-w-0 flex-1" : undefined}>
        <Combobox
          value={value.edificio}
          onChange={(v) => onChange("edificio", v)}
          options={edificioNames}
          allLabel="Todos"
          placeholder="Seleccionar un edificio"
          searchPlaceholder="Buscar edificio..."
          emptyText="Sin edificios"
        />
      </Field>
      <Field label="Modelo" className={row ? "min-w-0 flex-1" : undefined}>
        <Combobox
          value={value.modelo}
          onChange={(v) => onChange("modelo", v)}
          options={modelos}
          allLabel="Todos"
          placeholder="Seleccionar modelo"
          searchPlaceholder="Buscar modelo..."
          emptyText="Sin modelos"
        />
      </Field>
      <Field label="Marca" className={row ? "min-w-0 flex-1" : undefined}>
        <Combobox
          value={value.marca}
          onChange={(v) => onChange("marca", v)}
          options={marcas}
          allLabel="Todas"
          placeholder="Seleccionar marca"
          searchPlaceholder="Buscar marca..."
          emptyText="Sin marcas"
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
      <label className="text-[13px] font-semibold text-foreground/90">{label}</label>
      {children}
    </div>
  );
}
