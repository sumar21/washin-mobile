// Geolocalización para verificar que el técnico está en el edificio.
// PowerApps usaba un bounding-box sobre coordenadas redondeadas (|Δlat|<0.001 && |Δlng|<0.001),
// que es un cuadrado asimétrico y poco intuitivo. Acá usamos distancia real (haversine) con un
// radio en metros — más correcto y fácil de razonar ("estás a X m del edificio").
export interface LatLng {
  lat: number;
  lng: number;
}

// Radio (m) dentro del cual se considera que estás en el edificio. Generoso por el GPS de celular.
export const RADIO_VISITA_M = 150;

export function distanciaMetros(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // radio terrestre en metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Distancia mínima a cualquiera de los puntos registrados del edificio (soporta 2 pares).
// null si el edificio no tiene coordenadas válidas.
export function distanciaAEdificio(pos: LatLng, puntos: LatLng[]): number | null {
  const ds = puntos
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => distanciaMetros(pos, p));
  return ds.length ? Math.min(...ds) : null;
}

// Posición actual del dispositivo (promisificado, con mensajes claros).
export function posicionActual(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Tu dispositivo no tiene GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Permiso de ubicación denegado"
              : "No se pudo obtener tu ubicación",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

// Parsea una coordenada que puede venir como número o texto (SharePoint a veces guarda texto con coma).
export function parseCoord(v?: string | number | null): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
