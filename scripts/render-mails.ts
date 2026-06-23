/**
 * render-mails.ts — Renderiza, con datos de ejemplo, los 4 correos que la app
 * realmente envía (vía Microsoft Graph `sendMail`) y los guarda como HTML en
 * `/mails`. Usa las MISMAS funciones de plantilla que el backend (api/_lib/*),
 * así que el cuerpo renderizado es fiel byte-a-byte a lo que recibe el destinatario.
 *
 * Uso:  npx tsx scripts/render-mails.ts
 *
 * No envía nada: solo escribe archivos para previsualizar. El envío real ocurre
 * en api/_lib/planificaciones.ts y api/_lib/incidentes.ts (best-effort, vía Graph).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { htmlMantenimiento, htmlVisitaCancelada } from "../api/_lib/mail-visitas.js";
import {
  htmlIncidenteResuelto,
  htmlIncidenteAnulado,
} from "../api/_lib/mail-incidentes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "mails");

interface MailSample {
  slug: string;
  titulo: string;
  modulo: string;
  disparador: string; // cuándo / dónde se dispara (código)
  para: string; // destinatarios (To)
  bcc: string; // copia oculta
  asunto: string;
  plantillaPA: string; // plantilla equivalente en PowerApps (ScreenMails)
  notas: string; // diferencias / observaciones de paridad
  html: string; // cuerpo real renderizado
}

// ── Datos de ejemplo (realistas) ──────────────────────────────────────────────
const EDIFICIO = "Torre Libertador";
const DIRECCION = "Av. del Libertador 4500, CABA";
const FECHA = "23/06/2026";
const HORA = "15:42";
const TECNICO = "Juan Pérez";

const mails: MailSample[] = [
  {
    slug: "01-mantenimiento",
    titulo: "Mantenimiento (visita finalizada)",
    modulo: "Visitas / Checklist",
    disparador:
      "Al finalizar el checklist de una visita — finalizarVisita() en api/_lib/planificaciones.ts (replica btRegistrar.OnSelect de ScreenCheckList).",
    para: "Correo del edificio (fallback: washinn@sumardigital.com.ar)",
    bcc: "MailSumar del módulo «Checklist» (99.ABM_Emails)",
    asunto: `Mantenimiento en ${EDIFICIO} Fecha: ${FECHA}`,
    plantillaPA: "HtmlText_Mantenimiento / HtmlText_Mantenimiento_Gmail",
    notas:
      "Paridad de texto OK. Diseño moderno 100% HTML (sin imágenes): wordmark + barra de acento + lista de datos. Un único cuerpo (no requiere variante Gmail).",
    html: htmlMantenimiento({
      edificio: EDIFICIO,
      direccion: DIRECCION,
      fecha: FECHA,
      hora: HORA,
    }),
  },
  {
    slug: "02-visita-cancelada",
    titulo: "Visita cancelada (no se pudo ingresar)",
    modulo: "Visitas / Edificios",
    disparador:
      "Al cancelar una visita — cancelarVisita() en api/_lib/planificaciones.ts (replica bt_aceptarCancelar_CV de Screen_Edificios).",
    para:
      "Correo del edificio (fallback: washinn@sumardigital.com.ar) + paul.risau@wash-innsystem.com.ar + pablo.tecnico@wash-innsystem.com.ar",
    bcc: "MailSumar del módulo «Checklist» (99.ABM_Emails)",
    asunto: `Visita | Cancelada Fecha: ${FECHA}`,
    plantillaPA:
      "html_visitaCancelada / html_visitaCancelada_Gmail (planificada) y html_visitaCancelada_Espontanea (espontánea)",
    notas:
      "Paridad de texto OK. React AGREGA «Motivo:» (PA no lo incluye). Diseño moderno 100% HTML (sin imágenes). Una sola plantilla cubre visita planificada y espontánea.",
    html: htmlVisitaCancelada({
      fecha: FECHA,
      hora: HORA,
      direccion: DIRECCION,
      motivo: "No había nadie en portería para permitir el ingreso.",
    }),
  },
  {
    slug: "03-incidente-resuelto",
    titulo: "Incidente resuelto",
    modulo: "Incidentes",
    disparador:
      "Al resolver un incidente en modo «Cambio Repuesto» con notificar≠false — resolverIncidente() en api/_lib/incidentes.ts (replica bt_guardarIncidente de Screen_Incidentes).",
    para:
      "Checklist.MailSumar + Incidentes.MailWashinn (99.ABM_Emails)",
    bcc: "Checklist.MailSumar (99.ABM_Emails)",
    asunto: `Incidente Resuelto En: ${EDIFICIO} Fecha: ${FECHA}`,
    plantillaPA: "html_IncidenteResuelto / html_IncidenteResuelto_1",
    notas:
      "Paridad de texto + tabla de repuestos OK. Diseño moderno 100% HTML (sin imágenes). PA tiene además una 2ª tabla para «cambio de máquina» que React no renderiza.",
    html: htmlIncidenteResuelto({
      id: 1234,
      edificio: EDIFICIO,
      maquina: "Lavarropas Drean Next 8.12 — Serie 4521",
      fecha: FECHA.slice(0, 5), // dd/mm
      hora: HORA,
      tecnico: TECNICO,
      repuestos: [
        { repuesto: "Bomba de agua", cantidad: 1 },
        { repuesto: "Correa de transmisión", cantidad: 2 },
      ],
    }),
  },
  {
    slug: "04-incidente-anulado",
    titulo: "Incidente anulado",
    modulo: "Incidentes",
    disparador:
      "Al anular un incidente — anularIncidente() en api/_lib/incidentes.ts (replica bt_anularIncidente de Screen_Incidentes).",
    para:
      "Incidentes.MailWashinn (fallback Incidentes.MailSumar) — NO el hardcode «paul.risau» de PA",
    bcc: "Incidentes.MailSumar (99.ABM_Emails)",
    asunto: "Incidente N: 1234 Anulado",
    plantillaPA: "html_inicidenteAnulado",
    notas:
      "Paridad de texto OK. Diseño moderno 100% HTML (sin imágenes). Conserva el saludo «Buen día Paul» tal como PA; el destinatario sale de 99.ABM_Emails (no hardcode).",
    html: htmlIncidenteAnulado({
      tecnico: TECNICO,
      id: 1234,
      observaciones:
        "Se resolvió sin necesidad de repuesto; el filtro estaba obstruido y se destapó en el lugar.",
    }),
  },
];

// ── Helpers de render ─────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHELL_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         background: #eef2f6; color: #0f172a; padding: 24px; }
  .wrap { max-width: 760px; margin: 0 auto; }
  a { color: #2563eb; }
  .bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .bar .back { font-size:14px; text-decoration:none; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;
          box-shadow: 0 1px 2px rgba(15,23,42,.06); }
  .envelope { padding:18px 20px; border-bottom:1px solid #eef2f6; }
  .envelope h1 { font-size:18px; margin:0 0 4px; }
  .chip { display:inline-block; font-size:11px; font-weight:600; color:#1e40af; background:#dbeafe;
          border-radius:999px; padding:2px 10px; margin-bottom:10px; }
  .meta { width:100%; border-collapse:collapse; font-size:13px; }
  .meta td { padding:4px 0; vertical-align:top; }
  .meta td.k { color:#64748b; width:96px; white-space:nowrap; padding-right:12px; font-weight:600; }
  .meta td.v { color:#0f172a; }
  .body-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8;
                padding:14px 20px 6px; }
  .frame { width:100%; min-height:200px; border:0; border-top:1px solid #eef2f6; background:#fff; padding:8px 4px; }
  .note { font-size:12px; color:#475569; background:#f8fafc; border-top:1px solid #eef2f6;
          padding:12px 20px; }
  .note b { color:#0f172a; }
`;

function previewPage(m: MailSample): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(m.titulo)} — preview</title>
<style>${SHELL_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="bar">
      <a class="back" href="index.html">← Volver al índice</a>
      <span style="font-size:12px;color:#64748b">washin-mobile · preview de correo</span>
    </div>
    <div class="card">
      <div class="envelope">
        <span class="chip">${esc(m.modulo)}</span>
        <h1>${esc(m.titulo)}</h1>
        <table class="meta">
          <tr><td class="k">De</td><td class="v">notificaciones@sumardigital.com.ar</td></tr>
          <tr><td class="k">Para</td><td class="v">${esc(m.para)}</td></tr>
          <tr><td class="k">CCO (Bcc)</td><td class="v">${esc(m.bcc)}</td></tr>
          <tr><td class="k">Asunto</td><td class="v"><b>${esc(m.asunto)}</b></td></tr>
          <tr><td class="k">Disparador</td><td class="v">${esc(m.disparador)}</td></tr>
        </table>
      </div>
      <div class="body-label">Cuerpo del correo (renderizado real)</div>
      <iframe class="frame" title="cuerpo" srcdoc="${esc(m.html)}"
              onload="this.style.height=(this.contentWindow.document.body.scrollHeight+32)+'px'"></iframe>
      <div class="note"><b>Plantilla PowerApps:</b> ${esc(m.plantillaPA)}<br/><b>Paridad:</b> ${esc(m.notas)}</div>
    </div>
  </div>
</body>
</html>`;
}

function indexPage(): string {
  const rows = mails
    .map((m) => {
      const thumb = existsSync(join(OUT, `${m.slug}.png`))
        ? `        <img class="thumb" src="${m.slug}.png" alt="${esc(m.titulo)}" />\n`
        : "";
      return `      <a class="item" href="${m.slug}.html">
${thumb}        <span class="chip">${esc(m.modulo)}</span>
        <span class="t">${esc(m.titulo)}</span>
        <span class="s">${esc(m.asunto)}</span>
      </a>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Correos de washin-mobile — preview</title>
<style>
  ${SHELL_CSS}
  .lead { color:#475569; font-size:14px; line-height:1.6; margin:0 0 20px; }
  .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
  .item { display:block; text-decoration:none; color:inherit; background:#fff;
          border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;
          box-shadow:0 1px 2px rgba(15,23,42,.05); transition:.12s; }
  .item:hover { border-color:#93c5fd; box-shadow:0 2px 10px rgba(37,99,235,.12); }
  .item .thumb { display:block; width:100%; height:240px; object-fit:cover; object-position:top center;
                 border:1px solid #eef2f6; border-radius:8px; margin-bottom:10px; background:#eef2f6; }
  .item .t { display:block; font-weight:600; font-size:15px; margin-top:8px; }
  .item .s { display:block; color:#64748b; font-size:12px; margin-top:2px; }
  h1.top { font-size:22px; margin:0 0 6px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1 class="top">Correos que envía washin-mobile</h1>
    <p class="lead">
      Estos son los <b>4 correos</b> que la app dispara automáticamente (vía Microsoft Graph
      <code>sendMail</code>, casilla <b>notificaciones@sumardigital.com.ar</b>). Cada vista muestra el
      <b>cuerpo real renderizado</b> con datos de ejemplo, más De/Para/Bcc/Asunto y el disparador.
      Generado por <code>scripts/render-mails.ts</code> usando las mismas plantillas del backend
      (<code>api/_lib/mail-visitas.ts</code> y <code>api/_lib/mail-incidentes.ts</code>).
    </p>
    <div class="grid">
${rows}
    </div>
  </div>
</body>
</html>`;
}

// ── Escritura ─────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
for (const m of mails) {
  writeFileSync(join(OUT, `${m.slug}.html`), previewPage(m), "utf8");
  // También el cuerpo crudo, exactamente como se envía:
  writeFileSync(join(OUT, `${m.slug}.email.html`), m.html, "utf8");
}
writeFileSync(join(OUT, "index.html"), indexPage(), "utf8");

console.log(`OK — ${mails.length} correos renderizados en /mails`);
for (const m of mails) console.log(`  · ${m.slug}.html  (+ ${m.slug}.email.html crudo)`);
console.log("  · index.html");
