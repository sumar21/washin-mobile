/**
 * shot-mails.mjs — Captura PNG de cada correo renderizado en /mails (los *.email.html),
 * usando Chrome/Edge en modo headless. Las capturas alimentan las miniaturas del index.
 *
 * Uso (después de render-mails):  node scripts/shot-mails.mjs
 *
 * Es opcional: si no se corre, el index simplemente no muestra miniaturas.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAILS = join(__dirname, "..", "mails");

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error("No se encontró Chrome ni Edge. Se omiten las capturas (el index sigue funcionando sin miniaturas).");
  process.exit(0);
}

const slugs = [
  "01-mantenimiento",
  "02-visita-cancelada",
  "03-incidente-resuelto",
  "04-incidente-anulado",
];

for (const slug of slugs) {
  const src = join(MAILS, `${slug}.email.html`);
  const out = join(MAILS, `${slug}.png`);
  if (!existsSync(src)) continue;
  execFileSync(browser, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=680,800",
    `--screenshot=${out}`,
    `file:///${src.replace(/\\/g, "/")}`,
  ]);
  console.log(`  · ${slug}.png`);
}
console.log("OK — capturas en /mails");
