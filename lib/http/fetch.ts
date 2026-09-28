import "server-only";
import { log } from "@/lib/log";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number | "timeout" | "network",
    readonly body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RetryOptions {
  /** Label used in logs and error messages, e.g. "Replicate". */
  service: string;
  timeoutMs: number;
  retries?: number;
  /** Hostname suffixes this call may reach. Anything else is refused. */
  allowedHosts: string[];
}

export function assertAllowedUrl(url: string, allowedHosts: string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(`Refused to fetch an invalid URL`, "network");
  }
  const host = parsed.hostname.toLowerCase();
  const ok = parsed.protocol === "https:" && allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) throw new HttpError(`Refused to fetch a URL on an unexpected host (${host})`, "network");
  return parsed;
}

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * fetch() with a per-attempt timeout, retries with backoff on network errors,
 * timeouts, 429 and 5xx, and a host allowlist so the server never fetches
 * arbitrary URLs.
 */
export async function fetchWithRetry(url: string, init: RequestInit, opts: RetryOptions): Promise<Response> {
  assertAllowedUrl(url, opts.allowedHosts);
  const retries = opts.retries ?? 2;
  let lastError: HttpError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
      if (res.ok) return res;
      const body = (await res.text().catch(() => "")).slice(0, 1000);
      lastError = new HttpError(`${opts.service} returned HTTP ${res.status}`, res.status, body);
      if (!RETRYABLE.has(res.status)) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      await backoff(attempt, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
    } catch (err) {
      if (err instanceof HttpError && err.status !== "network" && !RETRYABLE.has(err.status as number)) throw err;
      if (err instanceof HttpError) {
        lastError = err;
      } else if (controller.signal.aborted) {
        lastError = new HttpError(`${opts.service} timed out after ${Math.round(opts.timeoutMs / 1000)}s`, "timeout");
      } else {
        lastError = new HttpError(`Could not reach ${opts.service} (${(err as Error).message})`, "network");
      }
      log.warn("http.retry", { service: opts.service, attempt: attempt + 1, error: lastError.message });
      if (attempt < retries) await backoff(attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new HttpError(`${opts.service} request failed`, "network");
}

function backoff(attempt: number, overrideMs?: number) {
  const ms = Math.min(overrideMs ?? 1000 * 2 ** attempt + Math.random() * 400, 15_000);
  if (process.env.NODE_ENV === "test") return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

export async function downloadBytes(url: string, opts: RetryOptions): Promise<Buffer> {
  const res = await fetchWithRetry(url, { method: "GET" }, opts);
  return Buffer.from(await res.arrayBuffer());
}
