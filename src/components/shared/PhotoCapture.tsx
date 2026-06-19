import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoCaptureProps {
  label?: string;
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  className?: string;
}

// Lado máximo (px) al que se redimensiona la imagen manteniendo aspect ratio.
const MAX_SIDE = 1280;
// Calidad de exportación JPEG (~150-300KB por foto típica de cámara).
const JPEG_QUALITY = 0.65;

/**
 * Lee un File como data URL crudo (fallback cuando falla la compresión).
 */
function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Decodifica el File a un bitmap. Usa createImageBitmap si está disponible
 * (más rápido y sin layout), con fallback a un <img> + ObjectURL.
 */
async function decodificarImagen(
  file: File,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Comprime/redimensiona la imagen antes de producir el data URL.
 * Redimensiona a un lado máximo de MAX_SIDE (manteniendo aspect ratio) y
 * exporta como JPEG para reducir drásticamente el payload (evita el 413).
 * Si algo falla, degrada al data URL crudo (comportamiento anterior).
 */
async function comprimirImagen(file: File): Promise<string> {
  // Solo intentamos comprimir imágenes raster; otros tipos van al fallback.
  if (!file.type.startsWith("image/")) {
    return leerComoDataUrl(file);
  }

  let imagen: Awaited<ReturnType<typeof decodificarImagen>> | null = null;
  try {
    imagen = await decodificarImagen(file);

    const { width, height } = imagen;
    if (!width || !height) throw new Error("Dimensiones de imagen inválidas");

    const escala = Math.min(1, MAX_SIDE / Math.max(width, height));
    const destW = Math.max(1, Math.round(width * escala));
    const destH = Math.max(1, Math.round(height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto del canvas");

    // Fondo blanco: JPEG no tiene alfa; evita zonas negras si la fuente es PNG con transparencia.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, destW, destH);
    imagen.draw(ctx, destW, destH);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      throw new Error("Exportación de imagen vacía");
    }
    return dataUrl;
  } catch {
    // Degradación: usamos el data URL crudo como antes.
    return leerComoDataUrl(file);
  } finally {
    imagen?.close();
  }
}

export function PhotoCapture({ label = "Tomar foto", value, onChange, className }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [procesando, setProcesando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcesando(true);
    try {
      const url = await comprimirImagen(file);
      setPreview(url);
      onChange?.(url);
    } catch {
      // Último recurso: si incluso el fallback falla, no actualizamos la foto.
    } finally {
      setProcesando(false);
      // Permite volver a elegir el mismo archivo si se reintenta.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    setPreview(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-lg border">
          <img src={preview} alt="captura" className="h-48 w-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="iconSm"
            className="absolute right-2 top-2"
            onClick={clear}
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={procesando}
        >
          {procesando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              {label}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
