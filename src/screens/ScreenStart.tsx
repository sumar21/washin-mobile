import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/stores/sessionStore";

export default function ScreenStart() {
  const navigate = useNavigate();
  const { user } = useSession();

  useEffect(() => {
    const t = setTimeout(() => {
      navigate(user ? "/home" : "/login", { replace: true });
    }, 1800);
    return () => clearTimeout(t);
  }, [navigate, user]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-sidebar p-8 text-sidebar-foreground">
      {/* Glow de acento de marca detrás del logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-sidebar-accent/20 blur-3xl"
      />
      {/* Grid sutil futurista */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(hsl(var(--sidebar-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--sidebar-foreground))_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <img
        src="/Logoapp.png"
        alt="Washinn"
        className="relative h-32 w-32 rounded-3xl object-contain shadow-lg ring-1 ring-white/10"
      />
      <div className="relative text-center">
        <h1 className="text-3xl font-bold tracking-tight text-sidebar-foreground">Washinn</h1>
        <p className="mt-1 text-sm text-sidebar-muted">Gestión de mantenimiento técnico</p>
      </div>
      <div className="absolute bottom-10 text-xs text-sidebar-muted">
        v0.1.0 · Sumar Digital
      </div>
    </div>
  );
}
