import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ListChecks, Calendar } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GpsButton } from "@/components/shared/GpsButton";
import { QrScannerButton } from "@/components/shared/QrScannerButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";
import { toast } from "sonner";

export default function ScreenPlanificaciones() {
  const navigate = useNavigate();
  const { user } = useSession();

  const { data: resumenes = [], isLoading } = useQuery({
    queryKey: ["planificaciones-resumen"],
    queryFn: () => api.listPlanificacionesResumen(),
  });
  const { data: detalles = [] } = useQuery({
    queryKey: ["planificaciones-detalle"],
    queryFn: () => api.listPlanificacionesDetalle(),
  });

  const myName = user?.Concat_Nombre_Apellido;
  const myResumenes = resumenes.filter((r) => (user?.Rol === "Tecnico" ? r.Tecnico_RP === myName : true));

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Planificaciones" subtitle="Circuitos del mes" back={false} action={<HamburgerMenu />} />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          <QrScannerButton
            label="Escanear QR"
            variant="outline"
            onScan={(code) => {
              toast.success("Código escaneado", { description: code });
              navigate("/checklist");
            }}
          />
          <GpsButton
            label="Detectar edificio"
            onLocation={(c) =>
              toast.info("Ubicación detectada", {
                description: `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`,
              })
            }
          />
        </div>

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && myResumenes.length === 0 ? (
          <EmptyState icon={Calendar} title="Sin Ruta" description="No hay circuitos asignados este mes." />
        ) : null}

        {myResumenes.map((r) => {
          const items = detalles.filter(
            (d) => d.NroCircuito_DP === r.NroCircuito_RP && d.Mes_DP === r.Mes_RP && d.Año_DP === r.Año_RP,
          );
          return (
            <Card key={r.ID}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Ruta Nº {r.NroCircuito_RP}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.Mes_RP} {r.Año_RP} · {r.Tecnico_RP}
                    </p>
                  </div>
                  <StatusBadge status={r.Estado_RP} />
                </div>
                <div className="space-y-1.5 pt-1">
                  {items.map((d) => (
                    <div
                      key={d.ID}
                      className="flex items-center gap-2 rounded-md border bg-card p-2 hover:border-primary"
                    >
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.Edificio_DP}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{d.Direccion_DP}</p>
                      </div>
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {d.Codigo_DP}
                      </Badge>
                      <StatusBadge status={d.Estado_DP} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/edificios")}>
                    Ver edificios <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
