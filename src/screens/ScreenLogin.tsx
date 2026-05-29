import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, LogIn, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/stores/sessionStore";
import { authenticate } from "@/lib/auth";

type LoginError = {
  title: string;
  description: string;
  tone: "warning" | "danger";
};

export default function ScreenLogin() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  function reset() {
    setUsuario("");
    setPassword("");
    setShow(false);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      setError({
        title: "Faltan campos",
        description: "Ingresá tu usuario y contraseña para continuar.",
        tone: "warning",
      });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const u = authenticate(usuario, password);
      setLoading(false);
      if (!u) {
        setError({
          title: "Credenciales incorrectas",
          description:
            "El usuario o la contraseña no son correctos. Verificá los datos e intentá nuevamente.",
          tone: "danger",
        });
        return;
      }
      setUser(u);
      toast.success(`Bienvenido, ${u.Nombre}`);
      navigate("/home", { replace: true });
    }, 400);
  }

  const isDanger = error?.tone === "danger";

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-background to-blue-100/60 px-5 py-8 dark:from-slate-950 dark:via-background dark:to-blue-950/40">
      {/* Capas decorativas difuminadas */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-400/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_55%)]"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Logo + título */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/30 to-sky-400/20 blur-xl"
            />
            <img
              src="/Logoapp.png"
              alt="Washinn"
              className="relative h-24 w-24 rounded-2xl object-contain shadow-xl"
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Washinn</h1>
            <p className="mt-1 text-sm text-muted-foreground">Iniciá sesión para continuar</p>
          </div>
        </div>

        {/* Card del formulario */}
        <div className="w-full rounded-2xl border bg-card/80 p-5 shadow-xl ring-1 ring-black/5 backdrop-blur-sm md:p-6">
          <form className="space-y-4" onSubmit={onLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="usuario" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Usuario
              </Label>
              <Input
                id="usuario"
                autoCapitalize="none"
                autoComplete="username"
                placeholder="Tu usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-accent"
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="h-11 flex-1 bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30"
                disabled={loading}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? "Verificando..." : "Acceder"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 shrink-0 p-0"
                onClick={reset}
                disabled={loading}
                aria-label="Limpiar campos"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">v0.1.0 · Sumar Digital</p>
      </div>

      {/* Popup de warning / error de login */}
      <AlertDialog open={!!error} onOpenChange={(o) => !o && setError(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div
              className={
                isDanger
                  ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0"
                  : "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 sm:mx-0"
              }
            >
              {isDanger ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <AlertDialogTitle className="text-center sm:text-left">{error?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center sm:text-left">
              {error?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={
                isDanger
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
