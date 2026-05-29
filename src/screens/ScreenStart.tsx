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
    <div className="relative flex h-full flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-b from-sky-50 via-background to-blue-100/50 p-8 dark:from-slate-950 dark:via-background dark:to-blue-950/40">
      {/* Glow decorativo detrás del logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <img
        src="/Logoapp.png"
        alt="Washinn"
        className="relative h-32 w-32 rounded-3xl object-contain shadow-2xl shadow-primary/20"
      />
      <div className="relative text-center">
        <h1 className="text-3xl font-bold tracking-tight">Washinn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestión de mantenimiento técnico</p>
      </div>
      <div className="absolute bottom-10 text-xs text-muted-foreground">
        v0.1.0 · Sumar Digital
      </div>
    </div>
  );
}
