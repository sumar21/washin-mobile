// Plantillas HTML de los mails de incidentes. Diseño moderno/minimalista, 100% HTML
// (shell en mail-layout.ts). Replican los HtmlViewer del PowerApps
// (docs/powerapps/Src/ScreenMails.pa.yaml): html_inicidenteAnulado + html_IncidenteResuelto_1.
import {
  wrapEmail,
  eyebrow,
  h1,
  p,
  infoBox,
  signature,
  dataTable,
  swapBlock,
} from "./mail-layout.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mail de anulación. PA hardcodea el To (paul.risau); en el backend el destinatario sale de
// 99.ABM_Emails. El cuerpo conserva el saludo "Buen día Paul" tal como PowerApps.
export function htmlIncidenteAnulado(p_: {
  tecnico: string;
  id: number | string;
  observaciones: string;
}): string {
  return wrapEmail(
    eyebrow("Incidente") +
      h1("Incidente anulado") +
      p("Buen día Paul,") +
      p(
        `Te informamos que en el día de hoy, <b>${esc(p_.tecnico)}</b>, ha decidido anular el incidente <b>N° ${esc(p_.id)}</b>.`,
      ) +
      infoBox([
        { label: "Incidente", value: `N° ${esc(p_.id)}` },
        { label: "Técnico", value: esc(p_.tecnico) },
        { label: "Observaciones", value: esc(p_.observaciones) || "—" },
      ]) +
      signature("Sumar"),
    `El incidente N° ${p_.id} fue anulado por ${p_.tecnico}.`,
  );
}

// Mail de incidente resuelto (con tabla de repuestos si los hubo).
export function htmlIncidenteResuelto(p_: {
  id: number | string;
  edificio: string;
  maquina: string;
  idMaquina?: string;
  nroSerie?: string;
  fecha: string; // dd/mm
  hora: string; // HH:mm
  tecnico: string;
  repuestos: { repuesto: string; cantidad: number }[];
}): string {
  const tabla = p_.repuestos.length
    ? p("<b>Repuestos utilizados</b>") +
      dataTable(
        ["Repuesto", "Cantidad"],
        p_.repuestos.map((r) => [esc(r.repuesto), String(esc(r.cantidad))]),
      )
    : "";
  return wrapEmail(
    eyebrow("Incidente") +
      h1("Incidente resuelto") +
      p(
        `El día <b>${esc(p_.fecha)}</b> a las <b>${esc(p_.hora)}</b> hs, se confirma la resolución del <b>Incidente N° ${esc(p_.id)}</b> en el edificio <b>${esc(p_.edificio)}</b>.`,
      ) +
      infoBox([
        { label: "Incidente", value: `N° ${esc(p_.id)}` },
        { label: "Edificio", value: esc(p_.edificio) },
        { label: "Máquina", value: esc(p_.maquina) },
        { label: "ID Máquina", value: esc(p_.idMaquina) || "—" },
        { label: "N° Serie", value: esc(p_.nroSerie) || "—" },
        { label: "Fecha", value: `${esc(p_.fecha)} · ${esc(p_.hora)} hs` },
      ]) +
      tabla +
      signature(p_.tecnico),
    `Incidente N° ${p_.id} resuelto en ${p_.edificio}.`,
  );
}

// Mail de cambio de máquina. Template propio (no htmlIncidenteResuelto): ese muestra UNA sola
// máquina — la retirada — y el destinatario no tenía forma de saber cuál quedó instalada, ni de
// distinguir el mail de una resolución con repuestos. Muestra el swap completo.
export function htmlCambioMaquina(p_: {
  id: number | string;
  edificio: string;
  maquinaVieja: string;
  maquinaNueva: string;
  serieVieja?: string;
  idVieja?: string;
  serieNueva?: string;
  idNueva?: string;
  fecha: string; // dd/mm
  hora: string; // HH:mm
  tecnico: string;
  observaciones?: string;
}): string {
  const obs = esc(p_.observaciones).trim();
  // Serie/ID de cada máquina (— si el lookup en 08.DetalleMaquina no la encontró).
  const serieId = (serie?: string, id?: string) =>
    `Serie: ${esc(serie) || "—"} · ID: ${esc(id) || "—"}`;
  return wrapEmail(
    eyebrow("Incidente") +
      h1("Cambio de máquina realizado") +
      p(
        `El día <b>${esc(p_.fecha)}</b> a las <b>${esc(p_.hora)}</b> hs se ejecutó el cambio de máquina del <b>Incidente N° ${esc(p_.id)}</b> en el edificio <b>${esc(p_.edificio) || "—"}</b>.`,
      ) +
      swapBlock(
        { label: "Máquina retirada", value: esc(p_.maquinaVieja) || "—" },
        { label: "Máquina instalada", value: esc(p_.maquinaNueva) || "—" },
      ) +
      p(
        `La máquina retirada volvió al depósito <b>Wash Inn</b> y quedó disponible en stock.`,
      ) +
      infoBox([
        { label: "Incidente", value: `N° ${esc(p_.id)}` },
        { label: "Edificio", value: esc(p_.edificio) || "—" },
        { label: "Máquina retirada", value: serieId(p_.serieVieja, p_.idVieja) },
        { label: "Máquina instalada", value: serieId(p_.serieNueva, p_.idNueva) },
        { label: "Fecha", value: `${esc(p_.fecha)} · ${esc(p_.hora)} hs` },
        { label: "Técnico", value: esc(p_.tecnico) || "—" },
        ...(obs ? [{ label: "Observaciones", value: obs }] : []),
      ]) +
      signature(p_.tecnico),
    `Incidente N° ${p_.id} · ${p_.maquinaVieja || "—"} → ${p_.maquinaNueva || "—"} en ${p_.edificio}.`,
  );
}
