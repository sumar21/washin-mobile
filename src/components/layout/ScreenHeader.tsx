import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean | string;
  action?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({ title, subtitle, back = true, action, className }: ScreenHeaderProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "safe-top sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur",
        className,
      )}
    >
      {back ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          aria-label="Volver"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      ) : (
        <div className="w-10" />
      )}
      <div className="flex flex-1 flex-col text-center">
        <h1 className="text-base font-semibold leading-tight">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex min-w-10 items-center justify-end">{action}</div>
    </header>
  );
}
