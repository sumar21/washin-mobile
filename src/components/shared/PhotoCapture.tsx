import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  camaraSeLlevoLaApp,
  limpiarMarcaCamara,
  marcarCamaraAbierta,
} from "@/lib/marca-camara";
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
// Tope para leer las dimensiones antes de decodificar (ver medirImagen).
const MEDIR_TIMEOUT_MS = 5_000;

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
 * Dimensiones de la imagen (ya orientadas según EXIF) SIN decodificar los píxeles.
 *
 * Un <img> fuera del DOM expone naturalWidth/naturalHeight en `load` sin hacer el decode completo:
 * el navegador lo difiere hasta que se pinta o se dibuja, y acá nunca se hace ninguna de las dos.
 * Devuelve null si no se pudo leer (formato no soportado, archivo corrupto); el que llama decide.
 */
function medirImagen(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let terminado = false;
    const fin = (r: { width: number; height: number } | null) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      URL.revokeObjectURL(url);
      resolve(r);
    };
    // Si el navegador no dispara ni load ni error, no se cuelga la carga de la foto (y la marca de
    // cámara no queda puesta para siempre): pasados unos segundos se sigue sin medir, o sea con el
    // decode completo de antes.
    const limite = setTimeout(() => fin(null), MEDIR_TIMEOUT_MS);
    img.onload = () =>
      fin(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => fin(null);
    img.src = url;
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
    // Se decodifica YA en el tamaño final. createImageBitmap(file) a secas arma el bitmap a resolución
    // completa antes de que el canvas lo reduzca: una foto de 48 MP son ~190 MB de RGBA, y en un
    // celular con poca memoria eso tira la pestaña DESPUÉS de sacar la foto.
    //
    // Para pedirle al navegador el tamaño justo hay que saber las dimensiones antes de decodificar
    // (medirImagen). Con eso se achica por el LADO LARGO: antes se pasaba siempre resizeWidth, y en
    // una foto vertical —el caso normal, el técnico sostiene el celular parado— 3000x4000 decodificaba
    // a 1280x1707 en vez de 960x1280 (39% más memoria), y una imagen angosta se AGRANDABA. Si el lado
    // largo ya entra en MAX_SIDE, no hay nada que achicar.
    //
    // Si no se pudo medir, se decodifica completo (lo de siempre). El try/catch cubre a los
    // navegadores que rechazan las opciones; los que no las conocen las ignoran sin error.
    const medida = await medirImagen(file);
    let bitmap: ImageBitmap;
    if (medida && Math.max(medida.width, medida.height) > MAX_SIDE) {
      const opciones: ImageBitmapOptions =
        medida.height > medida.width
          ? { resizeHeight: MAX_SIDE, resizeQuality: "medium" }
          : { resizeWidth: MAX_SIDE, resizeQuality: "medium" };
      try {
        bitmap = await createImageBitmap(file, opciones);
      } catch {
        bitmap = await createImageBitmap(file);
      }
    } else {
      bitmap = await createImageBitmap(file);
    }
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

  // Si la imagen no se puede DECODIFICAR, es un error y se propaga (handleFile avisa). Antes caía
  // al data URL crudo: un archivo corrupto quedaba guardado como "foto" con una preview rota, sin
  // ningún aviso. El fallback crudo queda sólo para cuando el decode anduvo y falló la exportación.
  const imagen = await decodificarImagen(file);
  if (!imagen.width || !imagen.height) {
    imagen.close();
    throw new Error("Dimensiones de imagen inválidas");
  }
  try {
    const { width, height } = imagen;

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
    // Decodificó bien pero falló el canvas/la exportación: el archivo es una imagen válida, así que
    // el data URL crudo sí se ve.
    return leerComoDataUrl(file);
  } finally {
    imagen.close();
  }
}

export function PhotoCapture({ label = "Tomar foto", value, onChange, className }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [procesando, setProcesando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Token de la marca de cámara en curso y listener de foco pendiente (ver src/lib/marca-camara.ts).
  const tokenCamaraRef = useRef<string | null>(null);
  const focoPendienteRef = useRef<(() => void) | null>(null);

  // Aviso de "la pestaña se murió con la cámara abierta o procesando la foto". Sólo avisa si la
  // marca la dejó OTRA carga de página: volver a montar el componente sin recargar no cuenta.
  useEffect(() => {
    if (!camaraSeLlevoLaApp()) return;
    toast.warning("La foto no llegó a guardarse", {
      // id estable: si hay dos PhotoCapture en pantalla, un solo aviso.
      id: "camara-se-llevo-la-app",
      description:
        "La app se cerró antes de guardar la foto (al celular le faltó memoria). Volvé a sacarla.",
      duration: 12_000,
    });
  }, []);

  // Cancelación de la cámara: evento nativo `cancel` del <input type="file"> (Chrome 113+,
  // Safari 16.4+). Va por addEventListener porque React 18 no lo expone como prop.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const alCancelar = () => limpiarMarcaCamara(tokenCamaraRef.current ?? undefined);
    el.addEventListener("cancel", alCancelar);
    return () => {
      el.removeEventListener("cancel", alCancelar);
      // Al desmontar no queda un listener de foco colgado de window.
      if (focoPendienteRef.current) window.removeEventListener("focus", focoPendienteRef.current);
    };
  }, []);

  // Sincronía con el prop `value` DESPUÉS del montaje (patrón oficial de React para ajustar
  // estado cuando cambia una prop; sin useEffect, así no hay parpadeo).
  //
  // Antes `value` se leía UNA sola vez, como estado inicial. Con la recuperación de borradores
  // (useBorrador) el padre restaura la foto de IndexedDB unos ms DESPUÉS de montar: con el
  // inicializador solo, la preview quedaba en null y el botón seguía diciendo "Tomar foto"
  // aunque el estado del padre ya tuviera la foto. El técnico volvía a abrir la cámara nativa —
  // que es justo el evento que dispara el descarte de la pestaña que todo esto viene a evitar.
  //
  // Se mantiene el estado interno (en vez de renderizar `value` a secas) porque `value` y
  // `onChange` son props OPCIONALES: un consumidor que no devuelva el valor tendría un
  // componente mudo, sin ningún feedback tras sacar la foto.
  const [valuePrevio, setValuePrevio] = useState(value);
  if (value !== valuePrevio) {
    setValuePrevio(value);
    setPreview(value ?? null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      limpiarMarcaCamara(tokenCamaraRef.current ?? undefined);
      return;
    }
    // La marca NO se borra acá sino al terminar: si la pestaña se muere MIENTRAS se procesa la foto
    // (decodificar una foto grande es lo más pesado del flujo), al recargar igual hay que avisar.
    // Se renueva con token nuevo para que el timer de foco de abrirCamara no la borre en el medio.
    const token = marcarCamaraAbierta();
    tokenCamaraRef.current = token;
    setProcesando(true);
    try {
      const url = await comprimirImagen(file);
      setPreview(url);
      onChange?.(url);
    } catch {
      // Antes este catch era mudo: si fallaban la compresión y el fallback, el técnico volvía de
      // la cámara a un formulario sin foto y sin ninguna explicación.
      toast.error("No se pudo procesar la foto", {
        description: "Probá sacarla de nuevo.",
      });
    } finally {
      limpiarMarcaCamara(token);
      setProcesando(false);
      // Permite volver a elegir el mismo archivo si se reintenta.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function abrirCamara() {
    const token = marcarCamaraAbierta();
    tokenCamaraRef.current = token;
    // Si la app recupera el foco SIN haberse recargado (canceló la cámara, o la foto volvió),
    // esta marca ya no hace falta. Con margen: en Android el foco vuelve antes que el evento
    // change, y si llega una foto handleFile pone una marca nueva que este timer no toca.
    //
    // Un solo listener a la vez: antes cada apertura sin foco agregaba otro y quedaban colgados.
    if (focoPendienteRef.current) window.removeEventListener("focus", focoPendienteRef.current);
    const alVolver = () => {
      focoPendienteRef.current = null;
      setTimeout(() => limpiarMarcaCamara(token), 1500);
    };
    focoPendienteRef.current = alVolver;
    window.addEventListener("focus", alVolver, { once: true });
    inputRef.current?.click();
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
          onClick={abrirCamara}
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
