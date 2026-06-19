import * as React from "react";

import { cn } from "@/lib/utils";

// Chip suave (fondo tint + texto del color) para categorías/tags/prioridad — el look de las
// pills "NUEVA / FEATURE", "DISEÑO / UI", "ALTA", "MEDIA" de la referencia.
// Para ESTADOS usar StatusBadge (pill con dot). Para métricas chicas (esfuerzo, "5h") usar
// tone="neutral".
export type PillTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "blue"
  | "violet"
  | "amber"
  | "pink";

const TONES: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Mapeo de prioridad → tono, para grillas que tengan ese campo (ALTA/MEDIA/BAJA).
export function priorityTone(priority?: string | null): PillTone {
  switch ((priority ?? "").trim().toUpperCase()) {
    case "ALTA":
    case "URGENTE":
    case "CRITICA":
      return "amber";
    case "MEDIA":
      return "blue";
    case "BAJA":
      return "neutral";
    default:
      return "neutral";
  }
}
