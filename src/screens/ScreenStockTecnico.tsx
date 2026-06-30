import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, X } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { getStockTecnico, type StockTecnico } from "@/lib/api-client";

export default function ScreenStockTecnico() {
  const [q, setQ] = useState("");

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["stock-tecnico"],
    queryFn: getStockTecnico,
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return stock;
    return stock.filter(
      (s) =>
        s.Repuesto.toLowerCase().includes(t) ||
        s.Codigo.toLowerCase().includes(t),
    );
  }, [stock, q]);

  const subtitle = `${filtered.length} ${filtered.length === 1 ? "repuesto" : "repuestos"}`;

  const searchInput = (
    <div className="relative w-full">
      <SearchBar
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar repuesto o código..."
        className="h-11 pr-9"
      />
      {q ? (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-accent"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Stock Técnico"
        subtitle={subtitle}
      />
      <ModuleHeader title="Stock Técnico" subtitle={subtitle}>
        <div className="w-72 lg:w-80">{searchInput}</div>
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
        {/* Buscador mobile (en desktop está en el ModuleHeader). */}
        <div className="md:hidden">{searchInput}</div>

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={
              q
                ? "Sin resultados"
                : "No tenés stock cargado"
            }
            description={
              q
                ? "Probá con otro nombre o código."
                : "El stock técnico aparecerá acá cuando esté disponible."
            }
          />
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <>
            {/* Mobile: cards apiladas (una por repuesto). */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filtered.map((s) => (
                <StockCard key={s.ID} s={s} />
              ))}
            </div>

            {/* Desktop/tablet: DataTable estándar. */}
            <DataTable
              className="hidden md:block"
              data={filtered}
              getRowKey={(s) => s.ID}
              initialSort={{ key: "repuesto" }}
              columns={[
                {
                  key: "repuesto",
                  header: "Repuesto",
                  primary: true,
                  sortable: true,
                  sortAccessor: (s) => s.Repuesto,
                  cell: (s) => (
                    <CellTitleSubtitle
                      icon={Package}
                      title={s.Repuesto}
                      subtitle={s.Codigo}
                    />
                  ),
                },
                {
                  key: "cantidad",
                  header: "Cantidad",
                  sortable: true,
                  sortAccessor: (s) => s.Cantidad,
                  align: "right",
                  cell: (s) => (
                    <Pill tone="neutral">{s.Cantidad}</Pill>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function StockCard({ s }: { s: StockTecnico }) {
  return (
    <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-semibold leading-tight text-primary">
            {s.Repuesto}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {s.Codigo}
          </p>
        </div>
        <Pill tone="neutral">{s.Cantidad}</Pill>
      </CardContent>
    </Card>
  );
}
