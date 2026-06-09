// Servidor de desarrollo para las funciones serverless de /api.
// Sirve cada handler (export default (req,res)) en http://localhost:3000/api/<nombre>.
// El front (Vite) proxya /api a este puerto (ver vite.config.ts).
// Carga las variables desde .env de la raíz (convención estándar).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const PORT = Number(process.env.PORT ?? 3000);

// Cargar env desde .env (raíz); src/.env queda como respaldo por compatibilidad.
for (const envPath of [join(root, ".env"), join(root, "src", ".env")]) {
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown | Promise<unknown>;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const match = url.pathname.match(/^\/api\/([a-zA-Z0-9_-]+)\/?$/);
  if (!match) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    const mod = (await import(`../api/${match[1]}.ts`)) as { default?: Handler };
    if (typeof mod.default !== "function") throw new Error(`/api/${match[1]} sin export default`);
    await mod.default(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    console.error(`[dev-api] /api/${match[1]} ->`, message);
    if (!res.headersSent) {
      res.statusCode = message.includes("no encontr") ? 404 : 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`▶ API dev en http://localhost:${PORT}  (env: ${process.env.SHAREPOINT_SITE_ID ? "ok" : "FALTA"})`);
});
