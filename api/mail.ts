// /api/mail — envío de correos vía Graph (sendMail).
//   GET            -> { enabled: boolean }   (si el envío server-side está configurado)
//   POST { to, subject, html, bcc? } -> { ok: true }
import { sendMail, mailEnabled } from "./_lib/mail.js";
import {
  getAuth,
  readJsonBody,
  send,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const auth = getAuth(req);
  if (!auth) {
    send(res, 401, { error: "No autorizado" });
    return;
  }
  try {
    if (req.method === "GET") {
      send(res, 200, { enabled: mailEnabled() });
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody<{
        to?: string | string[];
        subject?: string;
        html?: string;
        bcc?: string | string[];
      }>(req);
      if (!body.to || !body.subject?.trim() || !body.html?.trim()) {
        send(res, 400, { error: "Faltan destinatario, asunto o cuerpo" });
        return;
      }
      await sendMail({
        to: body.to,
        subject: body.subject,
        html: body.html,
        bcc: body.bcc,
      });
      send(res, 200, { ok: true });
      return;
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (err) {
    console.error("[mail] error:", err instanceof Error ? err.message : err);
    send(res, 502, {
      error: err instanceof Error ? err.message : "Error enviando el correo",
    });
  }
}
