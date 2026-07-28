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
  // Qué se llegó a escribir del swap (lo devuelve ejecutarCambioMaquina).
  //   instalada → la fila de la NUEVA pasó a INSTALADA en el edificio del incidente.
  //   deposito  → la fila de la VIEJA pasó a DEPOSITO / Wash Inn.
  //   stock     → el stock general (04.Stock) quedó correcto.
  // OPCIONAL a propósito: si no viene, el mail NO afirma nada sobre instalación, depósito ni stock.
  // El modo de falla de un llamador que se olvide de pasarlo tiene que ser "no dice nada", nunca
  // "afirma sin saber". `instalada` es opcional aparte, por los llamadores viejos.
  movimiento?: { instalada?: boolean; deposito: boolean; stock: boolean };
}): string {
  const obs = esc(p_.observaciones).trim();
  // Serie/ID de cada máquina (— si el lookup en 08.DetalleMaquina no la encontró).
  const serieId = (serie?: string, id?: string) =>
    `Serie: ${esc(serie) || "—"} · ID: ${esc(id) || "—"}`;
  // Destino de la retirada. Antes era una frase FIJA que aseguraba el regreso al depósito aunque
  // no se hubiera movido nada (cuando no se identifica la unidad, no se toca 08 ni 04 a propósito).
  const destino = (): string => {
    const m = p_.movimiento;
    if (!m) return ""; // sin dato → no se afirma nada
    if (!m.deposito) {
      return p(
        `<b>ATENCIÓN:</b> no se pudo identificar la máquina retirada en el parque, ` +
          `así que <b>no se movió al depósito</b> ni se acreditó en stock. ` +
          `Hay que darle salida a mano desde el escritorio.`,
      );
    }
    if (!m.stock) {
      return p(
        `La máquina retirada se envió al depósito <b>Wash Inn</b>, pero ` +
          `<b>no se pudo actualizar el stock</b>: hay que ajustarlo a mano desde el escritorio.`,
      );
    }
    return p(
      `La máquina retirada volvió al depósito <b>Wash Inn</b> y quedó disponible en stock.`,
    );
  };
  // Caso simétrico: la unidad de reemplazo tampoco se identificó, así que el edificio quedó SIN esa
  // máquina en el parque. Se avisa aparte del destino de la retirada (los dos pueden fallar juntos).
  const instalacion = (): string => {
    if (p_.movimiento?.instalada !== false) return ""; // sin dato o instalada → nada que avisar
    return p(
      `<b>ATENCIÓN:</b> no se pudo identificar la máquina de reemplazo en el parque, ` +
        `así que <b>no quedó registrada en el edificio</b>. ` +
        `Hay que instalarla a mano desde el escritorio.`,
    );
  };
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
      instalacion() +
      destino() +
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
