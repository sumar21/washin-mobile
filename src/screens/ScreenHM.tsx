import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";

export default function ScreenHM() {
  const { id } = useParams();
  const decoded = id ? decodeURIComponent(id) : undefined;
  const { data = [], isLoading } = useQuery({
    queryKey: ["historial-maquina", decoded],
    queryFn: () => api.listHistorialMaquina(decoded),
  });

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Historial Máquina" subtitle={decoded} />
      <div className="space-y-2 p-4">
        {isLoading ? <InlineLoader /> : null}
        {!isLoading && data.length === 0 ? <EmptyState icon={History} title="Sin historial" /> : null}
        {data.map((h) => (
          <Card key={h.ID}>
            <CardContent className="space-y-1 pt-4">
              <p className="text-sm font-medium">{h.Evento}</p>
              <p className="text-xs text-muted-foreground">
                {h.Fecha} · {h.Tecnico}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
