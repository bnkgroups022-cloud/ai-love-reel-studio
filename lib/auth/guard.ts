import "server-only";
import { cookies } from "next/headers";
import { env, ConfigError } from "@/lib/env";
import { supabaseRepo } from "@/lib/db/repo";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("Please unlock the app first.");
    this.name = "UnauthorizedError";
  }
}

let ownerIdCache: { email: string; id: string } | null = null;

/** Checks the session cookie (defence in depth — proxy.ts checks too). */
export async function requireSession(): Promise<void> {
  const cfg = env();
  if (!cfg.encryptionKey || !cfg.accessPassword) {
    throw new ConfigError("App access is not configured: set APP_ACCESS_PASSWORD and ENCRYPTION_KEY.");
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, cfg.encryptionKey))) throw new UnauthorizedError();
}

/** Checks the session and returns the owner's user id (needs the database). */
export async function requireOwner(): Promise<string> {
  await requireSession();
  const cfg = env();
  if (ownerIdCache?.email === cfg.ownerEmail) return ownerIdCache.id;
  const id = await supabaseRepo.getOrCreateUser(cfg.ownerEmail);
  ownerIdCache = { email: cfg.ownerEmail, id };
  return id;
}
