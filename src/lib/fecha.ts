// Helpers de fecha para la UI. SharePoint guarda las fechas como texto en formato AR
// `dd/mm/yyyy`; los <input type="date"> usan ISO `yyyy-mm-dd`. Acá convertimos entre ambos
// y resolvemos "¿ya venció?" para gatear acciones (p. ej. finalizar una ventilación).

const AR_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "dd/mm/yyyy" -> "yyyy-mm-dd" (para el value de un input date). "" si no parsea.
export function arToISO(ar?: string | null): string {
  const m = (ar ?? "").trim().match(AR_RE);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// "yyyy-mm-dd" -> "dd/mm/yyyy" (para guardar en SP). "" si no parsea.
export function isoToAR(iso?: string | null): string {
  const m = (iso ?? "").trim().match(ISO_RE);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

// Date -> "dd/mm/yyyy" (formato en que SharePoint guarda las fechas como texto).
export function dateToAR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// "dd/mm/yyyy" -> Date local a medianoche. null si no parsea.
export function parseAR(ar?: string | null): Date | null {
  const m = (ar ?? "").trim().match(AR_RE);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

// true si la fecha (dd/mm/yyyy) es hoy o anterior. Sirve para habilitar "Finalizar"
// solo cuando la visita programada ya llegó (DateDiff(Today, Fecha) <= 0 de PowerApps).
export function isDueOrPast(ar?: string | null): boolean {
  const d = parseAR(ar);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() <= today.getTime();
}
