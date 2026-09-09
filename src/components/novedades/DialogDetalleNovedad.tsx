// Detalle de una novedad ya cargada, con su evidencia.
//
// El técnico necesita poder VER lo que subió, no sólo saber que hay un archivo adjunto: en la
// calle sirve para confirmar que la foto salió bien antes de irse del edificio.
//
// La evidencia se pide recién al abrir el detalle: las URLs de descarga que devuelve Graph son de
// vida corta, así que no tiene sentido traerlas con el listado.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, X, Film } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { InlineLoader } from "@/components/shared/LoadingOverlay";
import {
  getEvidenciaNovedad,
  type ArchivoEvidencia,
  type Novedad,
} from "@/lib/api-client";

export function DialogDetalleNovedad({
  novedad,
  onClose,
}: {
  novedad: Novedad | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState<ArchivoEvidencia | null>(null);

  const { data: evidencia = [], isLoading } = useQuery({
    queryKey: ["novedad-evidencia", novedad?.id],
    queryFn: () => getEvidenciaNovedad(novedad!.id),
    enabled: !!novedad && novedad.cantidadEvidencia > 0,
  });

  return (
    <ResponsiveDialog
      open={!!novedad}
      onOpenChange={(o) => {
        if (o) return;
        // Se limpia acá y no en un efecto: el overlay de la vista grande vive FUERA del content,
        // así que sin esto quedaba pegado en pantalla al cerrar el detalle con una foto abierta.
        setZoom(null);
        onClose();
      }}
    >
      <ResponsiveDialogContent
        className="p-0"
        desktopClassName="max-w-md rounded-2xl"
      >
        <ResponsiveDialogHeader className="px-5 pt-5">
          <ResponsiveDialogTitle>
            {novedad?.edificio || novedad?.codigoEdificio}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {novedad?.fecha} · {novedad?.hora}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-3 md:max-h-[70vh] md:flex-none">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {novedad?.descripcion}
          </p>

          {novedad && novedad.cantidadEvidencia > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                Evidencia
              </p>
              {isLoading ? (
                <InlineLoader />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {evidencia.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setZoom(a)}
                      aria-label={`Ver ${a.nombre}`}
                      className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                    >
                      {a.mime.startsWith("video/") ? (
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
                          alt={a.nombre}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ResponsiveDialogContent>

      {/* Vista grande, DENTRO de la app. z-[80] para quedar sobre el drawer (z-50). No envuelve
          todo en un <button>: los controles del video no funcionan dentro de un botón. */}
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
          {zoom.mime.startsWith("video/") ? (
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
              alt={zoom.nombre}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
