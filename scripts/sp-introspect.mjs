// Introspección read-only del sitio SharePoint vía Microsoft Graph (client credentials).
// Lee credenciales de .env (raíz). NO imprime el secret. Vuelca JSON a scripts/sp-schema.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function graph(token, url) {
  const full = url.startsWith("http") ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(full, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph ${res.status} @ ${full}: ${await res.text()}`);
  return res.json();
}

async function graphAll(token, url) {
  let next = url;
  const items = [];
  while (next) {
    const page = await graph(token, next);
    items.push(...(page.value ?? []));
    next = page["@odata.nextLink"] ?? null;
  }
  return items;
}

function summarizeColumn(c) {
  // Determina el tipo "real" de la columna SP.
  const typeKey = [
    "text", "number", "boolean", "dateTime", "choice", "currency", "lookup",
    "personOrGroup", "hyperlinkOrPicture", "calculated", "contentApprovalStatus",
    "thumbnail", "term", "geolocation",
  ].find((k) => c[k] !== undefined);
  const detail = {};
  if (typeKey === "choice" && c.choice) detail.choices = c.choice.choices;
  if (typeKey === "number" && c.number) detail.decimals = c.number.decimalPlaces;
  if (typeKey === "lookup" && c.lookup) {
    detail.lookupListId = c.lookup.listId;
    detail.lookupColumn = c.lookup.columnName;
    detail.allowMultiple = c.lookup.allowMultipleValues;
  }
  if (typeKey === "dateTime" && c.dateTime) detail.format = c.dateTime.format;
  if (typeKey === "text" && c.text) detail.multiLine = c.text.allowMultipleLines;
  const SYSTEM_KEEP_OUT = new Set(["ContentType", "Attachments"]);
  const business = !c.readOnly && !SYSTEM_KEEP_OUT.has(c.name);
  return {
    name: c.name,
    displayName: c.displayName,
    type: typeKey ?? "unknown",
    required: !!c.required,
    indexed: !!c.indexed,
    readOnly: !!c.readOnly,
    hidden: !!c.hidden,
    columnGroup: c.columnGroup || undefined,
    enforceUniqueValues: !!c.enforceUniqueValues,
    business,
    description: c.description || undefined,
    ...detail,
  };
}

(async () => {
  const token = await getToken();
  const site = await graph(token, `/sites/${SITE_ID}`);
  const lists = await graphAll(
    token,
    `/sites/${SITE_ID}/lists?$select=id,name,displayName,description,webUrl,list,createdDateTime,lastModifiedDateTime&$top=200`,
  );

  const result = { site: { id: site.id, name: site.displayName, webUrl: site.webUrl }, lists: [] };

  for (const l of lists) {
    const columns = await graphAll(
      token,
      `/sites/${SITE_ID}/lists/${l.id}/columns?$top=200`,
    );
    let itemCount = null;
    try {
      // Conteo aproximado (puede fallar en listas de sistema): pedir 1 item y leer total no está soportado;
      // usamos length de una página grande solo si la lista no es de sistema.
      if (!l.list?.hidden) {
        const items = await graph(
          token,
          `/sites/${SITE_ID}/lists/${l.id}/items?$select=id&$top=1`,
        );
        itemCount = items.value?.length === 0 ? 0 : ">=1";
      }
    } catch {
      itemCount = null;
    }
    result.lists.push({
      id: l.id,
      name: l.name,
      displayName: l.displayName,
      description: l.description || undefined,
      template: l.list?.template,
      hidden: !!l.list?.hidden,
      webUrl: l.webUrl,
      columns: columns.map(summarizeColumn),
    });
  }

  writeFileSync(join(__dirname, "sp-schema.json"), JSON.stringify(result, null, 2), "utf8");

  // Resumen a consola (sin secretos)
  console.log(`Sitio: ${result.site.name}`);
  console.log(`Listas: ${result.lists.length}`);
  for (const l of result.lists) {
    console.log(
      `- ${l.displayName}${l.hidden ? " [hidden]" : ""} (template=${l.template}, cols=${l.columns.length})`,
    );
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
