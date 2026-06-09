// Envío de correos vía Microsoft Graph (sendMail). Requiere permiso de aplicación
// `Mail.Send` en la app de Azure y la casilla emisora en `AZURE_MAIL_FROM`.
// Equivale al Office365Outlook.SendEmailV2 de PowerApps.
import { getGraphToken } from "./graph.js";
import { getEnv } from "./env.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function recipients(addrs?: string | string[]): { emailAddress: { address: string } }[] {
  const list = Array.isArray(addrs) ? addrs : addrs ? [addrs] : [];
  return list
    .map((a) => a.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
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
  const to = recipients(input.to);
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
          bccRecipients: recipients(input.bcc),
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
}
