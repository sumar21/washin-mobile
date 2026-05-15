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
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary to-primary/70 p-8 text-primary-foreground">
      <img
        src="/logo-washinn.jpg"
        alt="Washinn"
        className="h-32 w-32 rounded-3xl object-cover shadow-2xl"
      />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Washinn</h1>
        <p className="mt-1 text-sm opacity-90">Gestión de mantenimiento técnico</p>
      </div>
      <div className="absolute bottom-10 text-xs opacity-70">v0.1.0 · Sumar Digital</div>
    </div>
  );
}
