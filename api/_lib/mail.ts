// Envío de correos vía Microsoft Graph (sendMail). Requiere permiso de aplicación
// `Mail.Send` en la app de Azure y la casilla emisora en `AZURE_MAIL_FROM`.
// Equivale al Office365Outlook.SendEmailV2 de PowerApps.
import { getGraphToken } from "./graph.js";
import { getEnv } from "./env.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Normaliza a lista de direcciones sueltas. 99.ABM_Emails guarda varias separadas por ";" o ",".
export function direcciones(addrs?: string | string[]): string[] {
  const list = Array.isArray(addrs) ? addrs : addrs ? [addrs] : [];
  return list
    .flatMap((a) => a.split(/[;,]/))
    .map((a) => a.trim())
    .filter(Boolean);
}

export function recipients(addrs?: string | string[]): { emailAddress: { address: string } }[] {
  return direcciones(addrs).map((address) => ({ emailAddress: { address } }));
}

// REGLA FIJA DEL PROYECTO — nuestras casillas van SIEMPRE en BCC, nunca visibles en el To.
// Vale para TODOS los mails de la app y para los que se agreguen en el futuro: por eso se aplica
// acá, en el único punto por donde pasan todos, y no en cada armador de mail.
// Se decide por DOMINIO y no por una lista de direcciones, así una casilla nueva de Sumar queda
// cubierta sola. La app manda a consorcios y a Wash Inn; que vean nuestras direcciones internas
// en el encabezado no aporta y expone a quién le llega cada aviso.
const DOMINIO_INTERNO = "sumardigital.com.ar";

const esInterna = (addr: string): boolean =>
  addr.toLowerCase().endsWith(`@${DOMINIO_INTERNO}`);

const dedup = (addrs: string[]): string[] => {
  const vistas = new Set<string>();
  return addrs.filter((a) => {
    const k = a.toLowerCase();
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
};

/**
 * Mueve nuestras direcciones del To al BCC. Exportada para poder testearla sin red.
 * Si TODOS los destinatarios son internos no se mueve nada: un mail sin To no se puede enviar
 * (y ahí no hay a quién ocultarle la dirección, que es lo único que motiva la regla).
 */
export function repartirDestinatarios(
  to?: string | string[],
  bcc?: string | string[],
): { to: string[]; bcc: string[] } {
  const listaTo = dedup(direcciones(to));
  const externas = listaTo.filter((a) => !esInterna(a));
  if (externas.length === 0) {
    return { to: listaTo, bcc: dedup(direcciones(bcc)) };
  }
  const internas = listaTo.filter(esInterna);
  const finalBcc = dedup([...direcciones(bcc), ...internas])
    // Sin repetir a alguien que ya está visible en el To.
    .filter((a) => !externas.some((e) => e.toLowerCase() === a.toLowerCase()));
  return { to: externas, bcc: finalBcc };
}

export function mailEnabled(): boolean {
  return !!getEnv().AZURE_MAIL_FROM;
}

export async function sendMail(input: {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
}): Promise<void> {
  const from = getEnv().AZURE_MAIL_FROM;
  if (!from) {
    throw new Error("Envío de mail no configurado (falta AZURE_MAIL_FROM)");
  }
  // Nuestras casillas pasan al BCC acá, no en cada armador (ver `repartirDestinatarios`).
  const reparto = repartirDestinatarios(input.to, input.bcc);
  const to = recipients(reparto.to);
  if (to.length === 0) throw new Error("Falta el destinatario");

  const token = await getGraphToken();
  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "HTML", content: input.html },
          toRecipients: to,
          bccRecipients: recipients(reparto.bcc),
        },
        saveToSentItems: true,
      }),
    },
  );
  // sendMail responde 202 Accepted sin cuerpo.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Graph sendMail ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }
  // Log de confirmación (visible en Vercel): permite verificar qué mail salió y a quién.
  console.log(
    `[mail] enviado → ${reparto.to.join(", ")}` +
      (reparto.bcc.length ? ` | bcc: ${reparto.bcc.join(", ")}` : "") +
      ` | ${input.subject}`,
  );
}
