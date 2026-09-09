// Alta de una novedad. Es una PANTALLA y no un diálogo a propósito.
//
// Primero fue un ResponsiveDialog, que en mobile es un Drawer (vaul): el desplegable de edificios
// quedaba adentro y no se podía scrollear con el dedo — vaul captura el touch para arrastrar el
// drawer. No se notaba en los otros comboboxes dentro de drawers porque tienen 3 o 4 opciones;
// este tiene 400+. El alta de incidentes ya resolvía lo mismo siendo una ruta propia
// (ScreenIncidenteForm), así que se sigue ese patrón en vez de pelearse con el drawer.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, X, Camera, Film } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/shared/Combobox";
import {
  getEdificios,
  crearNovedad,
  subirEvidencia,
  MAX_EVIDENCIA_MB,
} from "@/lib/api-client";

const MB = 1024 * 1024;

/** Archivo elegido + su URL local para la miniatura. */
interface Adjunto {
  file: File;
  url: string;
  esVideo: boolean;
}

export default function ScreenNovedadForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [zoom, setZoom] = useState<Adjunto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
  });

  const opciones = useMemo(
    () =>
      edificios
        .filter((e) => e.Status === "ALTA")
        .map((e) => ({ value: e.Codigo, label: e.Edificio, sublabel: e.Codigo }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [edificios],
  );

  // Las object URL de las miniaturas se liberan al desmontar; si no, quedan reteniendo el
  // archivo entero en memoria (un video son varios MB).
  useEffect(() => {
    return () => {
      for (const a of adjuntos) URL.revokeObjectURL(a.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar.
  }, []);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const nuevos: Adjunto[] = [];
    for (const f of Array.from(lista)) {
      // Se corta acá y no al subir: que el técnico se entere ANTES de escribir todo y esperar.
      if (f.size > MAX_EVIDENCIA_MB * MB) {
        toast.error(`"${f.name}" pesa más de ${MAX_EVIDENCIA_MB} MB`, {
          description: "Grabá un video más corto o sacá una foto.",
        });
        continue;
      }
      nuevos.push({
        file: f,
        url: URL.createObjectURL(f),
        esVideo: f.type.startsWith("video/"),
      });
    }
    setAdjuntos((prev) => [...prev, ...nuevos]);
  }

  function quitar(i: number) {
    setAdjuntos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const edificio = opciones.find((e) => e.value === codigo);
      const novedad = await crearNovedad({
        edificio: edificio?.label ?? "",
        codigoEdificio: codigo,
        descripcion: descripcion.trim(),
      });

      // La evidencia se sube DESPUÉS de crear la fila, contra la carpeta de ese id. Si falla, la
      // novedad ya quedó cargada: mejor una novedad sin foto que perderle el texto al técnico.
      if (adjuntos.length) {
        setProgreso(0);
        let hechos = 0;
        for (const a of adjuntos) {
          await subirEvidencia(novedad.id, a.file, (pct) => {
            setProgreso(Math.round(((hechos + pct / 100) / adjuntos.length) * 100));
          });
          hechos++;
        }
      }
      return novedad;
    },
    onSuccess: () => {
      toast.success("Novedad cargada");
      void qc.invalidateQueries({ queryKey: ["novedades"] });
      navigate("/novedades");
    },
    onError: (e) => {
      setProgreso(null);
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    },
  });

  const subiendo = guardar.isPending;
  const puedeGuardar = !!codigo && descripcion.trim().length > 0 && !subiendo;

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader className="md:hidden" back="/novedades" title="Nueva novedad" />
      <ModuleHeader title="Nueva novedad" back="/novedades" />

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-3 md:px-6 md:py-4">
        <div className="space-y-1.5">
          <Label>
            Edificio <span className="text-destructive">*</span>
          </Label>
          <Combobox
            value={codigo}
            onChange={setCodigo}
            options={opciones}
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
            rows={4}
            disabled={subiendo}
          />
        </div>

        <div className="space-y-2">
          <Label>Evidencia</Label>
          {/* capture no se fuerza: el técnico elige cámara o galería según le sirva. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full md:h-10 md:w-auto"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
          >
            <Camera />
            Agregar foto o video
          </Button>

          {adjuntos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {adjuntos.map((a, i) => (
                <div
                  key={a.url}
                  className="group relative overflow-hidden rounded-lg border bg-muted"
                >
                  {/* Tocar la miniatura la abre en grande: antes solo se podía borrar el
                      archivo, sin poder verificar que la foto salió bien. */}
                  <button
                    type="button"
                    onClick={() => setZoom(a)}
                    className="block aspect-square w-full"
                    aria-label={`Ver ${a.file.name}`}
                  >
                    {a.esVideo ? (
                      <>
                        <video
                          src={a.url}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Film className="h-6 w-6 text-white" />
                        </span>
                      </>
                    ) : (
                      <img
                        src={a.url}
                        alt={a.file.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                  {!subiendo && (
                    <button
                      type="button"
                      onClick={() => quitar(i)}
                      aria-label={`Quitar ${a.file.name}`}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                    {(a.file.size / MB).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {adjuntos.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {adjuntos.length} archivo{adjuntos.length === 1 ? "" : "s"} · tocá uno para verlo
            </p>
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

      {/* Barra de acción pegada abajo: en mobile el formulario scrollea y el botón tiene que
          quedar siempre alcanzable con el pulgar. `sticky` y no `fixed` porque el scroll vive
          dentro de <main> (ver AppShell), que es el mismo patrón que usa BottomNav. */}
      <div className="safe-bottom sticky bottom-0 z-20 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur-md md:border-0 md:bg-transparent">
        <div className="mx-auto flex w-full max-w-2xl gap-2 md:justify-end">
          <Button
            variant="outline"
            className="h-11 flex-1 md:h-10 md:flex-none"
            disabled={subiendo}
            onClick={() => navigate("/novedades")}
          >
            Cancelar
          </Button>
          <Button
            className="h-11 flex-1 md:h-10 md:flex-none"
            disabled={!puedeGuardar}
            onClick={() => guardar.mutate()}
          >
            {subiendo ? "Guardando…" : "Cargar novedad"}
          </Button>
        </div>
      </div>

      {/* Vista grande del adjunto. No es un <button> envolviendo todo: los controles del video
          no funcionan dentro de un botón (HTML inválido y el click no llega al <video>). */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoom.file.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setZoom(null)}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {zoom.esVideo ? (
            <video
              src={zoom.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={zoom.url}
              alt={zoom.file.name}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
