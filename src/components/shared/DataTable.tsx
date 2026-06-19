import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Grilla de datos estándar del proyecto (vista DESKTOP de toda lista de registros).
// Mobile se sigue renderizando como cards apiladas; esto es solo el contenedor de tabla md+.
// Ver CLAUDE.md › "Estética de grillas (DataTable)". Define UNA sola estética:
//   - columna principal (primary) flexible que absorbe el ancho (título + subtítulo),
//   - resto de columnas compactas (whitespace-nowrap),
//   - headers ordenables (click: asc → desc → sin orden),
//   - filas clickeables, pills de estado/categoría, sin checkboxes.

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Columna dominante: se estira (w-full) y absorbe el espacio sobrante. Suele ser título+subtítulo. */
  primary?: boolean;
  /** Habilita el header ordenable. Requiere sortAccessor. */
  sortable?: boolean;
  /** Valor por el que ordenar (string o number). null/undefined van al final. */
  sortAccessor?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  /** Clases extra para la celda (td). */
  className?: string;
  /** Clases extra para el header (th). */
  headClassName?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

function alignClass(a?: "left" | "right" | "center") {
  return a === "right"
    ? "text-right"
    : a === "center"
      ? "text-center"
      : "text-left";
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  initialSort,
  className,
  empty,
  bare,
}: {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => React.Key;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir?: "asc" | "desc" };
  /** Clases del contenedor externo (p. ej. "hidden md:block"). */
  className?: string;
  /** Render cuando data está vacío (opcional; si las pantallas ya gatean por length, no hace falta). */
  empty?: React.ReactNode;
  /** Sin borde/fondo/sombra propios: para cuando ya va dentro de una Card (evita doble caja). */
  bare?: boolean;
}) {
  const [sort, setSort] = React.useState<SortState>(
    initialSort ? { key: initialSort.key, dir: initialSort.dir ?? "asc" } : null,
  );

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return data;
    const acc = col.sortAccessor;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls al final, sin importar la dirección
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * factor;
      }
      return (
        String(va).localeCompare(String(vb), "es", {
          numeric: true,
          sensitivity: "base",
        }) * factor
      );
    });
  }, [data, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // tercer click: vuelve al orden natural
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden",
        bare ? null : "rounded-lg border bg-card shadow-xs",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              const canSort = col.sortable && !!col.sortAccessor;
              return (
                <TableHead
                  key={col.key}
                  aria-sort={
                    isSorted
                      ? sort!.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    col.primary ? "w-full" : "whitespace-nowrap",
                    alignClass(col.align),
                    col.headClassName,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
                        col.align === "right" && "flex-row-reverse",
                        col.align === "center" && "justify-center",
                        isSorted && "text-foreground",
                      )}
                    >
                      {col.header}
                      {isSorted ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && empty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row, i) => (
              <TableRow
                key={getRowKey(row, i)}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.primary ? "w-full" : "whitespace-nowrap",
                      alignClass(col.align),
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Celda principal estándar: ícono opcional + título (fuerte) + subtítulo (gris, 1 línea).
// Es la columna que se estira y da el "peso" visual de la fila, como la columna SOLICITUD
// de la referencia.
export function CellTitleSubtitle({
  title,
  subtitle,
  icon: Icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
