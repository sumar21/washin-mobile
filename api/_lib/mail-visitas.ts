// Plantillas HTML de los mails del flujo de Visitas. Replican (en versión limpia/legible)
// los HtmlViewer del PowerApps (docs/powerapps/Src/ScreenMails.pa.yaml):
//   HtmlText_Mantenimiento  → mail de mantenimiento al finalizar el checklist.
//   html_visitaCancelada    → mail de cancelación de visita (no se pudo ingresar).

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mail de "Mantenimiento" que PA envía al finalizar el checklist (btRegistrar.OnSelect).
// PA usa Concat_Edificio_Direccion del edificio; acá pasamos el nombre/dirección que tengamos.
export function htmlMantenimiento(p: {
  edificio: string;
  direccion?: string;
  fecha: string; // dd/mm/yyyy
  hora: string; // HH:mm
}): string {
  const nombre = p.direccion ? `${esc(p.edificio)} - ${esc(p.direccion)}` : esc(p.edificio);
  return (
    "<html><body>" +
    "<p><b>Mantenimiento</b></p>" +
    `<p>El día <b>${esc(p.fecha)}</b> a las <b>${esc(p.hora)}</b> hs, hemos visitado el laundry del edificio <b>${nombre}</b> para realizar tareas de mantenimiento.</p>` +
    "<p>Saludos,</p>" +
    "<p><b>Wash-Inn</b></p>" +
    "</body></html>"
  );
}

// Mail de "Visita | Cancelada" que PA envía al aceptar la cancelación (bt_aceptarCancelar_CV).
export function htmlVisitaCancelada(p: {
  fecha: string; // dd/mm/yyyy
  hora: string; // HH:mm
  direccion?: string;
  motivo?: string;
}): string {
  const lugar = p.direccion ? `<b>${esc(p.direccion)}</b>` : "el edificio";
  return (
    "<html><body>" +
    "<p>Estimados/as,</p>" +
    `<p>Les informamos que en el día de hoy, <b>${esc(p.fecha)}</b>, a las <b>${esc(p.hora)}</b> hs, estuvimos en ${lugar} para realizar las tareas de mantenimiento pero no pudimos ingresar.</p>` +
    (p.motivo ? `<p><b>Motivo:</b> ${esc(p.motivo)}</p>` : "") +
    "<p>Estaremos pasando nuevamente la próxima semana.</p>" +
    "<p>Saludos,</p>" +
    "<p><b>Wash Inn System</b></p>" +
    "</body></html>"
  );
}
