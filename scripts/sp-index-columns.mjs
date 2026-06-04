// Intenta indexar (indexed:true) las columnas necesarias para los filtros del Home.
// Read+write de schema de columnas vía Graph. Reporta éxito/fallo por columna.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = parseEnv(join(root, "src", ".env"));
const schema = JSON.parse(readFileSync(join(here, "sp-schema.json"), "utf8"));
const site = env.SHAREPOINT_SITE_ID;
const listIdByName = (n) => schema.lists.find((l) => l.displayName === n)?.id;

const TARGETS = {
  "01.Registros": ["Fecha0", "Nombre"],
  "10.Incidentes": ["TecnicoAsignado_IN", "Resuelto_IN"],
  "19.Ventilaciones": ["Asignado_VE", "Estado_VE"],
  "14.HorasDescanso": ["User_HD"],
};

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AZURE_CLIENT_ID,
    client_secret: env.AZURE_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const r = await fetch(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()).access_token;
}

(async () => {
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };
  const base = `https://graph.microsoft.com/v1.0/sites/${site}/lists`;

  for (const [listName, cols] of Object.entries(TARGETS)) {
    const listId = listIdByName(listName);
    console.log(`\n=== ${listName} ===`);
    // map de nombre interno -> { id, indexed }
    const colsRes = await fetch(`${base}/${listId}/columns?$select=id,name,indexed&$top=200`, { headers: auth });
    const colDefs = (await colsRes.json()).value ?? [];
    const byName = new Map(colDefs.map((c) => [c.name, c]));
    for (const name of cols) {
      const def = byName.get(name);
      if (!def) {
        console.log(`  ${name}: NO ENCONTRADA`);
        continue;
      }
      if (def.indexed) {
        console.log(`  ${name}: ya indexada ✓`);
        continue;
      }
      const patch = await fetch(`${base}/${listId}/columns/${def.id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ indexed: true }),
      });
      if (patch.ok) {
        console.log(`  ${name}: INDEXADA ✓`);
      } else {
        const t = await patch.text();
        console.log(`  ${name}: FALLÓ (${patch.status}) ${t.slice(0, 160)}`);
      }
    }
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
