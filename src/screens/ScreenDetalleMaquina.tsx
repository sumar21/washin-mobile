import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  Filter,
  Power,
  RefreshCw,
  Smartphone,
  Coins,
  Wrench,
  X,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { api } from "@/data/api";
import type { DetalleMaquina, ModoEncendido } from "@/data/types";

const ALL = "__all__";

export default function ScreenDetalleMaquina() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: maquinas = [], isLoading, isFetching } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => api.listDetalleMaquina(),
  });

  const [q, setQ] = useState("");
  const [edificio, setEdificio] = useState(ALL);
  const [marca, setMarca] = useState(ALL);
  const [modelo, setModelo] = useState(ALL);
  const [encendido, setEncendido] = useState(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);

  const edificios = useMemo(
    () => Array.from(new Set(maquinas.map((m) => m.Edificio_DM))).sort(),
    [maquinas],
  );
  const marcas = useMemo(
    () => Array.from(new Set(maquinas.map((m) => m.Marca_DM))).sort(),
    [maquinas],
  );
  const modelos = useMemo(
    () =>
      Array.from(
        new Set(
          maquinas
            .filter((m) => marca === ALL || m.Marca_DM === marca)
            .map((m) => m.Modelo_DM),
        ),
      ).sort(),
    [maquinas, marca],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return maquinas.filter(
      (m) =>
        (edificio === ALL || m.Edificio_DM === edificio) &&
        (marca === ALL || m.Marca_DM === marca) &&
        (modelo === ALL || m.Modelo_DM === modelo) &&
        (encendido === ALL || m.Encendido_DM === encendido) &&
        (!t ||
          m.NroSerie_DM.toLowerCase().includes(t) ||
          String(m.IDExterno_DM).includes(t) ||
          m.ConcatMaquina_DM.toLowerCase().includes(t)),
    );
  }, [maquinas, edificio, marca, modelo, encendido, q]);

  const activeFilterCount =
    (edificio !== ALL ? 1 : 0) +
    (marca !== ALL ? 1 : 0) +
    (modelo !== ALL ? 1 : 0) +
    (encendido !== ALL ? 1 : 0);

  function clearAll() {
    setEdificio(ALL);
    setMarca(ALL);
    setModelo(ALL);
    setEncendido(ALL);
    setQ("");
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["detalle-maquina"] });
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        title="Detalle Máquina"
        subtitle={`${filtered.length} máquina${filtered.length === 1 ? "" : "s"}`}
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isFetching}
            aria-label="Refrescar"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 md:p-6">
        {/* Buscador + botón filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchBar
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por N° serie, ID o modelo..."
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
          <Button
            variant="outline"
            onClick={() => setSheetOpen(true)}
            className="h-11 shrink-0 gap-2"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 ? (
              <Badge variant="default" className="h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>

        {/* Chip del edificio seleccionado */}
        {edificio !== ALL ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card p-2.5 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio
              </p>
              <p className="truncate text-sm font-semibold leading-tight">{edificio}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEdificio(ALL)}
              aria-label="Quitar edificio"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {isLoading ? <InlineLoader /> : null}

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin máquinas"
            description={
              activeFilterCount > 0 || q
                ? "No hay máquinas que coincidan con los filtros aplicados."
                : "Todavía no hay máquinas cargadas."
            }
            action={
              activeFilterCount > 0 || q ? (
                <Button variant="outline" onClick={clearAll}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {filtered.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MaquinaCard
                key={m.ID}
                maquina={m}
                onView={() =>
                  navigate(`/maquinas/${encodeURIComponent(m.IDMaquina_DM)}/historial`)
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Sheet de filtros */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b px-5 pb-3 pt-5 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" />
              Filtrar máquinas
            </SheetTitle>
            <SheetDescription className="text-xs">
              Filtrá por edificio, marca, modelo o modo de encendido.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-5 py-4">
            <FilterField label="Edificio">
              <Select value={edificio} onValueChange={setEdificio}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar edificio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {edificios.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <div className="grid grid-cols-2 gap-3">
              <FilterField label="Marca">
                <Select
                  value={marca}
                  onValueChange={(v) => {
                    setMarca(v);
                    setModelo(ALL);
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Todas" />
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
              </FilterField>
              <FilterField label="Modelo">
                <Select value={modelo} onValueChange={setModelo}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Todos" />
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
              </FilterField>
            </div>

            <FilterField label="Modo de encendido">
              <Select value={encendido} onValueChange={setEncendido}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value="App">App</SelectItem>
                  <SelectItem value="Fichas">Fichas</SelectItem>
                  <SelectItem value="App / Fichas">App / Fichas</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          <SheetFooter className="border-t bg-muted/30 px-5 py-3">
            <Button
              variant="outline"
              onClick={clearAll}
              className="h-11 flex-1 sm:flex-none"
            >
              Limpiar
            </Button>
            <SheetClose asChild>
              <Button className="h-11 flex-1 bg-gradient-to-br from-primary to-blue-700">
                Aplicar
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function MaquinaCard({
  maquina,
  onView,
}: {
  maquina: DetalleMaquina;
  onView: () => void;
}) {
  return (
    <Card className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex items-stretch gap-3 p-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
          <Wrench className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-semibold leading-tight text-primary">
            {maquina.ConcatMaquina_DM}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Chip label="N° Serie" value={maquina.NroSerie_DM} mono />
            <Chip label="ID" value={String(maquina.IDExterno_DM)} mono />
          </div>
          <EncendidoBadge modo={maquina.Encendido_DM} />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onView}
          aria-label="Ver historial"
          className="my-auto h-9 w-9 shrink-0 transition-colors group-hover:border-primary group-hover:text-primary"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Chip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "font-mono text-[11px] text-foreground/90" : "text-[11px]"}>
        {value}
      </span>
    </span>
  );
}

function EncendidoBadge({ modo }: { modo: ModoEncendido }) {
  if (modo === "App") {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <Smartphone className="h-3 w-3" />
        App
      </span>
    );
  }
  if (modo === "Fichas") {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <Coins className="h-3 w-3" />
        Fichas
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
      <Power className="h-3 w-3" />
      App / Fichas
    </span>
  );
}
