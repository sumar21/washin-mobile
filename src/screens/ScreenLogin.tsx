import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/stores/sessionStore";
import { authenticate } from "@/lib/auth";

export default function ScreenLogin() {
  const navigate = useNavigate();
  const setUser = useSession((s) => s.setUser);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setUsuario("");
    setPassword("");
    setShow(false);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      toast.error("Faltan campos", { description: "Ingresá usuario y contraseña" });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const u = authenticate(usuario, password);
      setLoading(false);
      if (!u) {
        toast.error("Credenciales incorrectas");
        return;
      }
      setUser(u);
      toast.success(`Bienvenido, ${u.Nombre}`);
      navigate("/home", { replace: true });
    }, 400);
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-primary/10 to-background">
      <div className="flex flex-col items-center gap-3 px-6 py-10">
        <img src="/logo-washinn.jpg" alt="Washinn" className="h-24 w-24 rounded-2xl object-cover shadow-lg" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Washinn</h1>
          <p className="text-sm text-muted-foreground">Iniciá sesión para continuar</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6">
        <Card>
          <CardContent className="pt-5">
            <form className="space-y-4" onSubmit={onLogin}>
              <div className="space-y-1.5">
                <Label htmlFor="usuario">Usuario</Label>
                <Input
                  id="usuario"
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="Usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    placeholder="Contraseña"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-11"
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
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={loading} size="lg">
                  <LogIn className="mr-2 h-4 w-4" />
                  Acceder
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={reset} disabled={loading}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium">Usuarios de prueba (mock):</p>
          <ul className="space-y-0.5">
            <li>• <span className="font-mono">admin / admin</span> — Admin (todos los módulos)</li>
            <li>• <span className="font-mono">super / 1234</span> — Supervisor</li>
            <li>• <span className="font-mono">tecnico1 / 1234</span> — Técnico</li>
          </ul>
        </div>

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">v0.1.0 · Sumar Digital</p>
      </div>
    </div>
  );
}
