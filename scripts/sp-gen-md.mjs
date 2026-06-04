// Genera docs/sharepoint-schema.md a partir de scripts/sp-schema.json (read-only).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const data = JSON.parse(readFileSync(join(__dirname, "sp-schema.json"), "utf8"));

const idToList = new Map(data.lists.map((l) => [l.id, l]));

const TYPE_ES = {
  text: "Texto",
  number: "Número",
  boolean: "Sí/No",
  dateTime: "Fecha/Hora",
  choice: "Opción",
  currency: "Moneda",
  lookup: "Lookup",
  personOrGroup: "Persona/Grupo",
  hyperlinkOrPicture: "Hipervínculo/Imagen",
  calculated: "Calculado",
  geolocation: "Geolocalización",
  unknown: "—",
};

function decode(s) {
  // Decodifica nombres internos tipo Cumplea_x00f1_os -> Cumpleaños
  return (s || "").replace(/_x([0-9a-fA-F]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function colNotes(c) {
  const parts = [];
  if (c.choices?.length) parts.push(`opciones: ${c.choices.map((o) => `\`${o}\``).join(", ")}`);
  if (c.type === "lookup" && c.lookupListId) {
    const t = idToList.get(c.lookupListId);
    parts.push(`→ ${t ? t.displayName : c.lookupListId}${c.lookupColumn ? `.${c.lookupColumn}` : ""}${c.allowMultiple ? " (multi)" : ""}`);
  }
  if (c.type === "text" && c.multiLine) parts.push("multilínea");
  if (c.type === "number" && typeof c.decimals === "number") parts.push(`decimales: ${c.decimals}`);
  if (c.enforceUniqueValues) parts.push("único");
  if (c.indexed) parts.push("indexado");
  if (c.description) parts.push(`_${c.description}_`);
  return parts.join("; ");
}

function listSection(l) {
  const cols = l.columns.filter((c) => c.business);
  const lines = [];
  lines.push(`### ${l.displayName}`);
  lines.push("");
  const meta = [
    `**Nombre interno (Graph):** \`${l.name}\``,
    `**Template:** ${l.template}`,
    `**Columnas de negocio:** ${cols.length}`,
  ];
  if (l.description) meta.push(`**Descripción:** ${l.description}`);
  lines.push(meta.join(" · "));
  lines.push("");
  lines.push("| Interno (Graph) | Display | Tipo | Req | Notas |");
  lines.push("| --- | --- | --- | :-: | --- |");
  for (const c of cols) {
    const disp = decode(c.displayName);
    const notes = colNotes(c).replace(/\|/g, "\\|");
    lines.push(
      `| \`${c.name}\` | ${disp} | ${TYPE_ES[c.type] ?? c.type} | ${c.required ? "✓" : ""} | ${notes} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

// Orden por displayName: numéricas (01..19) primero, luego ABM.*, luego 99.*, luego resto (Usuarios).
function sortKey(l) {
  const n = l.displayName;
  const m = n.match(/^(\d+)\./);
  if (m) return [0, parseInt(m[1], 10), n];
  if (n.startsWith("ABM.")) return [1, 0, n];
  if (n.startsWith("99.")) return [2, 0, n];
  return [3, 0, n];
}

const skip = new Set(["Documentos"]);
const biz = data.lists
  .filter((l) => !l.hidden && !skip.has(l.displayName))
  .sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || String(ka[2]).localeCompare(String(kb[2]));
  });

const usuarios = data.lists.find((l) => l.displayName === "Usuarios");

const out = [];
out.push("# WashInn — Esquema SharePoint (base de datos)");
out.push("");
out.push(
  "> Documento generado por introspección read-only del sitio SharePoint vía Microsoft Graph.",
);
out.push("> Es la **base de datos real** de la app. El backend (Vercel + Graph API) y el front consumen estas listas.");
out.push("");
out.push("## Conexión");
out.push("");
out.push(`- **Sitio:** ${data.site.name} — ${data.site.webUrl}`);
out.push("- **Site ID:** `dfc1fa64-5f15-4d04-9a21-8a93ffa8fa1a` (env `SHAREPOINT_SITE_ID`)");
out.push("- **Auth:** OAuth2 *client credentials* (app registration en Azure AD) — envs `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.");
out.push("- **Token:** `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` con `scope=https://graph.microsoft.com/.default`.");
out.push("- **Listas:** `GET https://graph.microsoft.com/v1.0/sites/{siteId}/lists`");
out.push("- **Ítems:** `GET .../lists/{listId}/items?$expand=fields` — los campos vienen bajo `fields` usando el **nombre interno** de columna (columna *Interno (Graph)* en las tablas).");
out.push("");
out.push("> ⚠️ **Importante:** Graph usa el **nombre interno** de la columna, no el display. Ej.: en *Usuarios* el usuario de login es `field_1` y el password `field_4`, aunque se muestren como *Usuario*/*Password*. Nombres con acentos vienen codificados (ej. `Cumplea_x00f1_os` = *Cumpleaños*).");
out.push("");

// Sección de autenticación destacada
out.push("## 🔐 Autenticación / Login");
out.push("");
out.push("- **Lista:** `Usuarios` (referida como `00.Usuarios`).");
out.push("- **Usuario (user log):** columna interna **`field_1`** (display *Usuario*). Es la combinación de las **3 primeras letras del nombre (primera en mayúscula) + apellido**. Ej.: *Agustín Fernández* → `Agufernandez`.");
out.push("- **Password:** columna interna **`field_4`** (display *Password*).");
out.push("- **Filtro de acceso:** solo usuarios con **`Status`** = `Activo` / `Alta`. Los inactivos no pueden ingresar.");
out.push("- **Rol:** columna `Rol` (define permisos; ver `99.ListaPermisosMobile`).");
if (usuarios) {
  out.push("");
  out.push("**Columnas de `Usuarios`:**");
  out.push("");
  out.push("| Interno (Graph) | Display | Tipo | Notas |");
  out.push("| --- | --- | --- | --- |");
  for (const c of usuarios.columns.filter((c) => c.business)) {
    out.push(`| \`${c.name}\` | ${decode(c.displayName)} | ${TYPE_ES[c.type] ?? c.type} | ${colNotes(c).replace(/\|/g, "\\|")} |`);
  }
}
out.push("");

out.push("## Índice de listas");
out.push("");
for (const l of biz) {
  const anchor = l.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  out.push(`- [${l.displayName}](#${anchor}) — \`${l.name}\``);
}
out.push("");

out.push("## Listas");
out.push("");
out.push(`Total: **${biz.length}** listas de negocio (se omiten librerías de documentos y listas de sistema ocultas).`);
out.push("");
for (const l of biz) out.push(listSection(l));

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "sharepoint-schema.md"), out.join("\n"), "utf8");
console.log(`OK -> docs/sharepoint-schema.md (${biz.length} listas)`);
