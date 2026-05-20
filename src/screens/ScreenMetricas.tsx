import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Building2,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  Filter,
  ListChecks,
  MessageSquare,
  MoreVertical,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { HamburgerMenu } from "@/components/layout/HamburgerMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/data/api";
import type {
  ChecklistItemDef,
  DetalleRegistro,
  EstadoRegistro,
  Registro,
} from "@/data/types";

type Tab = "general" | "incidentes";

const ALL = "__all__";

const MES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatMesLabel(mesAño: string) {
  // "05/2026" → "Mayo 2026"
  const [m, y] = mesAño.split("/");
  const idx = parseInt(m, 10) - 1;
  if (idx >= 0 && idx < 12 && y) return `${MES_NOMBRES[idx]} ${y}`;
  return mesAño;
}

function mesFromFecha(fecha: string) {
  // dd/MM/yyyy → MM/yyyy
  const parts = fecha.split("/");
  if (parts.length !== 3) return "";
  return `${parts[1]}/${parts[2]}`;
}

export default function ScreenMetricas() {
  const [tab, setTab] = useState<Tab>("general");
  const [q, setQ] = useState("");
  const [checklistFor, setChecklistFor] = useState<Registro | null>(null);
  const [obsFor, setObsFor] = useState<Registro | null>(null);
  const [obsDetalleFor, setObsDetalleFor] = useState<DetalleRegistro | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mesFilter, setMesFilter] = useState(ALL);
  const [usuarioFilter, setUsuarioFilter] = useState(ALL);
  const [edificioFilter, setEdificioFilter] = useState(ALL);

  const { data: registros = [], isLoading: lR } = useQuery({
    queryKey: ["registros"],
    queryFn: () => api.listRegistros(),
  });
  const { data: detalles = [], isLoading: lD } = useQuery({
    queryKey: ["detalles"],
    queryFn: () => api.listDetalles(),
  });
  const { data: checklistDef = [] } = useQuery({
    queryKey: ["checklist"],
    queryFn: () => api.listChecklist(),
  });

  // Opciones para los filtros (calculadas en base a los datos)
  const mesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of registros) if (r.MesAño) set.add(r.MesAño);
    for (const d of detalles) {
      const m = mesFromFecha(d.Fecha);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => {
      // ordenar desc: "MM/YYYY" → "YYYY-MM"
      const ka = a.split("/").reverse().join("-");
      const kb = b.split("/").reverse().join("-");
      return kb.localeCompare(ka);
    });
  }, [registros, detalles]);

  const usuarioOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of registros) if (r.Nombre) set.add(r.Nombre);
    for (const d of detalles) if (d.Tecnico) set.add(d.Tecnico);
    return Array.from(set).sort();
  }, [registros, detalles]);

  const edificioOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of registros) if (r.Edificio) set.add(r.Edificio);
    for (const d of detalles) if (d.Edificio) set.add(d.Edificio);
    return Array.from(set).sort();
  }, [registros, detalles]);

  const activeFilterCount =
    (mesFilter !== ALL ? 1 : 0) +
    (usuarioFilter !== ALL ? 1 : 0) +
    (edificioFilter !== ALL ? 1 : 0);

  const filteredRegistros = useMemo(() => {
    const t = q.trim().toLowerCase();
    return registros
      .filter(
        (r) =>
          (!t ||
            r.Edificio.toLowerCase().includes(t) ||
            r.Nombre.toLowerCase().includes(t) ||
            r.Codigo.toLowerCase().includes(t)) &&
          (mesFilter === ALL || r.MesAño === mesFilter) &&
          (usuarioFilter === ALL || r.Nombre === usuarioFilter) &&
          (edificioFilter === ALL || r.Edificio === edificioFilter),
      )
      .sort((a, b) => b.ID - a.ID);
  }, [registros, q, mesFilter, usuarioFilter, edificioFilter]);

  const filteredDetalles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return detalles
      .filter(
        (d) =>
          (!t ||
            d.Item.toLowerCase().includes(t) ||
            d.Edificio.toLowerCase().includes(t) ||
            d.Tecnico.toLowerCase().includes(t)) &&
          (mesFilter === ALL || mesFromFecha(d.Fecha) === mesFilter) &&
          (usuarioFilter === ALL || d.Tecnico === usuarioFilter) &&
          (edificioFilter === ALL || d.Edificio === edificioFilter),
      )
      .sort((a, b) => b.ID - a.ID);
  }, [detalles, q, mesFilter, usuarioFilter, edificioFilter]);

  function clearFilters() {
    setMesFilter(ALL);
    setUsuarioFilter(ALL);
    setEdificioFilter(ALL);
  }

  const chartData = useMemo(() => {
    const map = new Map<EstadoRegistro, number>();
    for (const r of registros) map.set(r.Estado, (map.get(r.Estado) ?? 0) + 1);
    const order: EstadoRegistro[] = ["Finalizado", "En Proceso", "Pendiente", "Anulado"];
    return order
      .filter((e) => (map.get(e) ?? 0) > 0)
      .map((name) => ({ name, value: map.get(name) ?? 0 }));
  }, [registros]);

  function exportCSV() {
    const rows =
      tab === "general"
        ? [
            ["Edificio", "Técnico", "Estado", "Hora inicio", "Hora fin", "Fecha"],
            ...filteredRegistros.map((r) => [
              r.Edificio,
              r.Nombre,
              r.Estado,
              r.HoraInicio,
              r.HoraFinal,
              r.Fecha,
            ]),
          ]
        : [
            ["Edificio", "Item", "Observaciones", "Técnico", "Fecha", "Estado"],
            ...filteredDetalles.map((d) => [
              d.Edificio,
              d.Item,
              d.Observaciones,
              d.Tecnico,
              d.Fecha,
              d.Estado,
            ]),
          ];
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricas_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado a CSV");
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <ScreenHeader
        title="Métricas"
        back="/home"
        action={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={exportCSV}
              aria-label="Exportar CSV"
              className="h-10 w-10 rounded-xl"
            >
              <Download className="h-4 w-4" />
            </Button>
            <HamburgerMenu />
          </>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 md:p-6">
        {/* Mini chart */}
        {chartData.length > 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Registros por estado
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Total {registros.length}
                </span>
              </div>
              <div className="h-32 md:h-36">
                <ResponsiveContainer>
                  <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 4, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))" }}
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 12,
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchBar
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "general"
                  ? "Buscar edificio o técnico..."
                  : "Buscar item o edificio..."
              }
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
            onClick={() => setFilterOpen(true)}
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

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Reporte general</span>
            </TabsTrigger>
            <TabsTrigger value="incidentes" className="gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              <span>Reporte de Incidentes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-3 space-y-2">
            {lR ? <InlineLoader /> : null}
            {!lR && filteredRegistros.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Sin registros"
                description={
                  q
                    ? "No hay registros que coincidan con la búsqueda."
                    : "Todavía no hay registros cargados."
                }
              />
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {filteredRegistros.map((r) => (
                <RegistroCard
                  key={r.ID}
                  registro={r}
                  onChecklist={() => setChecklistFor(r)}
                  onObs={() => setObsFor(r)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="incidentes" className="mt-3 space-y-2">
            {lD ? <InlineLoader /> : null}
            {!lD && filteredDetalles.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Sin incidentes"
                description={
                  q
                    ? "No hay items que coincidan con la búsqueda."
                    : "Todavía no hay incidentes reportados."
                }
              />
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {filteredDetalles.map((d) => (
                <IncidenteCard
                  key={d.ID}
                  item={d}
                  onView={() => setObsDetalleFor(d)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        mes={mesFilter}
        usuario={usuarioFilter}
        edificio={edificioFilter}
        onMesChange={setMesFilter}
        onUsuarioChange={setUsuarioFilter}
        onEdificioChange={setEdificioFilter}
        mesOptions={mesOptions}
        usuarioOptions={usuarioOptions}
        edificioOptions={edificioOptions}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />

      <DetalleChecklistDialog
        registro={checklistFor}
        items={checklistDef}
        onClose={() => setChecklistFor(null)}
      />
      <ObservacionGeneralDialog
        registro={obsFor}
        onClose={() => setObsFor(null)}
      />
      <ObservacionDetalleDialog
        detalle={obsDetalleFor}
        onClose={() => setObsDetalleFor(null)}
      />
    </div>
  );
}

function RegistroCard({
  registro,
  onChecklist,
  onObs,
}: {
  registro: Registro;
  onChecklist: () => void;
  onObs: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-primary">
              {registro.Edificio}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-foreground/80">{registro.Nombre}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium tabular-nums tracking-tight">
                {registro.Fecha}
              </span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Acciones"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="w-72 overflow-hidden rounded-2xl border-border/60 p-0 shadow-xl"
              >
                <DropdownMenuLabel className="border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </DropdownMenuLabel>
                <div className="p-1.5">
                  <DropdownMenuItem
                    onClick={onChecklist}
                    className="group cursor-pointer rounded-xl p-2.5 focus:bg-primary/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-focus:scale-105">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <div className="ml-3 flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold leading-tight">
                        Ver detalle de Checklist
                      </span>
                      <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        Items respondidos en la visita
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-0.5" />
                  <DropdownMenuItem
                    onClick={onObs}
                    className="group cursor-pointer rounded-xl p-2.5 focus:bg-amber-500/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition-transform group-focus:scale-105 dark:bg-amber-500/15 dark:text-amber-400">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="ml-3 flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold leading-tight">
                        Observación y foto
                      </span>
                      <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        Notas generales del técnico
                      </span>
                    </div>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t pt-2 text-[11px]">
          <TimePill label="Inicio" value={registro.HoraInicio || "—"} />
          <TimePill label="Fin" value={registro.HoraFinal || "—"} />
          <span className="ml-auto">
            <EstadoPill estado={registro.Estado} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidenteCard({
  item,
  onView,
}: {
  item: DetalleRegistro;
  onView: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-2 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-200 text-cyan-700 ring-1 ring-cyan-200/60 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-300 dark:ring-cyan-500/20">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary">
            {item.Edificio}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold leading-tight">
            {item.Item}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-foreground/80">{item.Tecnico}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="font-medium tabular-nums tracking-tight">
              {item.Fecha}
            </span>
          </span>
          <Button
            variant="default"
            size="icon"
            onClick={onView}
            aria-label="Ver observación"
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600"
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[11px] font-semibold text-foreground/90">{value}</span>
    </span>
  );
}

function EstadoPill({ estado }: { estado: EstadoRegistro }) {
  const map: Record<EstadoRegistro, string> = {
    Finalizado:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    "En Proceso": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    Pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    Anulado: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[estado]}`}
    >
      {estado}
    </span>
  );
}

/* ---------- Dialogs ---------- */

function FilterDialog({
  open,
  onOpenChange,
  mes,
  usuario,
  edificio,
  onMesChange,
  onUsuarioChange,
  onEdificioChange,
  mesOptions,
  usuarioOptions,
  edificioOptions,
  onClear,
  activeCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mes: string;
  usuario: string;
  edificio: string;
  onMesChange: (v: string) => void;
  onUsuarioChange: (v: string) => void;
  onEdificioChange: (v: string) => void;
  mesOptions: string[];
  usuarioOptions: string[];
  edificioOptions: string[];
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <Filter className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                Filtrar
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {activeCount > 0
                  ? `${activeCount} filtro${activeCount === 1 ? "" : "s"} aplicado${
                      activeCount === 1 ? "" : "s"
                    }`
                  : "Refiná los resultados de la lista."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <FilterField label="Mes" icon={CalendarRange}>
            <Select value={mes} onValueChange={onMesChange}>
              <SelectTrigger className="h-11 md:h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los meses</SelectItem>
                {mesOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMesLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Usuario" icon={Users}>
            <Select value={usuario} onValueChange={onUsuarioChange}>
              <SelectTrigger className="h-11 md:h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {usuarioOptions.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Edificio" icon={Building2}>
            <Select value={edificio} onValueChange={onEdificioChange}>
              <SelectTrigger className="h-11 md:h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {edificioOptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={activeCount === 0}
            className="h-10 flex-1 sm:flex-none"
          >
            Limpiar
          </Button>
          <DialogClose asChild>
            <Button className="h-10 flex-1 bg-gradient-to-br from-primary to-blue-700 sm:flex-none">
              Aceptar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </label>
      {children}
    </div>
  );
}

function DetalleChecklistDialog({
  registro,
  items,
  onClose,
}: {
  registro: Registro | null;
  items: ChecklistItemDef[];
  onClose: () => void;
}) {
  // Genera estado determinístico de cada item segun el Registro
  // Finalizado → todos OK | En Proceso → mitad OK | resto → todos pendientes
  function statusFor(itemId: number): "ok" | "no" | "pending" {
    if (!registro) return "pending";
    if (registro.Estado === "Finalizado") {
      // marca algunos como NO en base al hash
      return ((itemId + registro.ID) % 7) === 0 ? "no" : "ok";
    }
    if (registro.Estado === "En Proceso") {
      return itemId % 2 === 0 ? "ok" : "pending";
    }
    return "pending";
  }

  const counts = useMemo(() => {
    let ok = 0;
    let no = 0;
    let pending = 0;
    for (const it of items) {
      const s = statusFor(it.ID);
      if (s === "ok") ok++;
      else if (s === "no") no++;
      else pending++;
    }
    return { ok, no, pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, registro?.ID, registro?.Estado]);

  return (
    <Dialog open={!!registro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <div className="relative shrink-0 overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                Detalle de checklist
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {registro?.Edificio}
              </p>
            </div>
          </div>
        </div>

        {/* Strip de totales */}
        <div className="flex shrink-0 items-center gap-2 border-b bg-background px-5 py-2 text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Total {items.length}
          </span>
          <span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> {counts.ok}
          </span>
          {counts.no > 0 ? (
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <XCircle className="h-3 w-3" /> {counts.no}
            </span>
          ) : null}
          {counts.pending > 0 ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              {counts.pending} pendiente{counts.pending === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
          {items.map((it) => {
            const status = statusFor(it.ID);
            return (
              <div
                key={it.ID}
                className="flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm"
              >
                <StatusBadgeSmall status={status} />
                <span className="min-w-0 flex-1 text-sm leading-snug">
                  {it.Descripcion}
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadgeSmall({ status }: { status: "ok" | "no" | "pending" }) {
  if (status === "ok") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Ok
      </span>
    );
  }
  if (status === "no") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        <XCircle className="h-3 w-3" />
        No
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Pend.
    </span>
  );
}

function ObservacionGeneralDialog({
  registro,
  onClose,
}: {
  registro: Registro | null;
  onClose: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Dialog open={!!registro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                Detalle de observación
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {registro?.Edificio} · {registro?.Fecha}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observación general
            </p>
            {registro?.ObservacionGeneral ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
                {registro.ObservacionGeneral}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-card/50 p-3 text-center text-xs text-muted-foreground">
                Sin observaciones registradas.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Foto de la observación
            </p>
            {registro?.FotoGeneral ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Eye className="h-4 w-4" />
                </div>
                <span className="flex-1 truncate text-sm font-semibold text-primary">
                  Ver foto adjunta
                </span>
              </button>
            ) : (
              <div className="rounded-lg border border-dashed bg-card/50 p-3 text-center text-xs text-muted-foreground">
                Sin foto adjunta.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>

        {/* Preview de foto */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
            <DialogTitle className="sr-only">Foto de la observación</DialogTitle>
            {registro?.FotoGeneral ? (
              <img
                src={registro.FotoGeneral}
                alt="Foto observación"
                className="h-auto w-full object-contain"
              />
            ) : null}
            <DialogFooter className="border-t bg-background px-5 py-3">
              <DialogClose asChild>
                <Button variant="outline" className="h-10 w-full">
                  Cerrar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function ObservacionDetalleDialog({
  detalle,
  onClose,
}: {
  detalle: DetalleRegistro | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!detalle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
        <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 ring-1 ring-amber-200/60 dark:text-amber-400 dark:ring-amber-500/20">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                {detalle?.Item}
              </DialogTitle>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{detalle?.Edificio}</span>
                <span className="opacity-50">·</span>
                <span className="font-medium tabular-nums tracking-tight">
                  {detalle?.Fecha}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observaciones
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
              {detalle?.Observaciones || "Sin observaciones."}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Técnico
              </p>
              <p className="truncate text-sm font-medium">{detalle?.Tecnico}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                detalle?.Estado === "Resuelto"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {detalle?.Estado}
            </span>
          </div>
        </div>

        <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" className="h-10 w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
