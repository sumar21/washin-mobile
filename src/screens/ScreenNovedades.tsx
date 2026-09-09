// Novedades del edificio (20.Novedades): lo que hoy los técnicos mandan por WhatsApp —tacho roto,
// sticker despegado, cartelería— para que el back-office lo compre y dé el OK.
//
// NO es un incidente: no toca máquinas ni stock. Si el técnico quiere reportar una falla de
// máquina, va por /incidentes.
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Paperclip,
  X,
  Camera,
  CheckCircle2,
  Clock,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/shared/Combobox";
import { DataTable, CellTitleSubtitle } from "@/components/shared/DataTable";
import { Pill } from "@/components/shared/Pill";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  getEdificios,
  getNovedades,
  crearNovedad,
  subirEvidencia,
  MAX_EVIDENCIA_MB,
  type Novedad,
} from "@/lib/api-client";

const tonoEstado = (e: string) =>
  e === "Resuelto" ? "success" : e === "Anulado" ? "neutral" : "warning";

const iconoEstado = (e: string) =>
  e === "Resuelto" ? CheckCircle2 : e === "Anulado" ? Ban : Clock;

const MB = 1024 * 1024;

export default function ScreenNovedades() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);

  const { data: novedades = [], isLoading } = useQuery({
    queryKey: ["novedades"],
    queryFn: getNovedades,
  });
  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });

  const opcionesEdificio = useMemo(
    () =>
      edificios
        .filter((e) => e.Status === "ALTA")
        .map((e) => ({
          value: e.Codigo,
          label: e.Edificio,
          sublabel: e.Codigo,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [edificios],
  );

  const pendientes = novedades.filter((n) => n.estado === "Pendiente").length;
  const subtitulo = `${novedades.length} ${novedades.length === 1 ? "novedad" : "novedades"}${
    pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : ""
  }`;

  const botonNueva = (
    <Button onClick={() => setAbierto(true)} className="h-10 md:h-9">
      <Plus />
      Nueva novedad
    </Button>
  );

  const vacio = (
    <EmptyState
      icon={Megaphone}
      title="Todavía no cargaste novedades"
      description="Reportá lo que veas en el edificio: un tacho roto, un sticker despegado, cartelería."
      action={botonNueva}
    />
  );

  return (
    <div className="flex h-full w-full flex-col">
      <ScreenHeader
        className="md:hidden"
        back="/home"
        title="Novedades"
        subtitle={subtitulo}
      />
      <ModuleHeader title="Novedades" subtitle={subtitulo}>
        {botonNueva}
      </ModuleHeader>

      <div className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 pb-24 pt-3 md:px-6">
        {/* En mobile el botón va arriba del listado: el header mobile es compacto y no lo lleva. */}
        {novedades.length > 0 && (
          <div className="mb-3 md:hidden">{botonNueva}</div>
        )}

        {isLoading ? (
          <InlineLoader />
        ) : novedades.length === 0 ? (
          vacio
        ) : (
          <>
            {/* MOBILE: cards apiladas */}
            <div className="flex flex-col gap-2 md:hidden">
              {novedades.map((n) => (
                <CardNovedad key={n.id} n={n} />
              ))}
            </div>

            {/* DESKTOP: tabla */}
            <DataTable
              className="hidden md:block"
              data={novedades}
              getRowKey={(n: Novedad) => n.id}
              columns={[
                {
                  key: "edificio",
                  header: "Edificio",
                  primary: true,
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.edificio,
                  cell: (n: Novedad) => (
                    <CellTitleSubtitle
                      title={n.edificio || n.codigoEdificio}
                      subtitle={n.descripcion}
                    />
                  ),
                },
                {
                  key: "evidencia",
                  header: "Evidencia",
                  align: "center",
                  cell: (n: Novedad) =>
                    n.cantidadEvidencia > 0 ? (
                      <Pill tone="neutral">
                        <Paperclip className="h-3 w-3" /> {n.cantidadEvidencia}
                      </Pill>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "fecha",
                  header: "Fecha",
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.id,
                  cell: (n: Novedad) => `${n.fecha} ${n.hora}`,
                },
                {
                  key: "estado",
                  header: "Estado",
                  sortable: true,
                  sortAccessor: (n: Novedad) => n.estado,
                  cell: (n: Novedad) => (
                    <Pill tone={tonoEstado(n.estado)}>{n.estado}</Pill>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>

      <DialogNueva
        open={abierto}
        onOpenChange={setAbierto}
        edificios={opcionesEdificio}
        onListo={() => {
          void qc.invalidateQueries({ queryKey: ["novedades"] });
        }}
      />
    </div>
  );
}

function CardNovedad({ n }: { n: Novedad }) {
  const Icono = iconoEstado(n.estado);
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {n.edificio || n.codigoEdificio}
          </p>
          <p className="text-xs text-muted-foreground">
            {n.fecha} · {n.hora}
          </p>
        </div>
        <Pill tone={tonoEstado(n.estado)}>
          <Icono className="h-3 w-3" />
          {n.estado}
        </Pill>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-snug">
        {n.descripcion}
      </p>
      {n.cantidadEvidencia > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <Pill tone="neutral">
            <Paperclip className="h-3 w-3" /> {n.cantidadEvidencia}
          </Pill>
        </div>
      )}
      {/* La respuesta del back-office: es lo que el técnico vuelve a mirar. */}
      {n.descripcionResuelto && (
        <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">Respuesta:</span> {n.descripcionResuelto}
        </p>
      )}
    </div>
  );
}

function DialogNueva({
  open,
  onOpenChange,
  edificios,
  onListo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  edificios: { value: string; label: string; sublabel?: string }[];
  onListo: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCodigo("");
    setDescripcion("");
    setArchivos([]);
    setProgreso(null);
  }

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos: File[] = [];
    for (const f of Array.from(lista)) {
      // Se corta acá y no al subir: que el técnico se entere ANTES de escribir todo y esperar
      // la subida, no después.
      if (f.size > MAX_EVIDENCIA_MB * MB) {
        toast.error(`"${f.name}" pesa más de ${MAX_EVIDENCIA_MB} MB`, {
          description: "Grabá un video más corto o sacá una foto.",
        });
        continue;
      }
      nuevos.push(f);
    }
    setArchivos((prev) => [...prev, ...nuevos]);
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const edificio = edificios.find((e) => e.value === codigo);
      const novedad = await crearNovedad({
        edificio: edificio?.label ?? "",
        codigoEdificio: codigo,
        descripcion: descripcion.trim(),
      });

      // La evidencia se sube DESPUÉS de crear la fila, contra la carpeta de ese id. Si falla, la
      // novedad ya quedó cargada: mejor una novedad sin foto que perderle el texto al técnico.
      if (archivos.length) {
        setProgreso(0);
        let hechos = 0;
        for (const f of archivos) {
          await subirEvidencia(novedad.id, f, (pct) => {
            setProgreso(Math.round(((hechos + pct / 100) / archivos.length) * 100));
          });
          hechos++;
        }
      }
      return novedad;
    },
    onSuccess: () => {
      toast.success("Novedad cargada");
      reset();
      onOpenChange(false);
      onListo();
    },
    onError: (e) => {
      setProgreso(null);
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    },
  });

  const subiendo = guardar.isPending;
  const puedeGuardar = !!codigo && descripcion.trim().length > 0 && !subiendo;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        if (subiendo) return; // no cerrar a mitad de una subida
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <ResponsiveDialogContent
        className="p-0"
        desktopClassName="max-w-md rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>Nueva novedad</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Algo del edificio que haya que resolver o comprar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-3 px-5 pt-3">
          <div className="space-y-1.5">
            <Label>
              Edificio <span className="text-destructive">*</span>
            </Label>
            <Combobox
              value={codigo}
              onChange={setCodigo}
              options={edificios}
              showAll={false}
              placeholder="Elegir edificio"
              searchPlaceholder="Buscar edificio…"
              emptyText="Sin edificios"
              disabled={subiendo}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Novedad <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: el tacho del lavadero está roto"
              rows={3}
              disabled={subiendo}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Evidencia</Label>
            {/* capture no se fuerza: el técnico elige cámara o galería según le sirva. */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                agregarArchivos(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full md:h-10"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
            >
              <Camera />
              Agregar foto o video
            </Button>
            {archivos.length > 0 && (
              <ul className="space-y-1 pt-1">
                {archivos.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {(f.size / MB).toFixed(1)} MB
                    </span>
                    {!subiendo && (
                      <button
                        type="button"
                        aria-label={`Quitar ${f.name}`}
                        onClick={() =>
                          setArchivos((p) => p.filter((_, j) => j !== i))
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {progreso !== null && (
            <div className="space-y-1">
              <Progress value={progreso} />
              <p className="text-center text-xs text-muted-foreground">
                Subiendo evidencia… {progreso}%
              </p>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="gap-2 px-5 pb-5 pt-4">
          <Button
            variant="outline"
            className="h-11 md:h-10"
            disabled={subiendo}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            className="h-11 md:h-10"
            disabled={!puedeGuardar}
            onClick={() => guardar.mutate()}
          >
            {subiendo ? "Guardando…" : "Cargar novedad"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
