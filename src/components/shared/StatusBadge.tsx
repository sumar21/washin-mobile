import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "info" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  ALTA: "success",
  ACTIVO: "success",
  ACTIVE: "success",
  FINALIZADO: "success",
  RESUELTO: "success",
  REALIZADA: "success",
  APROBADA: "success",
  BAJA: "neutral",
  INACTIVO: "neutral",
  ANULADO: "destructive",
  CANCELADO: "destructive",
  PENDIENTE: "warning",
  PROGRAMADA: "warning",
  // Estados de incidente del modelo PowerApps (Status_IN): Asignado / A Revisar
  // en tono warning; cubrimos también la variante "ASIGNADA" por las dudas.
  ASIGNADA: "warning",
  ASIGNADO: "warning",
  "A REVISAR": "warning",
  "EN APROBACION": "info",
  "EN APROBACIÓN": "info",
  "EN PROCESO": "info",
};

// Pills suaves: fondo tint + texto del color + dot sólido del color. Tokens semánticos.
const TONE: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: "bg-success/10 text-success", dot: "bg-success" },
  warning: { pill: "bg-warning/10 text-warning", dot: "bg-warning" },
  destructive: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  info: { pill: "bg-primary/10 text-primary", dot: "bg-primary" },
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

export function StatusBadge({ status }: { status?: string | null }) {
  const value = (status ?? "").toString();
  const tone = STATUS_TONE[value.trim().toUpperCase()] ?? "neutral";
  const c = TONE[tone];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 whitespace-nowrap rounded-full border-transparent px-2.5 py-0.5 font-medium",
        c.pill,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} aria-hidden />
      {value || "—"}
    </Badge>
  );
}
