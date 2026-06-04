// Helpers HTTP agnósticos al runtime (funcionan sobre el ServerResponse base de Node,
// que Vercel extiende). Evita depender de tipos de @vercel/node.
import type { IncomingMessage, ServerResponse } from "node:http";
import { getEnv } from "./env.js";
import { verifyJwt } from "./jwt.js";

export type ApiRequest = IncomingMessage & { body?: unknown; method?: string };
export type ApiResponse = ServerResponse;

export interface SessionClaims {
  sub: string;
  usuario: string;
  rol: string;
  nombre: string;
}

// Lee y verifica el JWT del header Authorization. Devuelve null si falta/inválido.
export function getAuth(req: ApiRequest): SessionClaims | null {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) return null;
  return verifyJwt<SessionClaims>(header.slice(7), getEnv().AUTH_SECRET);
}

export function send(res: ApiResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: ApiRequest,
): Promise<T> {
  // Vercel suele pre-parsear req.body; si no, leemos el stream.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      return req.body ? (JSON.parse(req.body) as T) : ({} as T);
    }
    return req.body as T;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}
