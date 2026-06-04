import { Spinner } from "@/components/ui/spinner";

export function LoadingOverlay({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
      <Spinner className="size-8 text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function InlineLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Spinner />
      {label ?? "Cargando..."}
    </div>
  );
}
