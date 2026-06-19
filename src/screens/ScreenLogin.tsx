import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, EyeOff, LogIn, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { loginRequest } from "@/lib/api-auth";
import {
  getHome,
  getCircuitos,
  getVisitaEnCurso,
  getIncidentes,
  getVentilaciones,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Usuario } from "@/data/types";

type LoginError = {
  title: string;
  description: string;
  tone: "warning" | "danger";
};

export default function ScreenLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  const setToken = useSession((s) => s.setToken);
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
    const result = await loginRequest(usuario, password);
    setLoading(false);
    if (!result.ok) {
      setError({
        title: "No se pudo iniciar sesión",
        description: result.error,
        tone: "danger",
      });
      return;
    }
    // El backend no devuelve Password; el store tipa Usuario (Password no se usa en el front).
    setUser({ ...result.user, Password: "" } as Usuario);
    setToken(result.token);
    // Prefetch (fire-and-forget) para que Home y los módulos ya tengan datos al entrar.
    // El token ya está en el store, así que authFetch lo usa. allSettled: si alguno falla, no rompe.
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["home"], queryFn: getHome }),
      queryClient.prefetchQuery({ queryKey: ["circuitos"], queryFn: getCircuitos }),
      queryClient.prefetchQuery({
        queryKey: ["visita-en-curso"],
        queryFn: getVisitaEnCurso,
      }),
      queryClient.prefetchQuery({
        queryKey: ["incidentes", "abiertos"],
        queryFn: () => getIncidentes("NO"),
      }),
      queryClient.prefetchQuery({
        queryKey: ["ventilaciones"],
        queryFn: getVentilaciones,
      }),
    ]);
    toast.success(`Bienvenido, ${result.user.Nombre}`);
    navigate("/home", { replace: true });
  }

  const isDanger = error?.tone === "danger";

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      {/* Panel de marca — solo desktop (lg+). Navy profundo coherente con el sidebar. */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-sidebar-accent/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 size-80 rounded-full bg-sidebar-accent/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--sidebar-accent)/0.18),transparent_55%)]"
        />
        {/* Grid sutil futurista */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(hsl(var(--sidebar-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--sidebar-foreground))_1px,transparent_1px)] [background-size:48px_48px]"
        />

        <div className="relative flex items-center gap-3">
          <img
            src="/Logoapp.png"
            alt="Washinn"
            className="size-11 rounded-xl object-contain ring-1 ring-white/10"
          />
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            Washinn
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-sidebar-foreground xl:text-4xl">
            Gestión de mantenimiento técnico
          </h2>
          <p className="mt-4 text-base leading-relaxed text-sidebar-muted">
            Visitas, incidentes, ventilaciones y máquinas — todo en un solo lugar.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-muted">v0.1.0 · Sumar Digital</p>
      </aside>

      {/* Panel del formulario */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-background to-blue-100/60 px-5 py-8 lg:bg-none lg:bg-background dark:from-slate-950 dark:via-background dark:to-blue-950/40">
        {/* Capas decorativas (solo cuando no se muestra el panel de marca) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-blue-400/20 blur-3xl lg:hidden dark:bg-blue-500/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-10 size-80 rounded-full bg-sky-300/25 blur-3xl lg:hidden dark:bg-sky-400/10"
        />

        <div className="relative w-full max-w-md">
          <Card className="rounded-2xl border-border/60 shadow-md">
            <CardHeader className="items-center gap-3 space-y-0 px-6 pb-5 pt-7 text-center sm:px-8 sm:pt-8">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-3 rounded-3xl bg-primary/20 blur-xl"
                />
                <img
                  src="/Logoapp.png"
                  alt="Washinn"
                  className="relative size-20 rounded-2xl object-contain shadow-md ring-1 ring-border/40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <CardTitle className="text-2xl sm:text-3xl">Washinn</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Iniciá sesión para continuar
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-7 sm:px-8">
              <form onSubmit={onLogin}>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel
                      htmlFor="usuario"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Usuario
                    </FieldLabel>
                    <Input
                      id="usuario"
                      autoCapitalize="none"
                      autoComplete="username"
                      placeholder="Tu usuario"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      disabled={loading}
                      className="h-12 text-base"
                    />
                  </Field>
                  <Field>
                    <FieldLabel
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Contraseña
                    </FieldLabel>
                    <InputGroup className="h-12">
                      <InputGroupInput
                        id="password"
                        type={show ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="text-base"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="icon-xs"
                          onClick={() => setShow((v) => !v)}
                          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {show ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="submit"
                      className="h-12 flex-1 text-base"
                      disabled={loading}
                    >
                      <LogIn />
                      {loading ? "Verificando..." : "Acceder"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-12 shrink-0 p-0"
                      onClick={reset}
                      disabled={loading}
                      aria-label="Limpiar campos"
                    >
                      <RotateCcw />
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground lg:hidden">
            v0.1.0 · Sumar Digital
          </p>
        </div>
      </div>

      {/* Popup de warning / error de login */}
      <AlertDialog open={!!error} onOpenChange={(o) => !o && setError(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div
              className={cn(
                "mx-auto flex size-12 items-center justify-center rounded-full sm:mx-0",
                isDanger ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
              )}
            >
              {isDanger ? <ShieldAlert className="size-6" /> : <AlertTriangle className="size-6" />}
            </div>
            <AlertDialogTitle className="text-center sm:text-left">{error?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center sm:text-left">
              {error?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={cn(
                isDanger && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
