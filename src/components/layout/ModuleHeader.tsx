import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Encabezado de módulo para desktop/tablet (md+). Compacto y alineado a la izquierda — NO
// clona el alto del header mobile centrado (ScreenHeader). Ver CLAUDE.md › "Optimizar espacio
// en desktop/tablet". Cada pantalla densa usa este header en desktop y deja el ScreenHeader
// solo para mobile (`className="md:hidden"`).
export function ModuleHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: string; // ruta a la que vuelve (subpáginas de detalle, p. ej. historial → listado)
  children?: ReactNode; // controles a la derecha (buscador, filtros, acciones)
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/40 bg-background/95 backdrop-blur-md md:block">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-2.5 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {back ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate(back)}
                aria-label="Volver"
                className="-ml-1 h-9 w-9 shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight tracking-tight lg:text-xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {children ? (
            <div className="flex shrink-0 items-center gap-2">{children}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
