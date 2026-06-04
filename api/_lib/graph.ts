// Cliente mínimo de Microsoft Graph con token cacheado (client credentials).
// El token se cachea en el scope del módulo: en una lambda "caliente" se reusa
// entre invocaciones hasta ~60s antes de expirar.
import { getEnv } from "./env.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getGraphToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }
  const env = getEnv();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AZURE_CLIENT_ID,
    client_secret: env.AZURE_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Error obteniendo token Graph (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

export async function graph<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getGraphToken();
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status} @ ${url}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// Sigue @odata.nextLink para devolver todos los elementos de una colección.
// `init` (p. ej. headers Prefer) se reaplica en cada página.
export async function graphAll<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T[]> {
  let next: string | null = path;
  const items: T[] = [];
  while (next) {
    const page: { value?: T[]; "@odata.nextLink"?: string } = await graph(next, init);
    if (page.value) items.push(...page.value);
    next = page["@odata.nextLink"] ?? null;
  }
  return items;
}
