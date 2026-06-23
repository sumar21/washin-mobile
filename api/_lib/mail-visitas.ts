// Plantillas HTML de los mails del flujo de Visitas. Diseño moderno/minimalista, 100% HTML
// (shell en mail-layout.ts). Replican los HtmlViewer del PowerApps
// (docs/powerapps/Src/ScreenMails.pa.yaml):
//   HtmlText_Mantenimiento  → mail de mantenimiento al finalizar el checklist.
//   html_visitaCancelada    → mail de cancelación de visita (no se pudo ingresar).
import { wrapEmail, eyebrow, h1, p, infoBox, signature } from "./mail-layout.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mail de "Mantenimiento" que PA envía al finalizar el checklist (btRegistrar.OnSelect).
// PA usa Concat_Edificio_Direccion del edificio; acá pasamos el nombre/dirección que tengamos.
export function htmlMantenimiento(p_: {
  edificio: string;
  direccion?: string;
  fecha: string; // dd/mm/yyyy
  hora: string; // HH:mm
}): string {
  const nombre = p_.direccion
    ? `${esc(p_.edificio)} — ${esc(p_.direccion)}`
    : esc(p_.edificio);
  return wrapEmail(
    eyebrow("Visita · Mantenimiento") +
      h1("Mantenimiento realizado") +
      p(
        `El día <b>${esc(p_.fecha)}</b> a las <b>${esc(p_.hora)}</b> hs, hemos visitado el laundry del edificio para realizar tareas de mantenimiento.`,
      ) +
      infoBox([
        { label: "Edificio", value: nombre },
        { label: "Fecha", value: esc(p_.fecha) },
        { label: "Hora", value: `${esc(p_.hora)} hs` },
      ]) +
      signature("Wash-Inn"),
    `Mantenimiento realizado el ${p_.fecha} a las ${p_.hora} hs.`,
  );
}

// Mail de "Visita | Cancelada" que PA envía al aceptar la cancelación (bt_aceptarCancelar_CV).
export function htmlVisitaCancelada(p_: {
  fecha: string; // dd/mm/yyyy
  hora: string; // HH:mm
  direccion?: string;
  motivo?: string;
}): string {
  const lugar = p_.direccion ? `<b>${esc(p_.direccion)}</b>` : "el edificio";
  const rows = [
    { label: "Fecha", value: esc(p_.fecha) },
    { label: "Hora", value: `${esc(p_.hora)} hs` },
  ];
  if (p_.direccion) rows.unshift({ label: "Dirección", value: esc(p_.direccion) });
  if (p_.motivo) rows.push({ label: "Motivo", value: esc(p_.motivo) });
  return wrapEmail(
    eyebrow("Visita") +
      h1("Visita no realizada") +
      p("Estimados/as,") +
      p(
        `Les informamos que en el día de hoy, <b>${esc(p_.fecha)}</b>, a las <b>${esc(p_.hora)}</b> hs, estuvimos en ${lugar} para realizar las tareas de mantenimiento pero no pudimos ingresar.`,
      ) +
      infoBox(rows) +
      p("Estaremos pasando nuevamente la próxima semana.") +
      signature("Wash Inn System"),
    `No pudimos ingresar el ${p_.fecha}. Volveremos la próxima semana.`,
  );
}
