import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wrench, History } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/SearchBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";

const ALL = "__all__";

export default function ScreenDetalleMaquina() {
  const navigate = useNavigate();
  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => api.listDetalleMaquina(),
  });

  const [q, setQ] = useState("");
  const [marca, setMarca] = useState(ALL);
  const [enc, setEnc] = useState(ALL);
  const [modelo, setModelo] = useState(ALL);

  const marcas = useMemo(() => Array.from(new Set(maquinas.map((m) => m.Marca_DM))).sort(), [maquinas]);
  const modelos = useMemo(() => Array.from(new Set(maquinas.map((m) => m.Modelo_DM))).sort(), [maquinas]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return maquinas.filter(
      (m) =>
        (!t || m.ConcatMaquina_DM.toLowerCase().includes(t) || m.Marca_DM.toLowerCase().includes(t)) &&
        (marca === ALL || m.Marca_DM === marca) &&
        (modelo === ALL || m.Modelo_DM === modelo) &&
        (enc === ALL || m.Encendido_DM === enc),
    );
  }, [maquinas, q, marca, modelo, enc]);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Detalle Máquina" subtitle="Listado y filtros" />

      <div className="space-y-3 p-4">
        <SearchBar value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar máquina o marca..." />

        <div className="grid grid-cols-3 gap-2">
          <Select value={marca} onValueChange={setMarca}>
            <SelectTrigger>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {marcas.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modelo} onValueChange={setModelo}>
            <SelectTrigger>
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {modelos.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={enc} onValueChange={setEnc}>
            <SelectTrigger>
              <SelectValue placeholder="Encendido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="SI">Sí</SelectItem>
              <SelectItem value="NO">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="Sin máquinas" />
        ) : null}

        <div className="space-y-2">
          {filtered.map((m) => (
            <Card key={m.ID}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.ConcatMaquina_DM}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.Marca_DM} · {m.Modelo_DM}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{m.Edificio_DM}</p>
                  </div>
                  <Badge variant={m.Encendido_DM === "SI" ? "success" : "secondary"}>
                    {m.Encendido_DM === "SI" ? "Encendida" : "Apagada"}
                  </Badge>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/maquinas/${encodeURIComponent(m.IDMaquina_DM)}/historial`)}
                  >
                    <History className="mr-1 h-4 w-4" /> Ver historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
