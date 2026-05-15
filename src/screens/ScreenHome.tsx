import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  AlertTriangle,
  Wind,
  ListChecks,
  ClipboardList,
  Wrench,
  Settings,
  Mail,
  BarChart3,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useSession } from "@/stores/sessionStore";
import { getVisibleModules } from "@/lib/permissions";
import { api } from "@/data/api";
import { todayDdMmYyyy } from "@/lib/format";

const ICONS: Record<string, React.ElementType> = {
  "Registro de visita": ClipboardList,
  "Detalle Maquina": Wrench,
  Incidentes: AlertTriangle,
  Ventilaciones: Wind,
  Edificios: Building2,
  Métricas: BarChart3,
  ABM: Settings,
  Mails: Mail,
  Checklist: ListChecks,
};

export default function ScreenHome() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const modules = getVisibleModules(user?.Rol).filter((m) => m.Modulo_LPM !== "Checklist");

  const { data: registros = [] } = useQuery({
    queryKey: ["registros"],
    queryFn: () => api.listRegistros(),
  });

  const today = todayDdMmYyyy();
  const myName = user?.Concat_Nombre_Apellido;
  const myRegistros = registros
    .filter((r) =>
      user?.Rol === "Tecnico"
        ? r.Nombre === myName && (r.Fecha === today || r.Estado === "Pendiente")
        : r.Fecha === today || r.Estado === "Pendiente",
    )
    .slice(0, 8);

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        title="Inicio"
        back={false}
        action={<HamburgerMenu />}
      />

      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <Card className="md:hidden">
          <CardContent className="flex items-center gap-3 py-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.Nombre?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Bienvenido,</p>
              <p className="font-semibold">{user?.Concat_Nombre_Apellido}</p>
            </div>
            <Badge variant="secondary">{user?.Rol}</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Módulos</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {modules.map((m) => {
              const Icon = ICONS[m.Modulo_LPM] ?? ListChecks;
              return (
                <Link
                  key={m.ID}
                  to={m.ruta}
                  className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium leading-tight">{m.Modulo_LPM}</div>
                </Link>
              );
            })}
          </div>
        </section>

        <Separator />

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Registros del día</h2>
            <span className="text-xs text-muted-foreground">{today}</span>
          </div>
          {myRegistros.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No hay registros para hoy.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {myRegistros.map((r) => (
                <Card key={r.ID}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{r.Edificio}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.Nombre} · Visita {r.HoraVisita || "—"}
                      </p>
                    </div>
                    <StatusBadge status={r.Estado} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
