// Plantillas HTML de los mails de incidentes. Replican los HtmlViewer del PowerApps
// (docs/powerapps/Src/ScreenMails.pa.yaml): html_inicidenteAnulado + html_IncidenteResuelto_1.

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mail de anulación (To fijo paul.risau + Bcc desde 99.ABM_Emails, como PowerApps).
export function htmlIncidenteAnulado(p: {
  tecnico: string;
  id: number | string;
  observaciones: string;
}): string {
  return (
    "<html> <body>" +
    "<div display:flex;>" +
    "<p>Buen día Paul,</p>" +
    `<p>Te informamos que en el dia de hoy, <b>${esc(p.tecnico)}</b>, Ha decidido anular el Incidente Nro <b>${esc(p.id)} hs</b></p>` +
    `<p><b> Observaciones: </b>${esc(p.observaciones)}</p>` +
    "<p>Saludos,</p>" +
    "<b>Sumar</b>" +
    "<div></div></div>"
  );
}

// Mail de incidente resuelto (con tabla de repuestos si los hubo).
export function htmlIncidenteResuelto(p: {
  id: number | string;
  edificio: string;
  maquina: string;
  fecha: string; // dd/mm
  hora: string; // HH:mm
  tecnico: string;
  repuestos: { repuesto: string; cantidad: number }[];
}): string {
  const tabla = p.repuestos.length
    ? "<table width='90%' border='1' cellpadding='2' style='border:1px solid gray; border-collapse:collapse; font:roboto; font-size:90%'>" +
      "<tr style='background-color:#3AA0FF'><th><span style='color: white'><center>Repuesto</center></span></th><th><span style='color: white'><center>Cantidad</center></span></th></tr>" +
      p.repuestos
        .map(
          (r) =>
            `<tr><td><center>${esc(r.repuesto)}</center></td><td><center>${esc(r.cantidad)}</center></td></tr>`,
        )
        .join("") +
      "</table>"
    : "";
  return (
    "<html> <body>" +
    "<div display:flex;>" +
    "<p><b>Incidente Resuelto</b></p>" +
    `<p>El día <b>${esc(p.fecha)}</b> a las <b>${esc(p.hora)}</b> hs, se confirma la resolución del <b>Incidente N: ${esc(p.id)}</b> en el edificio <b>${esc(p.edificio)}</b>.</p>` +
    `<p><b>Máquina:</b> ${esc(p.maquina)}</p>` +
    tabla +
    "<p>Saludos,</p>" +
    `<p><b>${esc(p.tecnico)}</b></p>` +
    "<div></div></div>"
  );
}
