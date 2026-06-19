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
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/shared/SearchBar";
import { MaquinaFilterButton } from "@/components/shared/MaquinaFilterButton";
import { type MaquinaFiltersValue } from "@/components/shared/MaquinaFilters";
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
const EMPTY: MaquinaFiltersValue = { edificio: ALL, modelo: ALL, marca: ALL };

// Título de la fila replicando txt_marca-serie de PowerApps (Screen_DetalleMaquina.pa.yaml):
//   If(IsBlank(Modelo_DM) And IsBlank(Marca_DM), Upper(Segmento_DM) & "〡 " & NroSerie_DM,
//      Upper(Marca_DM & "〡" & Modelo_DM))
// Cuando la máquina no tiene marca ni modelo (ConcatMaquina vacío), se arma con Segmento + N° de serie
// en vez de dejar la fila sin etiqueta legible.
function tituloMaquina(m: DetalleMaquina): string {
  const marca = (m.Marca_DM ?? "").trim();
  const modelo = (m.Modelo_DM ?? "").trim();
  if (!marca && !modelo) {
    return `${m.Segmento_DM.toUpperCase()}〡 ${m.NroSerie_DM}`.trim();
  }
  // PA usa ConcatMaquina_DM en el resto de la app, pero el título de la galería es Upper(Marca〡Modelo).
  // Preferimos ConcatMaquina_DM si trae contenido; si no, reconstruimos como hace PA.
  const concat = (m.ConcatMaquina_DM ?? "").trim();
  if (concat) return concat;
  return `${marca}〡${modelo}`.toUpperCase();
}

export default function ScreenDetalleMaquina() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Catálogos para los filtros (como CollectEdificios / CollectMarcaModelo de PowerApps).
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: marcasModelos = [] } = useQuery({
    queryKey: ["marcas-modelos"],
    queryFn: getMarcasModelos,
  });

  // El filtro vive en la URL: persiste al ir al historial y volver, y se resetea solo al
  // re-entrar al módulo desde el Home (URL limpia). "aplicado" marca que ya se filtró
  // (aunque sea sin criterios = todas las máquinas).
  const aplicado = searchParams.has("aplicado");
  const filtro: MaquinaFiltro | null = aplicado
    ? {
        edificio: searchParams.get("edificio") || undefined,
        modelo: searchParams.get("modelo") || undefined,
        marca: searchParams.get("marca") || undefined,
      }
    : null;
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

  // Búsqueda de texto sobre los resultados ya filtrados por el server. Replica PA (Marca_DM y
  // ConcatMaquina_DM) y suma N° de serie + IDMaquina_DM (id de negocio) por utilidad para el técnico.
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return maquinas;
    return maquinas.filter(
      (m) =>
        m.Marca_DM.toLowerCase().includes(t) ||
        m.ConcatMaquina_DM.toLowerCase().includes(t) ||
        m.NroSerie_DM.toLowerCase().includes(t) ||
        m.IDMaquina_DM.toLowerCase().includes(t),
    );
  }, [maquinas, q]);

  // Valor actual para el botón de filtros (refleja el filtro aplicado).
  const currentFilter: MaquinaFiltersValue = {
    edificio: filtro?.edificio ?? ALL,
    modelo: filtro?.modelo ?? ALL,
    marca: filtro?.marca ?? ALL,
  };

  function applyFilter(value: MaquinaFiltersValue) {
    const next = new URLSearchParams();
    next.set("aplicado", "1");
    if (value.edificio !== ALL) next.set("edificio", value.edificio);
    if (value.modelo !== ALL) next.set("modelo", value.modelo);
    if (value.marca !== ALL) next.set("marca", value.marca);
    setSearchParams(next, { replace: true });
  }

  function goHistorial(m: DetalleMaquina) {
    navigate(`/maquinas/${encodeURIComponent(m.IDMaquina_DM)}/historial`, {
      state: { listSearch: searchParams.toString() },
    });
  }

  // Chips del filtro activo (indicador de solo lectura; el botón Filtros los edita).
  const activeChips: {
    field: keyof MaquinaFiltersValue;
    label: string;
    value: string;
  }[] = [];
  if (filtro?.edificio)
    activeChips.push({
      field: "edificio",
      label: "Edificio",
      value: filtro.edificio,
    });
  if (filtro?.modelo)
    activeChips.push({ field: "modelo", label: "Modelo", value: filtro.modelo });
  if (filtro?.marca)
    activeChips.push({ field: "marca", label: "Marca", value: filtro.marca });

  const countLabel = filtro
    ? `${filtered.length} máquina${filtered.length === 1 ? "" : "s"}`
    : "Elegí un filtro para empezar";

  const filterButton = (
    <MaquinaFilterButton
      current={currentFilter}
      edificioNames={edificioNames}
      modelos={modelos}
      marcas={marcas}
      onApply={applyFilter}
    />
  );

  const refreshBtn = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => refetch()}
      disabled={!filtro || isFetching}
      aria-label="Refrescar"
    >
      <RefreshCw className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
    </Button>
  );

  const searchInput = (
    <div className="relative w-full">
      <SearchBar
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por marca, modelo, N° serie o ID..."
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
  );

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      {/* Header mobile (centrado). En desktop usamos el encabezado de módulo de abajo. */}
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Detalle Máquina"
        subtitle={countLabel}
        action={
          <div className="flex items-center gap-1">
            {filterButton}
            {refreshBtn}
          </div>
        }
      />

      {/* Encabezado de módulo desktop/tablet: título a la izquierda + buscador + Filtros. */}
      <ModuleHeader title="Detalle Máquina" subtitle={countLabel}>
        <div className="w-64 lg:w-80">{searchInput}</div>
        {filterButton}
        {refreshBtn}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
        {/* Buscador mobile (en desktop está en el encabezado). */}
        <div className="md:hidden">{searchInput}</div>

        {/* Chips del filtro activo (indicador). */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((c) => (
              <span
                key={c.field}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs shadow-xs"
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
              onClick={() => applyFilter(EMPTY)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </Button>
          </div>
        ) : null}

        {/* Estados */}
        {filtro === null ? (
          <EmptyState
            icon={Filter}
            title="Seleccioná un filtro"
            description="Usá el botón Filtros para elegir edificio, modelo o marca, o mirá todas las máquinas."
            action={
              <Button variant="outline" onClick={() => applyFilter(EMPTY)}>
                Ver todas las máquinas
              </Button>
            }
          />
        ) : isLoading ? (
          <InlineLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin máquinas"
            description="No hay máquinas que coincidan con el filtro."
            action={
              <Button variant="outline" onClick={() => applyFilter(EMPTY)}>
                Ver todas las máquinas
              </Button>
            }
          />
        ) : (
          <>
            {/* Mobile: cards apiladas (una por máquina). */}
            <div className="grid grid-cols-1 gap-2 md:hidden">
              {filtered.map((m) => (
                <MaquinaCard
                  key={m.ID}
                  maquina={m}
                  onView={() => goHistorial(m)}
                />
              ))}
            </div>

            {/* Desktop/tablet: grilla estándar (DataTable: columna principal flexible + sortable). */}
            <DataTable
              className="hidden md:block"
              data={filtered}
              getRowKey={(m) => m.ID}
              onRowClick={(m) => goHistorial(m)}
              initialSort={{ key: "maquina" }}
              columns={[
                {
                  key: "maquina",
                  header: "Máquina",
                  primary: true,
                  sortable: true,
                  sortAccessor: (m) => tituloMaquina(m),
                  cell: (m) => (
                    <CellTitleSubtitle
                      icon={Wrench}
                      title={tituloMaquina(m)}
                      subtitle={`N° ${m.NroSerie_DM}`}
                    />
                  ),
                },
                {
                  key: "id",
                  header: "ID",
                  sortable: true,
                  // ID de negocio (IDMaquina_DM, txt_ID_DM de PA), no el item-id de SharePoint.
                  sortAccessor: (m) => m.IDMaquina_DM,
                  cell: (m) => (
                    <span className="font-mono text-xs">{m.IDMaquina_DM}</span>
                  ),
                },
                {
                  key: "encendido",
                  header: "Encendido",
                  sortable: true,
                  sortAccessor: (m) => m.Encendido_DM,
                  cell: (m) => <EncendidoBadge modo={m.Encendido_DM} />,
                },
                {
                  key: "accion",
                  header: "Acción",
                  align: "right",
                  cell: (m) => (
                    <Button
                      variant="outline"
                      size="iconSm"
                      onClick={(e) => {
                        e.stopPropagation();
                        goHistorial(m);
                      }}
                      aria-label="Ver historial"
                    >
                      <Eye />
                    </Button>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
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
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
          <Wrench className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-primary">
            {tituloMaquina(maquina)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Chip label="N° Serie" value={maquina.NroSerie_DM} mono />
            {/* ID de negocio (IDMaquina_DM), no el item-id de SharePoint. */}
            <Chip label="ID" value={maquina.IDMaquina_DM} mono />
          </div>
          <EncendidoBadge modo={maquina.Encendido_DM} />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onView}
          aria-label="Ver historial"
          className="my-auto h-11 w-11 shrink-0 transition-colors group-hover:border-primary group-hover:text-primary"
        >
          <Eye />
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
        <Smartphone className="h-3.5 w-3.5" />
        App
      </span>
    );
  }
  if (modo === "Fichas") {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <Coins className="h-3.5 w-3.5" />
        Fichas
      </span>
    );
  }
  if (!modo) return null;
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
      <Power className="h-3.5 w-3.5" />
      {modo}
    </span>
  );
}
