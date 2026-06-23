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

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// "dd/mm/yyyy" -> "mm/yyyy" (clave de mes-año para agrupar/filtrar). "" si no parsea.
export function arToMesAno(ar?: string | null): string {
  const m = (ar ?? "").trim().match(AR_RE);
  if (!m) return "";
  const [, , mo, y] = m;
  return `${mo.padStart(2, "0")}/${y}`;
}

// "mm/yyyy" -> "Junio 2026" (etiqueta legible). Devuelve la entrada si no parsea.
export function mesAnoLabel(mmYyyy: string): string {
  const m = (mmYyyy ?? "").trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return mmYyyy;
  return `${MESES[Number(m[1]) - 1] ?? m[1]} ${m[2]}`;
}

// Claves "mm/yyyy" de los últimos n meses (incluye el actual), más reciente primero.
export function lastNMonths(n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  const y = from.getFullYear();
  const m = from.getMonth(); // 0-based
  for (let i = 0; i < n; i++) {
    const d = new Date(y, m - i, 1);
    out.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
  }
  return out;
}

// Orden cronológico de claves "mm/yyyy" (descendente = más reciente primero).
export function compareMesAnoDesc(a: string, b: string): number {
  const key = (s: string) => {
    const m = s.match(/^(\d{1,2})\/(\d{4})$/);
    return m ? Number(m[2]) * 100 + Number(m[1]) : 0;
  };
  return key(b) - key(a);
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
