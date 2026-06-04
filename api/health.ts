// GET /api/health -> verifica conectividad con Graph/SharePoint (sin exponer datos).
import { getSiteInfo } from "./_lib/sharepoint.js";
import { send, type ApiRequest, type ApiResponse } from "./_lib/http.js";

export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const site = await getSiteInfo();
    send(res, 200, { ok: true, site });
  } catch (err) {
    send(res, 502, {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    });
  }
}
