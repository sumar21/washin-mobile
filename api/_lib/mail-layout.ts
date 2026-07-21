// Shell de los correos: moderno, minimalista y 100% HTML/CSS (sin imágenes — los clientes
// como Gmail suelen bloquearlas o recortarlas). Layout de TABLAS con estilos inline (Gmail/
// Outlook ignoran <style> y clases). La marca se arma con tipografía (wordmark) + una barra
// de acento fina. Paleta: neutros slate + UN azul de marca (igual que la app).

import { LOGO_WASHINN } from "./mail-assets.js";

const ACCENT = "#2563eb";
const INK = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const HAIR = "#eaeef3";
const PAGE = "#f4f6fb";
const WIDTH = 600;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Wordmark de marca: logo de Wash-Inn (public/Logoapp.png, base64) + texto al lado.
// Si el cliente bloquea la imagen, el texto "WASH INN SYSTEM" sigue llevando la marca (alt + fallback).
function wordmark(): string {
  const logo =
    `<td width="36" valign="middle" style="width:36px;">` +
    `<img src="${LOGO_WASHINN}" width="36" height="36" alt="Wash-Inn" ` +
    `style="display:block; width:36px; height:36px; border:0; border-radius:9px;" /></td>`;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    logo +
    `<td valign="middle" style="padding-left:11px; font-family:${FONT}; white-space:nowrap;">` +
    `<span style="font-size:15px; font-weight:800; letter-spacing:.3px; color:${INK};">WASH&nbsp;INN</span>` +
    `<span style="font-size:11px; font-weight:600; letter-spacing:3px; color:${ACCENT}; margin-left:7px;">SYSTEM</span>` +
    `</td></tr></table>`
  );
}

// Envuelve el cuerpo (HTML interno: eyebrow + h1 + p + infoBox + tablas + signature).
// `preheader` = texto de preview en la bandeja de entrada (oculto en el cuerpo).
export function wrapEmail(bodyHtml: string, preheader?: string): string {
  const pre = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${PAGE};">${preheader}</div>`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0; padding:0; background-color:${PAGE}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px; max-width:${WIDTH}px; background-color:#ffffff; border:1px solid ${HAIR}; border-radius:14px; overflow:hidden;">
          <tr><td style="height:3px; background-color:${ACCENT}; line-height:3px; font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:30px 40px 8px;">
              ${wordmark()}
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid ${HAIR}; line-height:0; font-size:0;">&nbsp;</div></td></tr>
          <tr>
            <td style="padding:24px 40px 32px; font-family:${FONT}; font-size:15px; line-height:1.65; color:${BODY};">
              ${bodyHtml}
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid ${HAIR}; line-height:0; font-size:0;">&nbsp;</div></td></tr>
          <tr>
            <td style="padding:18px 40px 26px; font-family:${FONT};">
              <div style="font-size:11px; letter-spacing:2px; color:${FAINT}; font-weight:700;">[&nbsp;SUMAR&nbsp;]</div>
              <div style="margin-top:6px; font-size:12px; line-height:1.5; color:${FAINT};">Mensaje automático de Wash-Inn System · Por favor no respondas a este correo.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Helpers de contenido (estilos inline, email-safe) ───────────────────────────

// Eyebrow / kicker: etiqueta chica en mayúsculas sobre el título.
export function eyebrow(text: string): string {
  return `<div style="font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:${ACCENT}; margin:0 0 8px;">${text}</div>`;
}

export function h1(text: string): string {
  return `<h1 style="margin:0 0 16px; font-size:23px; line-height:1.25; color:${INK}; font-weight:700; letter-spacing:-.01em;">${text}</h1>`;
}

export function p(html: string): string {
  return `<p style="margin:0 0 14px; color:${BODY};">${html}</p>`;
}

// Datos clave como lista con hairlines (sin caja pesada): minimalista.
export function infoBox(rows: { label: string; value: string }[]): string {
  const trs = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${HAIR};`;
      return (
        `<tr>` +
        `<td style="${border} padding:11px 16px 11px 0; color:${MUTED}; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; white-space:nowrap; vertical-align:top; width:120px;">${r.label}</td>` +
        `<td style="${border} padding:11px 0; color:${INK}; font-size:14px; font-weight:600; vertical-align:top;">${r.value}</td>` +
        `</tr>`
      );
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 18px; border-collapse:collapse;">${trs}</table>`;
}

export function signature(name: string): string {
  return `<p style="margin:26px 0 0; color:${MUTED}; font-size:14px;">Saludos,</p><p style="margin:3px 0 0; color:${INK}; font-weight:700; font-size:15px;">${name}</p>`;
}

// Bloque de reemplazo "A → B" (cambio de máquina). Apilado vertical con una flecha en el
// medio: side-by-side se rompe en los clientes angostos de mobile. La caja de destino lleva
// el azul de marca; la de origen queda neutra.
export function swapBlock(
  from: { label: string; value: string },
  to: { label: string; value: string },
): string {
  const card = (label: string, value: string, accent: boolean): string =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">` +
    `<tr><td style="padding:12px 16px; background-color:${accent ? "#f5f8ff" : "#f8fafc"}; border:1px solid ${HAIR}; border-left:3px solid ${accent ? ACCENT : FAINT}; border-radius:8px;">` +
    `<div style="font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:${accent ? ACCENT : MUTED};">${label}</div>` +
    `<div style="margin-top:4px; font-size:15px; font-weight:700; color:${INK};">${value}</div>` +
    `</td></tr></table>`;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 18px; border-collapse:collapse;">` +
    `<tr><td>${card(from.label, from.value, false)}</td></tr>` +
    `<tr><td align="center" style="padding:7px 0; font-size:17px; line-height:17px; color:${FAINT};">&#8595;</td></tr>` +
    `<tr><td>${card(to.label, to.value, true)}</td></tr>` +
    `</table>`
  );
}

// Tabla minimalista (encabezado sin relleno, hairlines finas). Para repuestos u otros.
export function dataTable(
  headers: string[],
  rows: string[][],
): string {
  const ths = headers
    .map(
      (h, i) =>
        `<th align="${i === 0 ? "left" : "right"}" style="padding:0 ${i === headers.length - 1 ? "0" : "12px"} 8px ${i === 0 ? "0" : "12px"}; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:${MUTED}; border-bottom:1.5px solid ${INK};">${h}</th>`,
    )
    .join("");
  const trs = rows
    .map(
      (cells) =>
        `<tr>` +
        cells
          .map(
            (c, i) =>
              `<td align="${i === 0 ? "left" : "right"}" style="padding:10px ${i === cells.length - 1 ? "0" : "12px"} 10px ${i === 0 ? "0" : "12px"}; font-size:14px; color:${INK}; border-bottom:1px solid ${HAIR};">${c}</td>`,
          )
          .join("") +
        `</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 6px; border-collapse:collapse;"><tr>${ths}</tr>${trs}</table>`;
}
