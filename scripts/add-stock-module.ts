// Crea (idempotente) la fila del módulo "Stock Tecnico" en 99.ListaPermisosMobile.
// Lee las filas actuales para no duplicar, calcular el Orden y copiar el formato de rol
// de una fila activa existente. Ejecutar: npx tsx scripts/add-stock-module.ts
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

const { resolveListId, getListItems, createItem } = await import("../api/_lib/sharepoint.js");

const L = "99.ListaPermisosMobile";
const MODULO = "Stock Tecnico";

interface PermFields {
  Title?: string;
  Modulo_LPM?: string;
  Orden_LPM?: string;
  Admin_LPM?: string;
  Tecnico_LPM?: string;
  Supervisor_LPM?: string;
  Status_LPP?: string;
}

const listId = await resolveListId(L);
const items = await getListItems<PermFields>(listId, [
  "Title",
  "Modulo_LPM",
  "Orden_LPM",
  "Admin_LPM",
  "Tecnico_LPM",
  "Supervisor_LPM",
  "Status_LPP",
]);

console.log("--- Filas actuales en", L, "---");
for (const it of items) {
  const f = it.fields;
  console.log(
    `[${it.id}] Modulo=${JSON.stringify(f.Modulo_LPM)} Orden=${f.Orden_LPM} Status=${f.Status_LPP} ` +
      `Admin=${JSON.stringify(f.Admin_LPM)} Tecnico=${JSON.stringify(f.Tecnico_LPM)} Supervisor=${JSON.stringify(f.Supervisor_LPM)}`,
  );
}

const existing = items.find(
  (it) => (it.fields.Modulo_LPM ?? "").trim().toLowerCase() === MODULO.toLowerCase(),
);
if (existing) {
  console.log(`\nYa existe la fila "${MODULO}" (id ${existing.id}). No se crea nada.`);
  process.exit(0);
}

// Orden = max actual + 1 (lo deja al final).
const maxOrden = items.reduce((mx, it) => Math.max(mx, Number(it.fields.Orden_LPM ?? 0) || 0), 0);
const orden = maxOrden + 1;

// Plantilla de columnas por rol: copia las de una fila activa existente (la app NO las usa
// para la grilla, pero se replican para mantener el formato real de la lista).
const template = items.find(
  (it) =>
    (it.fields.Status_LPP ?? "").trim().toLowerCase() === "activo" &&
    (it.fields.Modulo_LPM ?? "") !== "Checklist",
);
const roleFields = {
  Admin_LPM: template?.fields.Admin_LPM ?? "SI",
  Tecnico_LPM: template?.fields.Tecnico_LPM ?? "SI",
  Supervisor_LPM: template?.fields.Supervisor_LPM ?? "SI",
};

console.log(
  `\nCreando "${MODULO}" → Orden=${orden}, Status=Activo, rol(${JSON.stringify(roleFields)})` +
    (template ? ` [plantilla de rol: ${template.fields.Modulo_LPM}]` : " [plantilla por defecto]"),
);

const created = await createItem(listId, {
  Title: MODULO,
  Modulo_LPM: MODULO,
  Orden_LPM: String(orden),
  Status_LPP: "Activo",
  ...roleFields,
});

console.log(`OK — fila creada con id ${created.id}.`);
