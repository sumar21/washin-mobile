// Fecha/hora en zona horaria de Argentina (Vercel corre en UTC).
import { createRequire } from "node:module";

const TZ = "America/Argentina/Buenos_Aires";

// Versión de la app (PowerApps escribe VarVersion en *_R/*_D/*_HD). Se lee de package.json
// para mantener una única fuente de verdad. createRequire deja que node-file-trace (Vercel)
// incluya el JSON en el bundle de la función. Si por algún motivo no se puede leer, "0.0.0".
function readAppVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const APP_VERSION = readAppVersion();

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

// Nombre del mes en español-AR (PowerApps: Text(Today(),"[$-es-ES]mmmm") → "junio").
// Lo usan los campos denormalizados FechaMes_D (02.Detalles) y FechaMes_HD (14.HorasDescanso).
export function mesNombreAr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    month: "long",
  }).format(d);
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
