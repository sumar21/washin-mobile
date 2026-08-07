// FUENTE ÚNICA de la versión de la app. No hay otra: ni package.json (npm exige semver válido y
// "v20260807_1.0.2" no lo es), ni un .json aparte, ni un `define` de Vite.
// La importan las DOS capas:
//   • backend → api/_lib/time.ts la reexporta como APP_VERSION y se escribe en SharePoint.
//   • front   → src/lib/version.ts la reexporta; Vite la inlinea en el bundle del cliente.
//
// ⚠️ Este archivo NO puede importar NADA (ni `node:*`, ni nada del browser) ni tener side effects:
//    lo bundlean el front y el backend por igual. Una constante y nada más.
//    Vive bajo `api/_lib/` (el prefijo `_` hace que Vercel no lo publique como endpoint) para que
//    el backend la resuelva con un import relativo común, sin depender de que node-file-trace
//    arrastre archivos de fuera de `api/`.
//
// ─────────────────────────────────────────────────────────────────────────────
// Formato: v<YYYYMMDD>_<major>.<minor>.<patch>        ejemplo: v20260806_1.0.1
//   YYYYMMDD → fecha de la release (año, mes, día)
//   major    → cambio grande
//   minor    → funcionalidad nueva
//   patch    → +1 en CADA actualización que sale a producción
//
// CÓMO SE BUMPEA: se toca ESTA línea y nada más. Poné la fecha de hoy y subí el número que
// corresponda (lo normal es +1 al patch).
// ─────────────────────────────────────────────────────────────────────────────
export const APP_VERSION = "v20260807_1.0.2";
