import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { fetchWithRetry, HttpError } from "@/lib/http/fetch";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ServiceStatus } from "@/types/api";

// Real connection checks for the Settings screen. Each one makes a cheap,
// read-only request with the configured key. Keys are never returned.

function fail(service: string, provider: string, err: unknown): ServiceStatus {
  let detail = err instanceof Error ? err.message : String(err);
  if (err instanceof HttpError && (err.status === 401 || err.status === 403)) detail = "The API key was rejected.";
  return { service, provider, state: "error", detail };
}

async function checkDatabase(): Promise<ServiceStatus> {
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
    return { service: "Database & storage", provider: "Supabase", state: "not_connected", detail: "Supabase URL or service-role key is missing." };
  }
  try {
    const db = supabaseAdmin();
    const res = await db.from("projects").select("id", { head: true, count: "exact" });
    if (res.error) throw new Error(`Tables not found or not reachable (${res.error.message}). Did you run the SQL migration?`);
    const bucket = await db.storage.getBucket(cfg.storageBucket);
    if (bucket.error) throw new Error(`Storage bucket "${cfg.storageBucket}" not found. Did you run the SQL migration?`);
    return { service: "Database & storage", provider: "Supabase", state: "connected", detail: `${res.count ?? 0} projects stored` };
  } catch (err) {
    return fail("Database & storage", "Supabase", err);
  }
}

async function checkStory(): Promise<ServiceStatus> {
  const cfg = env();
  const service = "Story AI";
  if (cfg.storyProvider === "demo") return { service, provider: "demo", state: "demo", detail: "Demo mode — a fixed test story is used, no AI is called." };
  if (cfg.storyProvider !== "anthropic") return { service, provider: cfg.storyProvider, state: "error", detail: `Unknown STORY_PROVIDER "${cfg.storyProvider}".` };
  if (!cfg.anthropicApiKey) return { service, provider: "Anthropic", state: "not_connected", detail: "ANTHROPIC_API_KEY is missing." };
  try {
    const client = new Anthropic({ apiKey: cfg.anthropicApiKey, timeout: 15_000, maxRetries: 1 });
    const model = await client.models.retrieve(cfg.storyModel);
    return { service, provider: "Anthropic", state: "connected", detail: `Model: ${model.display_name ?? cfg.storyModel}` };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { service, provider: "Anthropic", state: "error", detail: "The API key was rejected." };
    if (err instanceof Anthropic.NotFoundError) return { service, provider: "Anthropic", state: "error", detail: `Model "${cfg.storyModel}" is not available to this key.` };
    return fail(service, "Anthropic", err);
  }
}

async function checkImages(): Promise<ServiceStatus> {
  const cfg = env();
  const service = "Image AI";
  if (cfg.imageProvider === "demo") return { service, provider: "demo", state: "demo", detail: "Demo mode — labelled placeholder images, not AI generated." };
  if (!cfg.imageProvider) return { service, provider: "none", state: "not_connected", detail: "IMAGE_PROVIDER is not set." };
  if (!cfg.imageApiKey) return { service, provider: cfg.imageProvider, state: "not_connected", detail: "IMAGE_API_KEY is missing." };
  const opts = { timeoutMs: 15_000, retries: 1 };
  try {
    if (cfg.imageProvider === "replicate") {
      const res = await fetchWithRetry("https://api.replicate.com/v1/account", { headers: { Authorization: `Bearer ${cfg.imageApiKey}` } }, { ...opts, service: "Replicate", allowedHosts: ["api.replicate.com"] });
      const acct = (await res.json()) as { username?: string };
      return { service, provider: "Replicate", state: "connected", detail: `Account: ${acct.username ?? "ok"} · Model: ${cfg.imageModel || "black-forest-labs/flux-1.1-pro"}` };
    }
    if (cfg.imageProvider === "openai") {
      const model = cfg.imageModel || "gpt-image-1";
      await fetchWithRetry(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${cfg.imageApiKey}` } }, { ...opts, service: "OpenAI", allowedHosts: ["api.openai.com"] });
      return { service, provider: "OpenAI", state: "connected", detail: `Model: ${model}` };
    }
    return { service, provider: cfg.imageProvider, state: "error", detail: `Unknown IMAGE_PROVIDER "${cfg.imageProvider}".` };
  } catch (err) {
    return fail(service, cfg.imageProvider, err);
  }
}

async function checkVideo(): Promise<ServiceStatus> {
  const cfg = env();
  const service = "Video renderer";
  if (cfg.videoProvider === "ffmpeg") {
    try {
      const { resolveFfmpegPath } = await import("@/lib/video/renderer/ffmpeg");
      await resolveFfmpegPath(cfg.ffmpegPath);
      return { service, provider: "FFmpeg (this computer)", state: "connected", detail: "FFmpeg found. Not for use on Vercel." };
    } catch (err) {
      return fail(service, "FFmpeg", err);
    }
  }
  if (!cfg.videoProvider) return { service, provider: "none", state: "not_connected", detail: "VIDEO_PROVIDER is not set." };
  if (cfg.videoProvider !== "shotstack") return { service, provider: cfg.videoProvider, state: "error", detail: `Unknown VIDEO_PROVIDER "${cfg.videoProvider}".` };
  if (!cfg.videoApiKey) return { service, provider: "Shotstack", state: "not_connected", detail: "VIDEO_API_KEY is missing." };
  const stage = cfg.shotstackEnv === "v1" ? "v1" : "stage";
  try {
    await fetchWithRetry(`https://api.shotstack.io/edit/${stage}/templates`, { headers: { "x-api-key": cfg.videoApiKey, Accept: "application/json" } }, { service: "Shotstack", timeoutMs: 15_000, retries: 1, allowedHosts: ["api.shotstack.io"] });
    return { service, provider: "Shotstack", state: "connected", detail: stage === "stage" ? "Sandbox (free, videos are watermarked)" : "Production" };
  } catch (err) {
    return fail(service, "Shotstack", err);
  }
}

export async function checkAllServices(): Promise<ServiceStatus[]> {
  return Promise.all([checkDatabase(), checkStory(), checkImages(), checkVideo()]);
}
