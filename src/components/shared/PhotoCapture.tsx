import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoCaptureProps {
  label?: string;
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  className?: string;
}

export function PhotoCapture({ label = "Tomar foto", value, onChange, className }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPreview(url);
      onChange?.(url);
    };
    reader.readAsDataURL(file);
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
        >
          <Camera className="mr-2 h-4 w-4" />
          {label}
        </Button>
      )}
    </div>
  );
}
