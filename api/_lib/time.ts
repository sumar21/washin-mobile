// Fecha/hora en zona horaria de Argentina (Vercel corre en UTC).
const TZ = "America/Argentina/Buenos_Aires";

export function todayAr(): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

export function nowTimeAr(): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// Partes de una fecha en formato AR: dd/mm/yyyy, mm/yyyy y yyyy. Útil para los campos
// denormalizados de fecha que usa PowerApps (Fecha/FechaMesAno/FechaAno).
export function arParts(d: Date): { fecha: string; mesAno: string; ano: string } {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  return { fecha: `${day}/${month}/${year}`, mesAno: `${month}/${year}`, ano: year };
}

// Fecha de "hoy + N días" (para la próxima limpieza calculada con la frecuencia del edificio).
export function plusDaysAr(days: number): {
  fecha: string;
  mesAno: string;
  ano: string;
} {
  return arParts(new Date(Date.now() + days * 86_400_000));
}
