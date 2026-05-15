import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Download, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";

export default function ScreenMetricas() {
  const [tab, setTab] = useState<"problemas" | "general">("problemas");
  const [q, setQ] = useState("");

  const { data: detalles = [], isLoading: lD } = useQuery({
    queryKey: ["detalles"],
    queryFn: () => api.listDetalles(),
  });
  const { data: registros = [], isLoading: lR } = useQuery({
    queryKey: ["registros"],
    queryFn: () => api.listRegistros(),
  });

  const filteredProblemas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return detalles.filter(
      (d) => !t || d.Item.toLowerCase().includes(t) || d.Edificio.toLowerCase().includes(t),
    );
  }, [detalles, q]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registros) map.set(r.Estado, (map.get(r.Estado) ?? 0) + 1);
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [registros]);

  function exportar() {
    const rows = [["Edificio", "Item", "Observaciones", "Técnico", "Fecha"]];
    for (const d of filteredProblemas) rows.push([d.Edificio, d.Item, d.Observaciones, d.Tecnico, d.Fecha]);
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado a CSV");
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Métricas" subtitle="Reportes" back={false} action={<HamburgerMenu />} />

      <div className="space-y-3 p-4">
        <Card>
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-medium">Registros por estado</p>
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--accent))" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="problemas">Reporte de Problemas</TabsTrigger>
            <TabsTrigger value="general">Reporte General</TabsTrigger>
          </TabsList>

          <SearchBar
            containerClassName="mt-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ítem o edificio..."
          />

          <TabsContent value="problemas" className="space-y-2">
            <div className="flex items-center justify-between px-1 py-1">
              <Badge variant="outline">Total: {filteredProblemas.length}</Badge>
              <Button size="sm" variant="outline" onClick={exportar}>
                <Download className="mr-1 h-4 w-4" /> Exportar CSV
              </Button>
            </div>
            {lD ? <InlineLoader /> : null}
            {!lD && filteredProblemas.length === 0 ? <EmptyState icon={BarChart3} title="Sin problemas reportados" /> : null}
            {filteredProblemas.map((d) => (
              <Card key={d.ID}>
                <CardContent className="space-y-1 pt-4">
                  <p className="text-sm font-medium">{d.Item}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.Edificio} · {d.Tecnico} · {d.Fecha}
                  </p>
                  <p className="rounded-md bg-muted px-2 py-1.5 text-xs italic">“{d.Observaciones}”</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="general" className="space-y-2">
            {lR ? <InlineLoader /> : null}
            {!lR && registros.length === 0 ? <EmptyState icon={BarChart3} title="Sin registros" /> : null}
            {registros.map((r) => (
              <Card key={r.ID}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.Edificio}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.Nombre} · {r.Fecha}
                    </p>
                  </div>
                  <Badge variant="outline">{r.Estado}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
