import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// El header solo muestra el botón "Volver" en mobile y las acciones a la derecha.
// El título y el subtítulo se aceptan como props por compatibilidad, pero no se renderizan
// para liberar espacio vertical (cada screen ya da contexto en su propio hero/banner).
interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean | string;
  action?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({ back = true, action, className }: ScreenHeaderProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "safe-top sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/80 px-2 py-1.5 backdrop-blur md:px-4 md:py-2",
        className,
      )}
    >
      {back ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          aria-label="Volver"
          className="h-9 w-9 md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      ) : (
        <div className="h-9 w-9 md:hidden" />
      )}
      <div className="flex items-center gap-1">{action}</div>
    </header>
  );
}
