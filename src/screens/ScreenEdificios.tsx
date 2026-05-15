import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPin, Plus, Building2 } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { api } from "@/data/api";

export default function ScreenEdificios() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [q, setQ] = useState("");

  const { data: edificios = [], isLoading } = useQuery({
    queryKey: ["edificios"],
    queryFn: () => api.listEdificios(),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return edificios
      .filter((e) => e.Status === "ALTA")
      .filter(
        (e) =>
          !term ||
          e.Edificio.toLowerCase().includes(term) ||
          e.Direccion.toLowerCase().includes(term) ||
          e.Codigo.toLowerCase().includes(term),
      );
  }, [edificios, q]);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        title="Edificios"
        action={
          user?.Rol === "Admin" ? (
            <Button variant="ghost" size="icon" onClick={() => navigate("/edificios/nuevo")}>
              <Plus className="h-5 w-5" />
            </Button>
          ) : null
        }
      />
      <div className="space-y-3 p-4">
        <SearchBar
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, dirección o código..."
        />

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Sin edificios"
            description="No hay edificios que coincidan con la búsqueda."
          />
        ) : null}

        <div className="space-y-2">
          {filtered.map((e) => (
            <Card key={e.ID} className="cursor-pointer hover:border-primary">
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.Edificio}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.Direccion}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline">{e.Codigo}</Badge>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {e.Latitud.toFixed(3)}, {e.Longitud.toFixed(3)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
