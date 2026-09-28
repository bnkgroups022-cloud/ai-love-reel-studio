import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

// Basic brute-force protection (per server instance).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function POST(req: Request) {
  const cfg = env();
  if (!cfg.accessPassword || !cfg.encryptionKey) {
    return NextResponse.json({ error: "App access is not configured: set APP_ACCESS_PASSWORD and ENCRYPTION_KEY." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many wrong passwords. Wait 15 minutes and try again." }, { status: 429 });
  }

  const body = z.object({ password: z.string().max(200) }).safeParse(await req.json().catch(() => null));
  const ok = body.success && (await passwordMatches(body.data.password, cfg.accessPassword, cfg.encryptionKey));
  if (!ok) {
    const e = entry && now - entry.first < WINDOW_MS ? entry : { count: 0, first: now };
    e.count++;
    attempts.set(ip, e);
    log.warn("auth.failed", { attempts: e.count });
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(cfg.encryptionKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  log.info("auth.login");
  return res;
}
