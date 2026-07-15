// Fix de DATOS (one-off): Torre Huergo quedó con dos códigos de edificio en 08.DetalleMaquina.
// 9 de sus 12 máquinas tienen CodigoEdificio_DM = "C-2276" (el código VIEJO del edificio, que al
// re-codificarse ~oct-2025 se reasignó a Dorrego 1865) mientras su Edificio_DM dice "Torre Huergo".
// Como los pickers de máquina filtran por CÓDIGO, esas 9 eran invisibles en "Revisar incidente" y
// aparecían, contaminando, en el picker de Dorrego 1865. Confirmado por Paul (CEO): las 12 son de
// Torre Huergo.
//
// NO se tocan los incidentes: CodigoEdifcio_IN guarda el código de la ÉPOCA del incidente y era
// correcto cuando se escribió. De eso se encarga el código, no un UPDATE: mismoEdificio()
// (api/_lib/maquinas.ts) desempata por nombre cuando el código no coincide.
//
// Dry-run por defecto. Escribe sólo con --apply. Lee credenciales de .env (raíz).
//   node scripts/fix-codigo-edificio-torre-huergo.mjs           # muestra qué tocaría
//   node scripts/fix-codigo-edificio-torre-huergo.mjs --apply   # patchea + verifica
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

// ponytail: scope explícito y angosto. NO generalizar a "alinear código con nombre" en toda la
// lista: en Costa Rica / El Salvador / Washinn el nombre es abreviado y el código está BIEN.
// El gemelo conocido ("Prima Caballito 4", 1 máquina con C-2052 en vez de C-2502) es otro ticket.
const NOMBRE = "Torre Huergo";
const CODIGO_OK = "C-2800"; // ABM.Edificios: Torre Huergo (ALTA)
const CODIGO_MALO = "C-2276"; // hoy = Dorrego 1865: sus máquinas reales NO se tocan

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = parseEnv(join(root, ".env"));
const TENANT = env.AZURE_TENANT_ID;
const CLIENT_ID = env.AZURE_CLIENT_ID;
const CLIENT_SECRET = env.AZURE_CLIENT_SECRET;
const SITE_ID = env.SHAREPOINT_SITE_ID;

if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SITE_ID) {
  console.error("Faltan variables en .env");
  process.exit(1);
}

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token error ${res.status}`);
  return (await res.json()).access_token;
}

const token = await getToken();
const auth = {
  Authorization: `Bearer ${token}`,
  Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
};
const base = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists`;

async function graphAll(url) {
  const items = [];
  let next = url;
  while (next) {
    const res = await fetch(next, { headers: auth });
    if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
    const page = await res.json();
    items.push(...(page.value ?? []));
    next = page["@odata.nextLink"] ?? null;
  }
  return items;
}

async function listId(displayName) {
  const res = await fetch(`${base}?$select=id,name,displayName&$top=200`, { headers: auth });
  const list = (await res.json()).value.find(
    (l) => l.displayName === displayName || l.name === displayName,
  );
  if (!list) throw new Error(`lista no encontrada: ${displayName}`);
  return list.id;
}

const maqId = await listId("08.DetalleMaquina");
const select = "Edificio_DM,CodigoEdificio_DM,NroSerie_DM,Status_DM";

// Scope por nombre + código malo (sin ids hardcodeados: se re-scopea en cada corrida).
async function pendientes() {
  const items = await graphAll(`${base}/${maqId}/items?$expand=fields($select=${select})&$top=999`);
  return items.filter(
    (it) =>
      (it.fields.Edificio_DM ?? "").trim() === NOMBRE &&
      it.fields.CodigoEdificio_DM === CODIGO_MALO,
  );
}

const items = await pendientes();
console.log(`\n=== 08.DetalleMaquina — ${NOMBRE} ===`);
console.log(`  ${items.length} máquinas con CodigoEdificio_DM="${CODIGO_MALO}" → "${CODIGO_OK}"`);
for (const it of items) {
  console.log(`    item ${it.id}  serie ${it.fields.NroSerie_DM || "(sin serie)"}  ${it.fields.Status_DM ?? ""}`);
}

if (!APPLY) {
  console.log("\nDry run (sin cambios). Correr con --apply para escribir.");
  process.exit(0);
}

for (const it of items) {
  const res = await fetch(`${base}/${maqId}/items/${it.id}/fields`, {
    method: "PATCH",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ CodigoEdificio_DM: CODIGO_OK }),
  });
  console.log(`  item ${it.id}: ${res.ok ? `→ ${CODIGO_OK} ✓` : `ERROR ${res.status} ${await res.text()}`}`);
  if (!res.ok) process.exitCode = 1;
}

// Verificación: después del patch no puede quedar ninguna pendiente.
const quedan = await pendientes();
console.log(`\nVerificación: quedan ${quedan.length} pendientes (esperado 0)`);
if (quedan.length) process.exitCode = 1;
