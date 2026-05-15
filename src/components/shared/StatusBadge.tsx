import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  ALTA: "success",
  ACTIVO: "success",
  ACTIVE: "success",
  FINALIZADO: "success",
  RESUELTO: "success",
  REALIZADA: "success",
  BAJA: "secondary",
  INACTIVO: "secondary",
  ANULADO: "destructive",
  CANCELADO: "destructive",
  PENDIENTE: "warning",
  PROGRAMADA: "warning",
  ASIGNADA: "warning",
  "EN PROCESO": "default",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const value = (status ?? "").toString();
  const key = value.trim().toUpperCase();
  const variant = VARIANT[key] ?? "outline";
  return <Badge variant={variant}>{value || "—"}</Badge>;
}
