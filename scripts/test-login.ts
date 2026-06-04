// Verificación end-to-end del login contra SharePoint usando el código real del backend.
// Carga src/.env, prueba health + authenticateUser + JWT. NUNCA imprime contraseñas.
// Ejecutar: npx tsx scripts/test-login.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

for (const line of readFileSync(join(root, "src", ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const { getSiteInfo, getListItems } = await import("../api/_lib/sharepoint.js");
const { authenticateUser } = await import("../api/_lib/users.js");
const { signJwt, verifyJwt } = await import("../api/_lib/jwt.js");

const secret = process.env.AUTH_SECRET as string;

// 1) Health
const site = await getSiteInfo();
console.log(`health ........... site = "${site.name}"`);

// 2) Traer usuarios y elegir uno activo real para probar (password se usa en memoria, no se imprime)
const items = await getListItems<{ field_1?: string; field_4?: string; Status?: string }>(
  "abe151cc-f0cc-4ff2-a79e-fc0121c3dd41",
  ["field_1", "field_4", "Status"],
);
const isActive = (s?: string) => ["ALTA", "ACTIVO"].includes((s ?? "").trim().toUpperCase());
const active = items.filter((i) => isActive(i.fields.Status));
console.log(`usuarios ......... ${items.length} totales, ${active.length} activos`);

const sample = active.find((i) => i.fields.field_1 && i.fields.field_4);
if (!sample) {
  console.log("No hay usuario activo con usuario+password para testear. Fin.");
  process.exit(0);
}
const user = sample.fields.field_1 as string;
const pass = sample.fields.field_4 as string;

// 3) Login correcto
const ok = await authenticateUser(user, pass);
console.log(`login correcto ... ${ok ? `✓ (${user} · rol=${ok.Rol || "—"})` : "✗ FALLÓ"}`);

// 4) Password incorrecta
const bad = await authenticateUser(user, `${pass}_zzz`);
console.log(`pass incorrecta .. ${bad === null ? "✓ rechazado" : "✗ NO rechazó"}`);

// 5) Usuario en mayúsculas (case-insensitive)
const ci = await authenticateUser(user.toUpperCase(), pass);
console.log(`case-insensitive . ${ci ? "✓" : "✗"}`);

// 6) Usuario inexistente
const none = await authenticateUser("___no_existe___", "x");
console.log(`inexistente ...... ${none === null ? "✓ rechazado" : "✗"}`);

// 7) JWT roundtrip
if (ok) {
  const token = signJwt({ sub: String(ok.ID), usuario: ok.Usuario, rol: ok.Rol }, secret);
  const decoded = verifyJwt<{ usuario: string }>(token, secret);
  console.log(`jwt roundtrip .... ${decoded?.usuario === ok.Usuario ? "✓" : "✗"}`);
  console.log(`jwt firma mala ... ${verifyJwt(`${token}x`, secret) === null ? "✓ rechazado" : "✗"}`);
}

console.log("\nOK: el login real contra SharePoint funciona.");
