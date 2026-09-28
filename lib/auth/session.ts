// Single-owner access for the MVP: one password (APP_ACCESS_PASSWORD) unlocks
// the app and sets a signed, httpOnly session cookie. Uses Web Crypto so the
// same code runs in proxy.ts and in route handlers.
// Later this can be swapped for Supabase Google login without touching the pipeline.

export const SESSION_COOKIE = "alrs_session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Buffer.from(sig).toString("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `owner.${expires}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "owner") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < now) return false;
  const expected = await hmac(secret, `${parts[0]}.${parts[1]}`);
  return timingSafeEqual(expected, parts[2]);
}

/** Compares passwords without leaking length/timing through early exit. */
export async function passwordMatches(given: string, expected: string, secret: string): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([hmac(secret, given), hmac(secret, expected)]);
  return timingSafeEqual(a, b);
}
