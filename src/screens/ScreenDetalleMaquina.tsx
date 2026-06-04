import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
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
import { SearchBar } from "@/components/shared/SearchBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  getDetalleMaquina,
  getEdificios,
  getMarcasModelos,
  type DetalleMaquina,
  type MaquinaFiltro,
} from "@/lib/api-client";

const ALL = "__all__";

export default function ScreenDetalleMaquina() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Catálogos para los selects del popup (como CollectEdificios / CollectMarcaModelo).
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: marcasModelos = [] } = useQuery({
    queryKey: ["marcas-modelos"],
    queryFn: getMarcasModelos,
  });

  // El filtro vive en la URL: persiste al ir al historial y volver (botón atrás) y se
  // resetea solo al re-entrar al módulo desde el Home (URL limpia). "aplicado" marca que
  // se confirmó el popup (aunque sea sin criterios = todas las máquinas).
  const aplicado = searchParams.has("aplicado");
  const filtro: MaquinaFiltro | null = aplicado
    ? {
        edificio: searchParams.get("edificio") || undefined,
        modelo: searchParams.get("modelo") || undefined,
        marca: searchParams.get("marca") || undefined,
      }
    : null;
  const [pickerOpen, setPickerOpen] = useState(!aplicado);
  // Borrador del popup (cada campo opcional), inicializado desde la URL.
  const [dEdificio, setDEdificio] = useState(
    searchParams.get("edificio") || ALL,
  );
  const [dModelo, setDModelo] = useState(searchParams.get("modelo") || ALL);
  const [dMarca, setDMarca] = useState(searchParams.get("marca") || ALL);
  const [q, setQ] = useState("");

  const {
    data: maquinas = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["detalle-maquina", filtro],
    queryFn: () => getDetalleMaquina(filtro ?? {}),
    enabled: filtro !== null,
  });

  const edificioNames = useMemo(
    () =>
      Array.from(
        new Set(edificios.map((e) => e.Edificio).filter(Boolean)),
      ).sort(),
    [edificios],
  );
  const marcas = useMemo(
    () =>
      Array.from(
        new Set(marcasModelos.map((m) => m.Marca).filter(Boolean)),
      ).sort(),
    [marcasModelos],
  );
  const modelos = useMemo(
    () =>
      Array.from(
        new Set(marcasModelos.map((m) => m.Modelo).filter(Boolean)),
      ).sort(),
    [marcasModelos],
  );

  // Búsqueda de texto sobre los resultados ya filtrados por el server.
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return maquinas;
    return maquinas.filter(
      (m) =>
        m.NroSerie_DM.toLowerCase().includes(t) ||
        String(m.IDExterno_DM).includes(t) ||
        m.ConcatMaquina_DM.toLowerCase().includes(t),
    );
  }, [maquinas, q]);

  function aplicar() {
    const next = new URLSearchParams();
    next.set("aplicado", "1");
    if (dEdificio !== ALL) next.set("edificio", dEdificio);
    if (dModelo !== ALL) next.set("modelo", dModelo);
    if (dMarca !== ALL) next.set("marca", dMarca);
    setSearchParams(next, { replace: true });
    setPickerOpen(false);
  }

  // Abre el popup sincronizando el borrador con el filtro actual.
  function openPicker() {
    setDEdificio(filtro?.edificio ?? ALL);
    setDModelo(filtro?.modelo ?? ALL);
    setDMarca(filtro?.marca ?? ALL);
    setPickerOpen(true);
  }

  // Chips del filtro activo.
  const activeChips: { label: string; value: string }[] = [];
  if (filtro?.edificio)
    activeChips.push({ label: "Edificio", value: filtro.edificio });
  if (filtro?.modelo)
    activeChips.push({ label: "Modelo", value: filtro.modelo });
  if (filtro?.marca) activeChips.push({ label: "Marca", value: filtro.marca });

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        title="Detalle Máquina"
        subtitle={
          filtro
            ? `${filtered.length} máquina${filtered.length === 1 ? "" : "s"}`
            : "Elegí un filtro para empezar"
        }
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openPicker}
              aria-label="Filtrar"
            >
              <Filter className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={!filtro || isFetching}
              aria-label="Refrescar"
            >
              <RefreshCw
                className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 md:p-6">
        {/* Buscador (sobre los resultados) */}
        <div className="relative">
          <SearchBar
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por N° serie, ID o modelo..."
            className="h-11 pr-9"
            disabled={!filtro}
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

        {/* Chips del filtro activo + cambiar */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs shadow-sm"
              >
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </span>
                <span className="font-medium">{c.value}</span>
              </span>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={openPicker}
              className="h-7 px-2 text-xs text-primary"
            >
              Cambiar filtro
            </Button>
          </div>
        ) : null}

        {/* Estados */}
        {filtro === null ? (
          <EmptyState
            icon={Filter}
            title="Seleccioná un filtro"
            description="Elegí edificio, modelo o marca para ver las máquinas."
            action={<Button onClick={openPicker}>Seleccionar</Button>}
          />
        ) : isLoading ? (
          <InlineLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin máquinas"
            description="No hay máquinas que coincidan con el filtro."
            action={
              <Button variant="outline" onClick={openPicker}>
                Cambiar filtro
              </Button>
            }
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MaquinaCard
                key={m.ID}
                maquina={m}
                onView={() =>
                  navigate(
                    `/maquinas/${encodeURIComponent(m.IDMaquina_DM)}/historial`,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Popup de filtro (Edificio / Modelo / Marca — cada uno opcional, AND) */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-primary">
              Seleccionar
            </DialogTitle>
          </div>
          <div className="space-y-3 pt-1">
            <FilterField label="Edificio">
              <Select value={dEdificio} onValueChange={setDEdificio}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar un edificio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {edificioNames.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Modelo">
              <Select value={dModelo} onValueChange={setDModelo}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar modelo" />
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
            <FilterField label="Marca">
              <Select value={dMarca} onValueChange={setDMarca}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar marca" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={aplicar}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[13px] font-semibold text-foreground/90">
        {label}
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

function Chip({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          mono ? "font-mono text-[11px] text-foreground/90" : "text-[11px]"
        }
      >
        {value}
      </span>
    </span>
  );
}

function EncendidoBadge({ modo }: { modo: string }) {
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
  if (!modo) return null;
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
      <Power className="h-3 w-3" />
      {modo}
    </span>
  );
}
