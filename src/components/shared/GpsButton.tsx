import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onLocation: (coords: { latitude: number; longitude: number }) => void;
  label?: string;
}

export function GpsButton({ onLocation, label = "Detectar ubicación" }: Props) {
  const [loading, setLoading] = useState(false);

  function detect() {
    if (!("geolocation" in navigator)) {
      toast.error("Tu dispositivo no soporta GPS");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        toast.success("Ubicación detectada");
      },
      (err) => {
        setLoading(false);
        toast.error("No se pudo obtener la ubicación", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <Button type="button" variant="outline" onClick={detect} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}
