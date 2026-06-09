import { useEffect, useState } from "react";

// Estado de conexión del dispositivo (equivalente a `Connection.Connected` de PowerApps).
// Se usa para mostrar el indicador de wifi y para bloquear el guardado del checklist offline.
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
