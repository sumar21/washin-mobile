import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, User } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/shared/Combobox";
import { PhotoCapture } from "@/components/shared/PhotoCapture";
import { RepuestosPicker } from "@/components/shared/RepuestosPicker";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  getEdificios,
  getDetalleMaquina,
  getIncidente,
  crearIncidenteCompleto,
  resolverIncidente,
  type Incidente,
  type RepuestoUsado,
  type ResolverModo,
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

  // En revisar, precargar máquina actual + categoría del incidente (una vez).
  useEffect(() => {
    if (!isRevisar || !incidente) return;
    if (incidente.IDMaquina_IN && maquinasEdificio.length && !maquina) {
      const m = maquinasEdificio.find(
        (x) => x.IDMaquina_DM === incidente.IDMaquina_IN,
      );
      if (m) setMaquina(String(m.ID));
    }
    if (!categoria && CATEGORIAS.includes(incidente.Categoria_IN)) {
      setCategoria(incidente.Categoria_IN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidente?.ID, maquinasEdificio.length]);

  function changeEstado(v: string) {
    if (v !== "Resuelto" && v !== "NoResuelto") return;
    setEstado(v);
    setModo(v === "Resuelto" ? "Cambio Repuesto" : "Requiere Repuesto");
  }

  const resuelto = estado === "Resuelto";
  const requierePartes =
    modo === "Cambio Repuesto" || modo === "Requiere Repuesto";

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
          Descripcion: descripcion,
          Categoria: categoria,
          concatMaquina: m?.ConcatMaquina_DM,
          idMaquina: m?.IDMaquina_DM,
          nombreEdificio,
          repuestos,
          fotoBase64: resuelto ? (foto ?? undefined) : undefined,
        });
      } else {
        await crearIncidenteCompleto({
          IDMaquina_IN: m?.IDMaquina_DM ?? "",
          ConcatMaquina_IN: m?.ConcatMaquina_DM ?? "",
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

      <div className="mx-auto grid w-full max-w-[1100px] gap-4 px-4 py-4 md:grid-cols-[18rem_1fr] md:px-6 md:py-5">
        {/* Contexto (sticky en desktop) */}
        <aside className="min-w-0 space-y-3 md:sticky md:top-20 md:self-start">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
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
          <CardContent className="space-y-4 p-4 md:p-5">
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
                options={maquinasEdificio.map((m) => ({
                  value: String(m.ID),
                  label: `${m.ConcatMaquina_DM} · N° ${m.NroSerie_DM}`,
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
                onValueChange={(v) => v && setModo(v as ResolverModo)}
                variant="outline"
                className="grid grid-cols-2"
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
                  </>
                )}
              </ToggleGroup>
            </div>

            {/* Repuestos según modo */}
            <RepuestosPicker modo={modo} onChange={setRepuestos} />

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

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => navigate("/incidentes")}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
