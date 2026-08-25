import { useEffect, useMemo, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/shared/Combobox";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { RepuestosPicker } from "@/components/shared/RepuestosPicker";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import { useBorrador } from "@/hooks/use-borrador";
import {
  getEdificios,
  getDetalleMaquina,
  getIncidente,
  crearIncidenteCompleto,
  resolverIncidente,
  concatMaquinaIncidente,
  type Incidente,
  type RepuestoUsado,
  type ResolverModo,
  STATUS_MAQUINA,
  type StatusMaquina,
} from "@/lib/api-client";

const CATEGORIAS = ["Tildado", "Todo Funcionando", "Mecanico", "Placa"];

// Pantalla dedicada de carga/revisión de incidente.
//   /incidentes/nuevo        → modo CREAR (alta completa).
//   /incidentes/:id/revisar  → modo REVISAR (continuar un "A Revisar": patchea el incidente).
export default function ScreenIncidenteForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { id } = useParams();
  const isRevisar = !!id;

  // Incidente a revisar: primero por state (lo pasa la card), fallback a fetch.
  const stateInc = (location.state as { incidente?: Incidente } | null)
    ?.incidente;
  const { data: fetchedInc, isLoading: loadingInc } = useQuery({
    queryKey: ["incidente", id],
    queryFn: () => getIncidente(Number(id)),
    enabled: isRevisar && !stateInc,
  });
  const incidente = stateInc ?? fetchedInc ?? null;

  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });
  const { data: maquinas = [] } = useQuery({
    queryKey: ["detalle-maquina"],
    queryFn: () => getDetalleMaquina(),
  });

  const [edificioCodigo, setEdificioCodigo] = useState(""); // solo modo crear (Codigo único)
  const [maquina, setMaquina] = useState(""); // String(m.ID)
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<"Resuelto" | "NoResuelto">("NoResuelto");
  const [modo, setModo] = useState<ResolverModo>("Requiere Repuesto");
  // Estado en que quedó la máquina. Solo aplica al modo "Cambio de Maquina" y NO puede quedar
  // vacío: gerencia prioriza el reemplazo según esto.
  const [statusMaquina, setStatusMaquina] = useState<StatusMaquina | "">("");
  const [repuestos, setRepuestos] = useState<RepuestoUsado[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  // Edificio efectivo (en revisar viene del incidente; en crear lo elige el usuario por Codigo).
  const codigoEdificio = isRevisar
    ? (incidente?.CodigoEdifcio_IN ?? "")
    : edificioCodigo;
  const nombreEdificio = isRevisar
    ? (incidente?.NombreEdificio_IN ?? "")
    : (edificios.find((e) => e.Codigo === edificioCodigo)?.Edificio ?? "");

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
  const maquinasEdificio = useMemo(
    () =>
      codigoEdificio
        ? maquinas.filter((m) => m.CodigoEdificio_DM === codigoEdificio)
        : [],
    [maquinas, codigoEdificio],
  );

  // Valores que la PRECARGA escribió sola (no los tipeó el técnico). Se guardan para poder
  // distinguir "el formulario se autocompletó" de "el técnico trabajó": ver `tocado` más abajo.
  const precargado = useRef({ maquina: "", categoria: "" });

  // En revisar, precargar máquina actual + categoría del incidente (una vez).
  useEffect(() => {
    if (!isRevisar || !incidente) return;
    if (incidente.IDMaquina_IN && maquinasEdificio.length && !maquina) {
      const m = maquinasEdificio.find(
        (x) => x.IDMaquina_DM === incidente.IDMaquina_IN,
      );
      if (m) {
        precargado.current.maquina = String(m.ID);
        setMaquina(String(m.ID));
      }
    }
    if (!categoria && CATEGORIAS.includes(incidente.Categoria_IN)) {
      precargado.current.categoria = incidente.Categoria_IN;
      setCategoria(incidente.Categoria_IN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidente?.ID, maquinasEdificio.length]);

  // ── Borrador local del formulario ────────────────────────────────────────────────────────
  // Defensa nueva del port (no hay equivalente en PowerApps): `PhotoCapture` abre la cámara
  // NATIVA y el sistema puede descartar la pestaña mientras el técnico saca la foto. Ver
  // hooks/use-borrador.ts.
  //
  // Scoping: el alta y cada revisión son formularios DISTINTOS. El alta usa el id fijo "nuevo"
  // (hay uno solo por técnico a la vez); la revisión, el ID del incidente. Así el borrador de
  // un incidente nunca reaparece en otro.
  const [repuestosRestaurados, setRepuestosRestaurados] = useState<
    RepuestoUsado[] | undefined
  >(undefined);
  // `RepuestosPicker` maneja su propio estado interno. Al DESCARTAR el borrador hay que vaciarlo
  // sí o sí, y no alcanza con cambiar `inicial` (si el borrador no traía repuestos, el prop ya
  // era undefined y no cambiaría nada): se lo remonta con una key.
  const [pickerKey, setPickerKey] = useState(0);
  const sucio =
    (!isRevisar && edificioCodigo !== "") ||
    maquina !== "" ||
    categoria !== "" ||
    descripcion.trim() !== "" ||
    foto !== null ||
    repuestos.length > 0;
  // Trabajo REAL del técnico = `sucio` MENOS lo que la precarga escribió sola. En modo revisar el
  // efecto de arriba setea máquina y categoría en el mismo commit del montaje, o sea ANTES de que
  // la restauración termine de leer la foto de IndexedDB. Si eso contara como "tocado", la guarda
  // anti-pisada de useBorrador abortaría la restauración en silencio y el formulario vacío
  // terminaría pisando el borrador bueno (y borrando su foto). Ver el contrato de `tocado` en
  // hooks/use-borrador.ts.
  const tocado =
    (!isRevisar && edificioCodigo !== "") ||
    (maquina !== "" && maquina !== precargado.current.maquina) ||
    (categoria !== "" && categoria !== precargado.current.categoria) ||
    descripcion.trim() !== "" ||
    foto !== null ||
    repuestos.length > 0;
  const { limpiar: limpiarBorrador } = useBorrador({
    scope: "incidente",
    id: isRevisar ? id : "nuevo",
    valor: {
      edificioCodigo,
      maquina,
      categoria,
      estado,
      modo,
      statusMaquina,
      descripcion,
      repuestos,
    },
    foto,
    sucio,
    tocado,
    descripcion: isRevisar
      ? `Incidente #${incidente?.IDIncidente ?? id}`
      : "Nuevo incidente",
    aplicar: (v, fotoGuardada) => {
      if (!isRevisar) setEdificioCodigo(v.edificioCodigo ?? "");
      setMaquina(v.maquina ?? "");
      setCategoria(v.categoria ?? "");
      setEstado(v.estado ?? "NoResuelto");
      setModo(v.modo ?? "Requiere Repuesto");
      setStatusMaquina(v.statusMaquina ?? "");
      setDescripcion(v.descripcion ?? "");
      setFoto(fotoGuardada);
      // El picker maneja su propio estado: se le pasa la selección para que la siembre.
      setRepuestosRestaurados(v.repuestos?.length ? v.repuestos : undefined);
    },
    descartar: () => {
      if (!isRevisar) setEdificioCodigo("");
      setMaquina("");
      setCategoria("");
      setEstado("NoResuelto");
      setModo("Requiere Repuesto");
      setStatusMaquina("");
      setDescripcion("");
      setFoto(null);
      setRepuestos([]);
      setRepuestosRestaurados(undefined);
      setPickerKey((k) => k + 1);
    },
  });

  function changeEstado(v: string) {
    if (v !== "Resuelto" && v !== "NoResuelto") return;
    setEstado(v);
    setModo(v === "Resuelto" ? "Cambio Repuesto" : "Requiere Repuesto");
    setStatusMaquina("");
  }

  // Cambiar de modo limpia el estado de la máquina: solo tiene sentido en "Cambio de Maquina", y
  // arrastrarlo haría que se escriba StatusMaquina_IN en un incidente que no pide cambio.
  function changeModo(v: string) {
    if (!v) return;
    setModo(v as ResolverModo);
    if (v !== "Cambio de Maquina") setStatusMaquina("");
  }

  const resuelto = estado === "Resuelto";
  const requierePartes =
    modo === "Cambio Repuesto" || modo === "Requiere Repuesto";
  const esCambioMaquina = modo === "Cambio de Maquina";

  async function submit() {
    if (!isRevisar && !codigoEdificio) {
      toast.error("Elegí un edificio");
      return;
    }
    if (isRevisar && !incidente) return;
    if (!maquina) {
      toast.error("Elegí una máquina");
      return;
    }
    if (!categoria) {
      toast.error("Elegí una categoría");
      return;
    }
    // No puede quedar en blanco: es lo que le dice a gerencia con qué urgencia conseguir el
    // reemplazo (una máquina fuera de servicio deja al consorcio sin ese servicio).
    if (esCambioMaquina && !statusMaquina) {
      toast.error("Elegí en qué estado quedó la máquina");
      return;
    }
    if (!descripcion.trim()) {
      toast.error("Agregá una descripción");
      return;
    }
    if (requierePartes && repuestos.length === 0) {
      toast.error("Elegí al menos un repuesto");
      return;
    }
    const m = maquinasEdificio.find((x) => String(x.ID) === maquina);
    setSaving(true);
    try {
      if (isRevisar && incidente) {
        await resolverIncidente({
          id: incidente.ID,
          modo,
          statusMaquina: esCambioMaquina ? (statusMaquina as StatusMaquina) : undefined,
          Descripcion: descripcion,
          Categoria: categoria,
          // Clave UNITARIA (ver concatMaquinaIncidente). Este paso PISA ConcatMaquina_IN, así que
          // mandar la de modelo destruía la identidad de la unidad justo antes del "Resolver",
          // que es el que tiene que mover esa máquina al depósito.
          concatMaquina: m ? concatMaquinaIncidente(m) : undefined,
          idMaquina: m?.IDMaquina_DM,
          nombreEdificio,
          repuestos,
          fotoBase64: resuelto ? (foto ?? undefined) : undefined,
        });
      } else {
        await crearIncidenteCompleto({
          IDMaquina_IN: m?.IDMaquina_DM ?? "",
          // Clave UNITARIA (ver concatMaquinaIncidente): identifica la unidad física, no el modelo.
          ConcatMaquina_IN: m ? concatMaquinaIncidente(m) : "",
          CodigoEdifcio_IN: codigoEdificio,
          NombreEdificio_IN: nombreEdificio,
          categoria,
          modo,
          Descripcion: descripcion,
          repuestos,
          fotoBase64: resuelto ? (foto ?? undefined) : undefined,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      return;
    } finally {
      setSaving(false);
    }
    // Guardado en SharePoint → el borrador ya no sirve.
    limpiarBorrador();
    qc.invalidateQueries({ queryKey: ["incidentes"] });
    qc.invalidateQueries({ queryKey: ["stock-tecnico"] });
    toast.success(
      isRevisar
        ? resuelto
          ? "Incidente resuelto"
          : "Incidente actualizado"
        : "Incidente creado",
    );
    navigate("/incidentes");
  }

  const titulo = isRevisar
    ? `Revisar incidente #${incidente?.IDIncidente ?? id}`
    : "Nuevo incidente";
  const subtitulo = isRevisar
    ? (incidente?.NombreEdificio_IN ?? "")
    : "Carga completa del incidente";

  // En revisar, esperar a tener el incidente.
  if (isRevisar && !incidente) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenHeader className="md:hidden" back="/incidentes" title={titulo} />
        <ModuleHeader title={titulo} back="/incidentes" />
        <div className="flex flex-1 items-center justify-center p-8">
          {loadingInc ? (
            <InlineLoader />
          ) : (
            <p className="text-sm text-muted-foreground">
              No se encontró el incidente.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/incidentes"
        title={titulo}
        subtitle={subtitulo}
      />
      <ModuleHeader title={titulo} subtitle={subtitulo} back="/incidentes" />

      <div className="mx-auto grid w-full max-w-[1100px] gap-4 px-4 py-3 md:grid-cols-[18rem_1fr] md:px-6 md:py-4">
        {/* Contexto (sticky en desktop) */}
        <aside className="min-w-0 space-y-3 md:sticky md:top-20 md:self-start">
          <Card>
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-semibold text-primary">
                  {nombreEdificio || "Elegí un edificio"}
                </span>
              </div>
              {isRevisar && incidente ? (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs tabular-nums">
                      {incidente.Fecha_IN}
                    </span>
                  </div>
                  {incidente.TecnicoAsignado_IN ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">
                        {incidente.TecnicoAsignado_IN}
                      </span>
                    </div>
                  ) : null}
                  {incidente.DescripcionCarga_IN ? (
                    <div className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Observación del reporte
                      </p>
                      <p className="mt-1 text-sm leading-snug">
                        {incidente.DescripcionCarga_IN}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </aside>

        {/* Formulario */}
        <Card className="min-w-0">
          <CardContent className="space-y-4 p-4">
            {/* Edificio: editable solo en crear */}
            {!isRevisar ? (
              <div className="space-y-1.5">
                <Label>Edificio</Label>
                <Combobox
                  value={edificioCodigo}
                  onChange={(v) => {
                    setEdificioCodigo(v);
                    setMaquina("");
                  }}
                  options={edificioOpts}
                  showAll={false}
                  placeholder="Elegir edificio"
                  searchPlaceholder="Buscar edificio…"
                  emptyText="Sin edificios"
                />
              </div>
            ) : null}

            {/* Máquina */}
            <div className="space-y-1.5">
              <Label>Máquina</Label>
              <Combobox
                value={maquina}
                onChange={setMaquina}
                // La serie y el ID van en la SEGUNDA línea, no pegados al final del label: el
                // trigger recorta a una línea, así que antes se comía justo el N° de serie y el
                // técnico no podía verificar contra la chapa qué máquina había elegido.
                options={maquinasEdificio.map((m) => ({
                  value: String(m.ID),
                  label: m.ConcatMaquina_DM,
                  sublabel: [
                    m.NroSerie_DM ? `N° ${m.NroSerie_DM}` : null,
                    m.IDMaquina_DM ? `ID ${m.IDMaquina_DM}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  "),
                }))}
                showAll={false}
                disabled={!codigoEdificio}
                placeholder={
                  codigoEdificio ? "Elegir máquina" : "Elegí un edificio primero"
                }
                searchPlaceholder="Buscar máquina…"
                emptyText="Sin máquinas"
              />
            </div>

            {/* Categoría */}
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <ToggleGroup
                type="single"
                value={categoria}
                onValueChange={(v) => v && setCategoria(v)}
                variant="outline"
                className="grid grid-cols-2"
              >
                {CATEGORIAS.map((c) => (
                  <ToggleGroupItem key={c} value={c} className="text-xs">
                    {c}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <Label>¿Resuelto?</Label>
              <ToggleGroup
                type="single"
                value={estado}
                onValueChange={changeEstado}
                variant="outline"
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="NoResuelto">No resuelto</ToggleGroupItem>
                <ToggleGroupItem value="Resuelto">Resuelto</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Acción */}
            <div className="space-y-1.5">
              <Label>Acción</Label>
              <ToggleGroup
                type="single"
                value={modo}
                onValueChange={changeModo}
                variant="outline"
                // 2 columnas cuando está resuelto (2 opciones) y 1 cuando no (3 opciones): con 3
                // en dos columnas queda una huérfana a mitad de fila, y en 375px los textos no
                // entran sin cortarse.
                className={cn(
                  "grid gap-2",
                  estado === "Resuelto" ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {estado === "Resuelto" ? (
                  <>
                    <ToggleGroupItem value="Cambio Repuesto">
                      Con repuesto
                    </ToggleGroupItem>
                    <ToggleGroupItem value="Resuelto Sin Repuesto">
                      Sin repuesto
                    </ToggleGroupItem>
                  </>
                ) : (
                  <>
                    <ToggleGroupItem value="Requiere Repuesto">
                      Requiere repuesto
                    </ToggleGroupItem>
                    <ToggleGroupItem value="Cambio de Maquina">
                      Cambio de máquina
                    </ToggleGroupItem>
                    {/* El técnico fue, revisó, y el problema no es de la máquina (tablero
                        eléctrico, agua, gas del edificio). No consume repuestos ni pide
                        reemplazo: gerencia la cierra de un click desde el escritorio. */}
                    <ToggleGroupItem value="Problema del Complejo">
                      Problema del complejo
                    </ToggleGroupItem>
                  </>
                )}
              </ToggleGroup>
            </div>

            {/* Estado en que quedó la máquina — SOLO en "Cambio de máquina", y obligatorio.
                Gerencia prioriza el reemplazo con esto: una máquina fuera de servicio deja al
                consorcio sin ese servicio; una funcionando provisoriamente puede esperar. */}
            {esCambioMaquina && (
              <div className="space-y-1.5">
                <Label>
                  ¿Cómo quedó la máquina?{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  value={statusMaquina}
                  onChange={(v) => setStatusMaquina(v as StatusMaquina)}
                  options={STATUS_MAQUINA.map((v) => ({ value: v, label: v }))}
                  showAll={false}
                  placeholder="Elegir estado"
                  searchPlaceholder="Buscar…"
                />
                {!statusMaquina && (
                  <p className="text-xs text-muted-foreground">
                    Requerido: define con qué urgencia se consigue el reemplazo.
                  </p>
                )}
              </div>
            )}

            {/* Repuestos según modo */}
            <RepuestosPicker
              key={pickerKey}
              modo={modo}
              onChange={setRepuestos}
              inicial={repuestosRestaurados}
            />

            {/* Foto (solo si Resuelto, como PowerApps) */}
            {resuelto ? (
              <div className="space-y-1.5">
                <Label>Foto (opcional)</Label>
                <PhotoCapture
                  label="Agregar fotografía"
                  value={foto}
                  onChange={setFoto}
                />
              </div>
            ) : null}

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="desc-inc">Descripción</Label>
              <Textarea
                id="desc-inc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detalle del problema…"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => navigate("/incidentes")}
                disabled={saving}
                className="h-10 sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={saving}
                className="h-10 gap-2 sm:w-auto"
              >
                <CheckCircle2 />
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
