/**
 * build-mail-assets.ts — Genera `api/_lib/mail-assets.ts` con el logo de Wash-Inn
 * (public/Logoapp.png) en base64, para embeberlo en el encabezado de los correos.
 *
 * Uso:  npx tsx scripts/build-mail-assets.ts   (re-correr si cambia el logo)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const png = readFileSync(join(ROOT, "public", "Logoapp.png"));
const dataUri = `data:image/png;base64,${png.toString("base64")}`;

const out = `// AUTO-GENERADO por scripts/build-mail-assets.ts — NO editar a mano.
// Logo de Wash-Inn (public/Logoapp.png) en base64, para el encabezado de los correos.
// Re-generar con: npx tsx scripts/build-mail-assets.ts
/* eslint-disable */
export const LOGO_WASHINN = ${JSON.stringify(dataUri)};
`;

writeFileSync(join(ROOT, "api", "_lib", "mail-assets.ts"), out, "utf8");
console.log(`OK — logo embebido (${Math.round(dataUri.length / 1024)} KB base64) en api/_lib/mail-assets.ts`);
