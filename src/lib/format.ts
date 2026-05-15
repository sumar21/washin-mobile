import { format, parse } from "date-fns";
import { es } from "date-fns/locale";

export const todayDdMmYyyy = () => format(new Date(), "dd/MM/yyyy");
export const todayDdMm = () => format(new Date(), "ddMM");
export const fmtTime = () => format(new Date(), "HH:mm");
export const fmtMonthYear = (d = new Date()) => format(d, "MMMM yyyy", { locale: es });

export function parseDdMmYyyy(s: string) {
  return parse(s, "dd/MM/yyyy", new Date());
}

// Genera usuario tipo "marperez" desde nombre y apellido (igual que la app PowerApps).
export function genUsername(nombre: string, apellido: string) {
  return (nombre.slice(0, 3) + apellido).toLowerCase().replace(/\s+/g, "");
}

// Genera password "ddmm" a partir de fecha dd/mm/yyyy (igual que la app PowerApps).
export function genPassword(fechaNac: string) {
  const m = fechaNac.match(/^(\d{2})\/(\d{2})/);
  if (!m) return "0000";
  return `${m[1]}${m[2]}`;
}

export function isValidEmail(s: string) {
  if (!s) return false;
  if (s.includes("@@")) return false;
  if (!s.includes("@")) return false;
  if (s.toLowerCase().endsWith(".con")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
