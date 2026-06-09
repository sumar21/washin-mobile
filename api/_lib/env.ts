// Lee y valida las variables de entorno requeridas por el backend.
// En Vercel se configuran en Project Settings → Environment Variables.
// En local con `vercel dev` se leen del .env de la raíz.

export interface BackendEnv {
  AZURE_TENANT_ID: string;
  AZURE_CLIENT_ID: string;
  AZURE_CLIENT_SECRET: string;
  SHAREPOINT_SITE_ID: string;
  AUTH_SECRET: string;
  // Casilla desde la que se envían los correos (Graph sendMail, requiere scope Mail.Send).
  // Opcional: si falta, el envío server-side queda deshabilitado.
  AZURE_MAIL_FROM: string;
}

let cached: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (cached) return cached;
  const e = process.env;
  const required = {
    AZURE_TENANT_ID: e.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: e.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: e.AZURE_CLIENT_SECRET,
    SHAREPOINT_SITE_ID: e.SHAREPOINT_SITE_ID,
    AUTH_SECRET: e.AUTH_SECRET,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
  cached = {
    ...(required as Omit<BackendEnv, "AZURE_MAIL_FROM">),
    AZURE_MAIL_FROM: e.AZURE_MAIL_FROM ?? "",
  };
  return cached;
}
