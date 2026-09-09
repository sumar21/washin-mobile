// Alta de una novedad. Es un ResponsiveDialog (Dialog en desktop / Drawer en mobile), como el
// resto de los modales de la app.
//
// El desplegable de edificios se portalea DENTRO del drawer (`portalContainer`). Si queda fuera
// —que es el default de Radix, a <body>— vaul bloquea el touchmove y la lista abre pero no se
// puede scrollear con el dedo. Sólo se nota con listas largas: acá hay 400+ edificios, mientras
// que los otros comboboxes dentro de drawers tienen 3 o 4 opciones y no tienen nada que scrollear.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Paperclip, X, Camera, Film } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/shared/Combobox";
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

export function DialogNuevaNovedad({
  open,
  onOpenChange,
  onListo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onListo: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [zoom, setZoom] = useState<Adjunto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Nodo del diálogo: es el contenedor del portal del Combobox (ver el comentario de arriba).
  const [contenido, setContenido] = useState<HTMLDivElement | null>(null);

  const { data: edificios = [] } = useQuery({
    queryKey: ["edificios"],
    queryFn: getEdificios,
    enabled: open,
  });

  const opciones = useMemo(
    () =>
      edificios
        .filter((e) => e.Status === "ALTA")
        .map((e) => ({ value: e.Codigo, label: e.Edificio, sublabel: e.Codigo }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [edificios],
  );

  // Las object URL se liberan al desmontar: si no, cada miniatura retiene el archivo entero en
  // memoria y un video son varios MB.
  useEffect(() => {
    return () => {
      for (const a of adjuntos) URL.revokeObjectURL(a.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar.
  }, []);

  function reset() {
    setAdjuntos((prev) => {
      for (const a of prev) URL.revokeObjectURL(a.url);
      return [];
    });
    setCodigo("");
    setDescripcion("");
    setProgreso(null);
    setZoom(null);
  }

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
        ref={setContenido}
        className="p-0"
        desktopClassName="max-w-md rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>Nueva novedad</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Algo del edificio que haya que resolver o comprar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[65dvh] space-y-3 overflow-y-auto px-5 pt-3">
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
              portalContainer={contenido}
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
              className="h-11 w-full md:h-10"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
            >
              <Camera />
              Agregar foto o video
            </Button>

            {adjuntos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {adjuntos.map((a, i) => (
                  <div
                    key={a.url}
                    className="relative overflow-hidden rounded-lg border bg-muted"
                  >
                    {/* Tocar la miniatura la abre en grande: hay que poder verificar que la foto
                        salió bien, no sólo borrarla. */}
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
                            <Film className="h-5 w-5 text-white" />
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

      {/* Vista grande del adjunto, DENTRO de la app. No envuelve todo en un <button>: los
          controles del video no funcionan dentro de un botón. */}
      {zoom && (
        <div
          role="presentation"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
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
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full"
            />
          ) : (
            <img
              src={zoom.url}
              alt={zoom.file.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
