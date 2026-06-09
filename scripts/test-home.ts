// Verifica la lógica del Home contra SharePoint real (sin imprimir secretos).
// Ejecutar: npx tsx scripts/test-home.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const { buildHome } = await import("../api/_lib/home.js");
const { getActiveBreak } = await import("../api/_lib/break.js");

console.log("--- HOME admin (global) ---");
try {
  const admin = await buildHome({ rol: "Admin", usuario: "(admin)", nombre: "(admin)" });
  console.log("kpis:", JSON.stringify(admin.kpis));
  console.log("modulos:", admin.modulos.map((m) => m.Modulo_LPM).join(", "));
  console.log("registros hoy:", admin.registros.length, admin.registros[0] ? JSON.stringify(admin.registros[0]) : "");
} catch (e) {
  console.log("ERROR admin:", (e as Error).message);
}

console.log("\n--- HOME tecnico (scoped: Bassi, Matias) ---");
try {
  const tec = await buildHome({ rol: "Tecnico", usuario: "basmatias", nombre: "Bassi, Matias" });
  console.log("kpis:", JSON.stringify(tec.kpis));
  console.log("modulos:", tec.modulos.map((m) => m.Modulo_LPM).join(", "));
} catch (e) {
  console.log("ERROR tecnico:", (e as Error).message);
}

console.log("\n--- BREAK (solo lectura del activo) ---");
try {
  console.log("activo (Bassi, Matias):", JSON.stringify(await getActiveBreak("Bassi, Matias")));
} catch (e) {
  console.log("ERROR break GET:", (e as Error).message);
}
