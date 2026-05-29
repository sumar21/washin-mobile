import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { cn } from "@/lib/utils";

// Header sticky reutilizable para todas las pantallas.
// Soporta, de forma componible: botón "Volver" (mobile), título centrado con icono
// opcional, slot de búsqueda, acciones a la derecha y hamburguesa.
// El back y la hamburguesa son md:hidden (en desktop está el Sidebar).
interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  back?: boolean | string;
  search?: ReactNode;
  action?: ReactNode;
  hamburger?: boolean;
  titleClassName?: string;
  className?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  icon,
  back = true,
  search,
  action,
  hamburger = true,
  titleClassName,
  className,
}: ScreenHeaderProps) {
  const navigate = useNavigate();
  const hasCenter = !!title || !!search;

  return (
    <header
      className={cn(
        "safe-top sticky top-0 z-40 flex items-center gap-3 border-b border-border/40 bg-background/95 px-4 pb-3 pt-6 backdrop-blur-md md:px-6 md:pb-4 md:pt-7",
        className,
      )}
    >
      {/* Izquierda: volver (solo mobile). Ancho fijo mantiene el centro balanceado. */}
      {back ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          aria-label="Volver"
          className="h-9 w-9 shrink-0 md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      ) : (
        <div aria-hidden className="h-9 w-9 shrink-0 md:hidden" />
      )}

      {/* Centro: búsqueda (stretch) o título centrado. min-w-0 deja truncar. */}
      {hasCenter ? (
        search ? (
          <div className="min-w-0 flex-1">{search}</div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            {icon}
            <div className="min-w-0 text-center">
              <h1 className={cn("truncate text-sm font-semibold leading-tight", titleClassName)}>
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
        )
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      {/* Derecha: acciones + hamburguesa (HamburgerMenu ya es md:hidden internamente). */}
      <div className="flex shrink-0 items-center gap-1">
        {action}
        {hamburger ? <HamburgerMenu /> : null}
      </div>
    </header>
  );
}
