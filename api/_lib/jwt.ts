// JWT HS256 self-contained (sin dependencias externas), usando node:crypto.
import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec = 60 * 60 * 12, // 12h
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyJwt<T = Record<string, unknown>>(
  token: string,
  secret: string,
): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as T & {
      exp?: number;
    };
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}
