import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardEdit,
  HelpCircle,
  MessageSquareText,
  Package,
  Plus,
  Send,
  User,
  Wind,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/shared/Combobox";
import { IncidenteFilterButton } from "@/components/shared/IncidenteFilterButton";
import { type IncidenteFiltersValue } from "@/components/shared/IncidenteFilters";
import {
  ResolverIncidenteDialog,
  VerRepuestosDialog,
} from "@/components/shared/ResolverIncidenteDialog";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  arToMesAno,
  mesAnoLabel,
  compareMesAnoDesc,
  lastNMonths,
} from "@/lib/fecha";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useSession } from "@/stores/sessionStore";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  getIncidentes,
  crearIncidente,
  anularIncidente,
  getVentilacionesPendientes,
  adelantarVentilacion,
  getEdificios,
  getDetalleMaquina,
  getUsuarios,
  type Incidente,
} from "@/lib/api-client";

// Franja de color por estado (estados reales de 10.Incidentes).
function stripeFor(status: string) {
  switch (status) {
    case "Resuelto":
      return "bg-emerald-500";
    case "Anulado":
      return "bg-rose-500";
    case "Asignado":
    case "Aprobada":
    case "En Aprobacion":
      return "bg-blue-500";
    default:
      return "bg-amber-500"; // Pendiente / A Revisar / etc.
  }
}

const EMPTY_FILTROS: IncidenteFiltersValue = {
  mesAno: [],
  edificio: [],
  estado: [],
};

export default function ScreenIncidentes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"abiertos" | "cerrados">("abiertos");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<IncidenteFiltersValue>(EMPTY_FILTROS);
  const [anular, setAnular] = useState<Incidente | null>(null);
  const [resolver, setResolver] = useState<Incidente | null>(null);
  const [revisar, setRevisar] = useState<Incidente | null>(null); // popup "?" (Continuar/Anular)
  const [verObs, setVerObs] = useState<Incidente | null>(null); // ver observación del reporte
  const [verRepuestos, setVerRepuestos] = useState<Incidente | null>(null);
  const [obsAnular, setObsAnular] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [reportarOpen, setReportarOpen] = useState(false);
  const [ventOpen, setVentOpen] = useState(false);

  // Reportar (alta rápida): reportarEdif = CÓDIGO del edificio (Combobox).
  const [reportarEdif, setReportarEdif] = useState("");
  const [reportarTec, setReportarTec] = useState("");
  const [reportarMaq, setReportarMaq] = useState(""); // "" = sin máquina (ID del ítem)
  const [reportarDesc, setReportarDesc] = useState("");
  // IDMaquina_DM pendiente de pre-seleccionar (llega de "Nuevo incidente" desde el historial de
  // máquina). Se resuelve a reportarMaq cuando está disponible el catálogo de máquinas.
  const [pendingMaqId, setPendingMaqId] = useState<string | null>(null);
  // Ventilación: "Generar ventilación" ADELANTA una ventilación PENDIENTE existente
  // (paridad PA bt_aceptar_AVE), NO crea una fila nueva. ventId = ID de la pendiente elegida.
  const [ventId, setVentId] = useState("");
  const [ventDesc, setVentDesc] = useState("");

  // Mes actual (mm/yyyy) — default del tab "Cerrados" para no traer todo el histórico.
  const currentMonth = useMemo(() => lastNMonths(1)[0], []);
  // "Cerrados" puede tener MUCHÍSIMOS registros → se trae solo el/los mes(es) elegidos
  // (default: mes actual), filtrando server-side. "Abiertos" trae todo (son pocos).
  const cerradoMeses =
    tab === "cerrados"
      ? filtros.mesAno.length
        ? filtros.mesAno
        : [currentMonth]
      : undefined;
  // El backend scopea por técnico y separa por estado (NO=abiertos, SI=cerrados).
  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ["incidentes", tab, cerradoMeses ?? "all"],
    queryFn: () =>
      getIncidentes(tab === "cerrados" ? "SI" : "NO", cerradoMeses),
  });
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: maquinas = [] } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => getDetalleMaquina(),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: getUsuarios,
  });
  // Ventilaciones PENDIENTES para el combo "Generar ventilación" (paridad PA
  // ClearCollect(CollectVentilacionesPendientes, Filter('19.Ventilaciones', Estado_VE="Pendiente"))).
  // Se carga al abrir el diálogo, como el OnSelect de bt_agregarIncidente_1.
  const { data: ventPendientes = [], isLoading: ventLoading } = useQuery({
    queryKey: ["ventilaciones", "pendientes"],
    queryFn: getVentilacionesPendientes,
    enabled: ventOpen,
  });

  const myName = user?.Concat_Nombre_Apellido;

  // Base por tab (paridad PA gal_incidentes.Items: Status_IN <> "Pendiente" And <> "Aprobada"):
  // el técnico NO ve los estados a la espera de aprobación admin. "cerrados" muestra Resuelto/Anulado.
  const base = useMemo(
    () =>
      tab === "abiertos"
        ? incidentes.filter(
            (i) => i.Status_IN !== "Pendiente" && i.Status_IN !== "Aprobada",
          )
        : incidentes,
    [incidentes, tab],
  );

  // Opciones de los filtros. Meses: SIEMPRE los últimos 12 (aunque no haya incidentes ese mes)
  // unidos a los que sí aparezcan en los datos (por si hay registros más viejos o futuros).
  const mesAnoOpts = useMemo(() => {
    const set = new Set<string>(lastNMonths(12));
    for (const i of base) {
      const k = arToMesAno(i.Fecha_IN);
      if (k) set.add(k);
    }
    return Array.from(set)
      .sort(compareMesAnoDesc)
      .map((k) => ({ value: k, label: mesAnoLabel(k) }));
  }, [base]);
  const edificioFilterNames = useMemo(
    () =>
      Array.from(
        new Set(base.map((i) => i.NombreEdificio_IN).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [base],
  );
  const estados = useMemo(
    () =>
      Array.from(new Set(base.map((i) => i.Status_IN).filter(Boolean))).sort(),
    [base],
  );

  const filtered = useMemo(() => {
    let list = base;
    // Cada filtro es multi-select: array vacío = sin filtro; si no, OR dentro del campo.
    if (filtros.mesAno.length)
      list = list.filter((i) => filtros.mesAno.includes(arToMesAno(i.Fecha_IN)));
    if (filtros.edificio.length)
      list = list.filter((i) => filtros.edificio.includes(i.NombreEdificio_IN));
    if (filtros.estado.length)
      list = list.filter((i) => filtros.estado.includes(i.Status_IN));
    const t = q.trim().toLowerCase();
    if (t)
      list = list.filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(t) ||
          i.ConcatMaquina_IN.toLowerCase().includes(t) ||
          i.Descripcion_IN.toLowerCase().includes(t) ||
          i.DescripcionCarga_IN.toLowerCase().includes(t),
      );
    return list;
  }, [base, filtros, q]);

  // Default del técnico en "Reportar" = usuario logueado (cuando llega el dato).
  useEffect(() => {
    if (myName && !reportarTec) setReportarTec(myName);
  }, [myName, reportarTec]);

  // "Nuevo incidente" (?nuevo=1). Desde el historial de máquina llega además
  // ?maquina=<IDMaquina_DM>&edificio=<Codigo> para pre-cargar el alta
  // (PA: bt_NewIncidenteDesdeHM + MaquinaHistorial / DefaultSelectedItems).
  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    const maqParam = searchParams.get("maquina");
    const edifParam = searchParams.get("edificio");
    if (maqParam) {
      if (edifParam) setReportarEdif(edifParam);
      setPendingMaqId(maqParam);
      setReportarOpen(true); // directo a Reportar con la máquina precargada
    } else {
      setTipoOpen(true); // elección Reportar / Registrar
    }
    const next = new URLSearchParams(searchParams);
    next.delete("nuevo");
    next.delete("maquina");
    next.delete("edificio");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Resuelve la máquina pendiente a reportarMaq (ID del ítem) cuando llega el catálogo.
  useEffect(() => {
    if (!pendingMaqId || maquinas.length === 0) return;
    const m = maquinas.find((x) => x.IDMaquina_DM === pendingMaqId);
    if (m) {
      setReportarEdif(m.CodigoEdificio_DM);
      setReportarMaq(String(m.ID));
    }
    setPendingMaqId(null);
  }, [pendingMaqId, maquinas]);

  // Máquinas del edificio elegido en "Reportar" (reportarEdif = CÓDIGO; hay nombres repetidos).
  const reportarEdifSel = edificios.find((e) => e.Codigo === reportarEdif);
  const reportarMaquinas = reportarEdifSel
    ? maquinas.filter((m) => m.CodigoEdificio_DM === reportarEdifSel.Codigo)
    : [];
  // Opciones de edificio con value=Codigo (único). Si el nombre se repite, se muestra el código.
  const edificioOpts = useMemo(() => {
    const activos = edificios.filter((e) => e.Status === "ALTA");
    const dup = new Map<string, number>();
    for (const e of activos) dup.set(e.Edificio, (dup.get(e.Edificio) ?? 0) + 1);
    return activos
      .map((e) => ({
        value: e.Codigo,
        label:
          (dup.get(e.Edificio) ?? 0) > 1
            ? `${e.Edificio} · ${e.Codigo}`
            : e.Edificio,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [edificios]);
  const tecnicoNames = Array.from(
    new Set(
      usuarios
        .filter((u) => u.Rol === "Tecnico" && u.Status === "ALTA")
        .map((u) => u.Concat_Nombre_Apellido),
    ),
  ).sort();

  // Opciones del combo de ventilación: una por ventilación PENDIENTE (value = ID).
  // PA muestra Edificio_VE; agregamos grupo/frecuencia para desambiguar pendientes del mismo edificio.
  const ventOpts = useMemo(
    () =>
      ventPendientes
        .map((v) => {
          const extra = [v.Grupo_VE, v.Frecuencia_VE]
            .filter(Boolean)
            .join(" · ");
          return {
            value: String(v.ID),
            label: extra ? `${v.Edificio_VE} · ${extra}` : v.Edificio_VE,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [ventPendientes],
  );

  async function onAnular() {
    if (!anular) return;
    if (!obsAnular.trim()) {
      toast.error("Indicá el motivo de anulación");
      return;
    }
    try {
      await anularIncidente(anular.ID, obsAnular);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular");
      return;
    }
    setAnular(null);
    setObsAnular("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente anulado");
  }

  // Alta RÁPIDA (PowerApps "reportar"): crea el incidente "A Revisar" + WhatsApp al técnico.
  // Máquina opcional; Categoría "Agua" la pone el backend.
  async function onReportar() {
    if (!reportarEdif || !reportarDesc.trim()) {
      toast.error("Falta el edificio o la descripción");
      return;
    }
    const e = reportarEdifSel;
    if (!e) {
      toast.error("Edificio no válido");
      return;
    }
    const m = reportarMaq
      ? reportarMaquinas.find((x) => String(x.ID) === reportarMaq)
      : undefined;
    const maqId = m?.IDMaquina_DM ?? "";
    let nuevoId: string;
    try {
      const res = await crearIncidente({
        IDMaquina_IN: maqId,
        ConcatMaquina_IN: m?.ConcatMaquina_DM ?? "",
        CodigoEdifcio_IN: e.Codigo,
        NombreEdificio_IN: e.Edificio,
        TecnicoAsignado_IN: reportarTec,
        Descripcion: reportarDesc,
      });
      nuevoId = res.id;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear el incidente",
      );
      return;
    }
    // WhatsApp al técnico (como PowerApps).
    const tel = usuarios.find(
      (u) => u.Concat_Nombre_Apellido === reportarTec,
    )?.Telefono;
    if (tel) {
      const msg = `INCIDENTE N: ${nuevoId}\nEDIFICIO: ${e.Edificio}\nMAQUINA: ${m?.ConcatMaquina_DM ?? "(sin máquina)"}\nOBSERVACIONES: ${reportarDesc}`;
      window.open(
        `https://wa.me/54${tel.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }
    setReportarOpen(false);
    setReportarEdif("");
    setReportarMaq("");
    setReportarDesc("");
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    toast.success("Incidente reportado");
  }

  // "Generar ventilación" = ADELANTAR una ventilación PENDIENTE existente (paridad PA
  // bt_aceptar_AVE: Patch '19.Ventilaciones' {ProximaLimpieza_VE: hoy, EsIncidente_VE:"SI", ...}).
  // NO crea una fila nueva.
  async function onGenerarVentilacion() {
    if (!ventId) {
      toast.error("Elegí una ventilación pendiente para adelantar");
      return;
    }
    try {
      await adelantarVentilacion(Number(ventId), ventDesc.trim() || undefined);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo adelantar la ventilación",
      );
      return;
    }
    setVentOpen(false);
    setVentId("");
    setVentDesc("");
    qc.invalidateQueries({ queryKey: ["ventilaciones"] });
    toast.success("Ventilación adelantada");
  }

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setVentOpen(true)}
        aria-label="Generar ventilación"
        className="h-10 gap-1.5 rounded-xl px-3 text-cyan-700 border-cyan-200 hover:bg-cyan-50 dark:text-cyan-300 dark:border-cyan-500/30 dark:hover:bg-cyan-500/10"
      >
        <Wind />
        <span className="hidden lg:inline">Ventilación</span>
      </Button>
      <Button
        type="button"
        onClick={() => setTipoOpen(true)}
        aria-label="Nuevo incidente"
        className="h-10 gap-1.5 rounded-xl px-3"
      >
        <Plus />
        <span className="hidden lg:inline">Incidente</span>
      </Button>
    </>
  );

  const searchInput = (
    <div className="relative w-full">
      <SearchBar
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por edificio, máquina o descripción..."
        className="h-11 pr-10"
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

  const filterButton = (
    <IncidenteFilterButton
      current={filtros}
      mesAnoOpts={mesAnoOpts}
      edificioNames={edificioFilterNames}
      estados={estados}
      onApply={setFiltros}
      className="h-11 shrink-0 gap-1.5 px-3 md:h-10"
    />
  );

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader className="md:hidden" back="/home" action={actionButtons} />
      <ModuleHeader
        title="Incidentes"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "incidente" : "incidentes"}`}
      >
        <div className="w-52 lg:w-72">{searchInput}</div>
        {filterButton}
        {actionButtons}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-3 md:px-6 md:py-4">
        {/* Buscador + filtros mobile (en desktop están en el ModuleHeader). */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="min-w-0 flex-1">{searchInput}</div>
          {filterButton}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList className="grid h-10 w-full grid-cols-2 md:w-64">
            <TabsTrigger value="abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados">Cerrados</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3 space-y-2">
            {/* En Cerrados, sin mes elegido se muestra solo el mes actual (no todo el
                histórico, que es lento). El filtro de Mes permite ver otros períodos. */}
            {tab === "cerrados" && filtros.mesAno.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Mostrando cerrados de <b>{mesAnoLabel(currentMonth)}</b>. Usá el
                filtro de <b>Mes</b> para ver otros períodos.
              </p>
            ) : null}
            {isLoading ? <InlineLoader /> : null}
            {!isLoading && filtered.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Sin incidentes" />
            ) : null}

            {!isLoading && filtered.length > 0 ? (
              <>
                {/* Mobile: cards apiladas (una por incidente). */}
                <div className="grid grid-cols-1 gap-2 md:hidden">
                  {filtered.map((i) => (
                    <IncidenteCard
                      key={i.ID}
                      incidente={i}
                      myName={myName}
                      onVerObs={() => setVerObs(i)}
                      onRevisar={() => setRevisar(i)}
                      onVerRepuestos={() => setVerRepuestos(i)}
                      onResolver={() => setResolver(i)}
                      onAnular={() => setAnular(i)}
                    />
                  ))}
                </div>

                {/* Desktop/tablet: grilla estándar (DataTable: columna principal flexible + sortable).
                    No navega por click de fila (las cards tampoco lo hacían): solo botones de acción. */}
                <DataTable
                  className="hidden md:block"
                  data={filtered}
                  getRowKey={(i) => i.ID}
                  initialSort={{ key: "fecha", dir: "desc" }}
                  columns={[
                    {
                      key: "registro",
                      header: "Incidente",
                      primary: true,
                      sortable: true,
                      className: "align-top",
                      sortAccessor: (i) => i.NombreEdificio_IN,
                      cell: (i) => <IncidenteCell incidente={i} />,
                    },
                    {
                      key: "fecha",
                      header: "Fecha",
                      sortable: true,
                      sortAccessor: (i) => i.Fecha_IN,
                      cell: (i) => (
                        <span className="tabular-nums tracking-tight text-muted-foreground">
                          {i.Fecha_IN}
                        </span>
                      ),
                    },
                    {
                      key: "tecnico",
                      header: "Técnico",
                      sortable: true,
                      sortAccessor: (i) => i.TecnicoAsignado_IN,
                      cell: (i) => (
                        <span className="text-foreground/80">
                          {i.TecnicoAsignado_IN}
                        </span>
                      ),
                    },
                    {
                      key: "estado",
                      header: "Estado",
                      sortable: true,
                      sortAccessor: (i) => i.Status_IN,
                      cell: (i) => <StatusBadge status={i.Status_IN} />,
                    },
                    {
                      key: "acciones",
                      header: "Acciones",
                      align: "right",
                      cell: (i) => (
                        <div className="flex justify-end">
                          <IncidenteAcciones
                            incidente={i}
                            myName={myName}
                            onVerObs={() => setVerObs(i)}
                            onRevisar={() => setRevisar(i)}
                            onVerRepuestos={() => setVerRepuestos(i)}
                            onResolver={() => setResolver(i)}
                            onAnular={() => setAnular(i)}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>

      {/* Tipo Incidente — choice popup */}
      <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-destructive/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Tipo de incidente
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Cómo querés registrar el incidente?
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setTipoOpen(false);
                navigate("/incidentes/nuevo");
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Registrar</p>
                <p className="text-xs text-muted-foreground">
                  Carga completa: categoría, estado, repuestos y foto.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoOpen(false);
                setReportarOpen(true);
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Reportar</p>
                <p className="text-xs text-muted-foreground">
                  Alta rápida del incidente y aviso al técnico por WhatsApp.
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 w-full sm:w-auto">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reportar incidente — envío por mail */}
      <Dialog open={reportarOpen} onOpenChange={setReportarOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Reportar incidente
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alta rápida + aviso al técnico por WhatsApp.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Edificio <span className="text-destructive">*</span>
              </label>
              <Combobox
                value={reportarEdif}
                onChange={(v) => {
                  setReportarEdif(v);
                  setReportarMaq("");
                }}
                options={edificioOpts}
                showAll={false}
                placeholder="Elegir edificio"
                searchPlaceholder="Buscar edificio…"
                emptyText="Sin edificios"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Técnico
              </label>
              <Combobox
                value={reportarTec}
                onChange={setReportarTec}
                options={tecnicoNames}
                showAll={false}
                placeholder="Elegir técnico"
                searchPlaceholder="Buscar técnico…"
                emptyText="Sin técnicos"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Máquina (opcional)
              </label>
              <Combobox
                value={reportarMaq}
                onChange={setReportarMaq}
                options={reportarMaquinas.map((m) => ({
                  value: String(m.ID),
                  label: `${m.ConcatMaquina_DM} · N° ${m.NroSerie_DM}`,
                }))}
                showAll={false}
                disabled={!reportarEdifSel}
                placeholder={
                  reportarEdifSel ? "Elegir máquina" : "Elegí un edificio primero"
                }
                searchPlaceholder="Buscar máquina…"
                emptyText="Sin máquinas"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Descripción <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={reportarDesc}
                onChange={(e) => setReportarDesc(e.target.value)}
                rows={3}
                placeholder="Detalle breve del incidente..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={onReportar}
              disabled={!reportarEdif || !reportarDesc.trim()}
              className="h-10 flex-1 gap-2 sm:flex-none"
            >
              <Send />
              Reportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generar ventilación = adelantar una ventilación PENDIENTE existente (paridad PA) */}
      <Dialog
        open={ventOpen}
        onOpenChange={(o) => {
          setVentOpen(o);
          if (!o) {
            setVentId("");
            setVentDesc("");
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-500/15 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                <Wind className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Generar ventilación
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ¿Qué ventilación pendiente querés adelantar a hoy?
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            {ventLoading ? (
              <InlineLoader />
            ) : ventOpts.length === 0 ? (
              <EmptyState
                icon={Wind}
                title="Sin ventilaciones pendientes"
                description="No hay ventilaciones pendientes para adelantar."
              />
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ventilación pendiente{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <Combobox
                    value={ventId}
                    onChange={setVentId}
                    options={ventOpts}
                    showAll={false}
                    placeholder="Elegir ventilación"
                    searchPlaceholder="Buscar por edificio…"
                    emptyText="Sin ventilaciones pendientes"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Observación
                  </label>
                  <Textarea
                    value={ventDesc}
                    onChange={(e) => setVentDesc(e.target.value)}
                    rows={3}
                    placeholder="Notas u observaciones (opcional)..."
                    className="resize-none"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={onGenerarVentilacion}
              disabled={!ventId || ventLoading || ventOpts.length === 0}
              className="h-10 flex-1 gap-2 sm:flex-none"
            >
              <Wind />
              Adelantar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revisar (A Revisar) — elegir Continuar o Anular */}
      <Dialog open={!!revisar} onOpenChange={(o) => !o && setRevisar(null)}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 sm:rounded-3xl">
          <div className="relative overflow-hidden border-b bg-muted/30 px-5 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight">
                  Revisar incidente #{revisar?.IDIncidente}
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {revisar?.NombreEdificio_IN}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                const inc = revisar;
                setRevisar(null);
                if (inc)
                  navigate(`/incidentes/${inc.ID}/revisar`, {
                    state: { incidente: inc },
                  });
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Continuar</p>
                <p className="text-xs text-muted-foreground">
                  Cargar máquina, categoría, repuestos y resolver.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                const inc = revisar;
                setRevisar(null);
                setAnular(inc);
              }}
              className="group flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400">
                <Ban className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Anular</p>
                <p className="text-xs text-muted-foreground">
                  Descartar el incidente con un motivo.
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="h-10 w-full sm:w-auto">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver observación del reporte (A Revisar) */}
      <Dialog open={!!verObs} onOpenChange={(o) => !o && setVerObs(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle>Observación del incidente</DialogTitle>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {verObs?.DescripcionCarga_IN || "Sin observación."}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={!!anular} onOpenChange={(o) => !o && setAnular(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Anular incidente #{anular?.IDIncidente}</DrawerTitle>
            <DrawerDescription>
              Indicá el motivo. Se enviará una notificación.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Textarea
              value={obsAnular}
              onChange={(e) => setObsAnular(e.target.value)}
              placeholder="Motivo de anulación..."
              rows={4}
            />
          </div>
          <DrawerFooter>
            <Button variant="destructive" onClick={onAnular}>
              Confirmar anulación
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Resolver incidente (con repuesto / sin repuesto / requiere repuesto / cambio de máquina) */}
      <ResolverIncidenteDialog
        incidente={resolver}
        onClose={() => setResolver(null)}
        onResolved={() => {
          setResolver(null);
          qc.invalidateQueries({ queryKey: ["incidentes"] });
          qc.invalidateQueries({ queryKey: ["stock-tecnico"] });
        }}
      />

      {/* Ver repuestos del incidente (13.RepuestosIncidentes) */}
      <VerRepuestosDialog
        incidente={verRepuestos}
        onClose={() => setVerRepuestos(null)}
      />
    </div>
  );
}

// Acciones por estado del incidente. Reutilizado por la card (mobile) y la fila (desktop),
// así el comportamiento es idéntico en ambos viewports.
//
// Gating de visibilidad replicado de Screen_Incidentes.pa.yaml (paridad PA):
// - "Revisar" (continuarIncidente/bt_continuarIncidente, L288/L332): solo cuando
//   Status_IN = "A Revisar" And TecnicoAsignado_IN = NombreUser. Desde el popup de
//   revisión se llega a Continuar o Anular (no hay botón de Anular suelto en la galería).
// - "Resolver" (finalizar_incidente, L229): solo cuando
//   Status_IN = "Asignado" And TecnicoAsignado_IN = NombreUser.
// - "Ver Repuestos" (bt_verRepuestos, L368 con txt_repuestoIncidente L106-117): visible
//   cuando el texto sería "Ver Repuestos", es decir Status_IN = "Asignado" y
//   NoResuelto_IN <> "Cambio de Maquina".
function IncidenteAcciones({
  incidente: i,
  myName,
  onVerObs,
  onRevisar,
  onVerRepuestos,
  onResolver,
  containerClassName,
}: {
  incidente: Incidente;
  myName?: string;
  onVerObs: () => void;
  onRevisar: () => void;
  onVerRepuestos: () => void;
  onResolver: () => void;
  onAnular: () => void;
  // Layout del contenedor de botones. Default = fila desktop (flex-nowrap, alineado a la
  // derecha, sin wrap para que no se pisen). La card mobile pasa un grid 2-col.
  containerClassName?: string;
}) {
  const esMio = !!myName && i.TecnicoAsignado_IN === myName;
  const isRevisarState = i.Status_IN === "A Revisar";
  const isAsignado = i.Status_IN === "Asignado";
  // Default = fila desktop (alineada a la derecha, sin wrap). La card mobile pasa un grid
  // 2-col vía containerClassName; en ese caso los botones llenan su celda y crecen a h-10
  // (touch target). El base de button.tsx ya fuerza `size-4` en los íconos.
  const isMobile = !!containerClassName;
  const container =
    containerClassName ?? "flex items-center justify-end gap-2 flex-nowrap";
  const btnClass = isMobile
    ? "h-10 w-full gap-1.5 px-3 text-xs"
    : "h-9 gap-1.5 px-3 text-xs";

  // En desktop, el botón SECUNDARIO (Observación / Repuestos) es icon-only por debajo de xl
  // para que la fila no se apriete a 125% de zoom; muestra el texto en pantallas anchas (xl+).
  // En mobile (grid) siempre muestra el texto.
  const secLabel = isMobile ? "" : "hidden xl:inline";

  if (isRevisarState && esMio) {
    // A Revisar → ver observación + "Revisar" (popup Continuar / Anular)
    return (
      <div className={container}>
        <Button
          size="sm"
          variant="outline"
          onClick={onVerObs}
          className={btnClass}
          title="Observación"
          aria-label="Observación"
        >
          <MessageSquareText /> <span className={secLabel}>Observación</span>
        </Button>
        <Button size="sm" onClick={onRevisar} className={btnClass}>
          <HelpCircle /> Revisar
        </Button>
      </div>
    );
  }
  if (isAsignado && esMio) {
    // Asignado → "Ver Repuestos" (salvo Cambio de Maquina) + "Resolver".
    const verRepuestos = i.NoResuelto_IN !== "Cambio de Maquina";
    // Si "Resolver" queda solo en el grid mobile, que ocupe el ancho completo (no a medias).
    const resolverClass =
      isMobile && !verRepuestos ? `${btnClass} col-span-2` : btnClass;
    return (
      <div className={container}>
        {verRepuestos ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onVerRepuestos}
            className={btnClass}
            title="Ver repuestos"
            aria-label="Ver repuestos"
          >
            <Package /> <span className={secLabel}>Repuestos</span>
          </Button>
        ) : null}
        <Button size="sm" onClick={onResolver} className={resolverClass}>
          <CheckCircle2 /> Resolver
        </Button>
      </div>
    );
  }
  // Resto de estados (En Aprobacion, ajenos, etc.): PA no ofrece acciones al técnico.
  return null;
}

// Celda principal de la grilla desktop: ícono de edificio a la izquierda, ID en pill arriba,
// edificio + máquina como texto PRINCIPAL y la descripción como SECUNDARIO (clamp a 2 líneas
// para mantener filas escaneables; el texto completo queda en el title/tooltip).
function IncidenteCell({ incidente: i }: { incidente: Incidente }) {
  const desc =
    i.Status_IN === "A Revisar" ? i.DescripcionCarga_IN : i.Descripcion_IN;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
        <Building2 className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/80">
          #{i.IDIncidente}
        </span>
        <p className="mt-1 line-clamp-1 text-sm font-semibold leading-tight">
          <span className="text-primary">{i.NombreEdificio_IN}</span>
          <span className="text-muted-foreground">
            {" · "}
            {i.ConcatMaquina_IN}
          </span>
        </p>
        {desc ? (
          <p
            className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground"
            title={desc}
          >
            {desc}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Card de incidente (mobile). Mantiene exactamente el contenido previo.
function IncidenteCard({
  incidente: i,
  myName,
  onVerObs,
  onRevisar,
  onVerRepuestos,
  onResolver,
  onAnular,
}: {
  incidente: Incidente;
  myName?: string;
  onVerObs: () => void;
  onRevisar: () => void;
  onVerRepuestos: () => void;
  onResolver: () => void;
  onAnular: () => void;
}) {
  const isRevisarState = i.Status_IN === "A Revisar";
  // Mismo gating que IncidenteAcciones: solo "A Revisar" o "Asignado" del técnico
  // muestran botones (el resto de estados no ofrece acciones, paridad PA).
  const esMio = !!myName && i.TecnicoAsignado_IN === myName;
  const hasAcciones =
    esMio && (isRevisarState || i.Status_IN === "Asignado");
  return (
    <Card className="relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${stripeFor(i.Status_IN)}`}
      />
      <CardContent className="space-y-2 p-3 pl-4">
        {/* Top row: avatar + edificio + status */}
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:text-cyan-300">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-primary">
              {i.NombreEdificio_IN}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono font-semibold text-foreground/80">
                #{i.IDIncidente}
              </span>
              <span className="truncate font-medium text-foreground/70">
                {i.ConcatMaquina_IN}
              </span>
            </p>
          </div>
          <StatusBadge status={i.Status_IN} />
        </div>

        {/* Pendiente de revisión (A Revisar) */}
        {isRevisarState ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Pendiente de revisión
          </p>
        ) : null}

        {/* Descripción / observación del reporte */}
        <p className="text-sm leading-snug">
          {isRevisarState ? i.DescripcionCarga_IN : i.Descripcion_IN}
        </p>

        {/* Footer: fecha + tecnico */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="font-medium tabular-nums tracking-tight">
              {i.Fecha_IN}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-foreground/80">
              {i.TecnicoAsignado_IN}
            </span>
          </span>
        </div>

        {/* Acciones por estado */}
        {hasAcciones ? (
          <div className="pt-1">
            <IncidenteAcciones
              incidente={i}
              myName={myName}
              onVerObs={onVerObs}
              onRevisar={onRevisar}
              onVerRepuestos={onVerRepuestos}
              onResolver={onResolver}
              onAnular={onAnular}
              containerClassName="grid grid-cols-2 gap-2"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
