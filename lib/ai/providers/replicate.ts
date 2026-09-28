import "server-only";
import { fetchWithRetry, HttpError } from "@/lib/http/fetch";
import { log } from "@/lib/log";
import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../image-provider";
import { ImageGenerationError } from "../image-provider";

// Replicate adapter (default model: black-forest-labs/flux-1.1-pro).
// Supports native 9:16 aspect ratio and a seed. FLUX has no negative prompt,
// so the "avoid" list is appended to the prompt text instead.

const API = "https://api.replicate.com/v1";
const API_HOSTS = ["api.replicate.com"];
const OUTPUT_HOSTS = ["replicate.delivery", "replicate.com"];
const POLL_LIMIT_MS = 150_000;

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error: string | null;
  urls?: { get?: string };
}

export function createReplicateProvider(cfg: { apiKey: string; model: string }, fetchImpl = fetchWithRetry): ImageProvider {
  const headers = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" };

  return {
    name: `replicate:${cfg.model}`,
    isDemo: false,
    async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
      if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.model)) {
        throw new ImageGenerationError(`IMAGE_MODEL "${cfg.model}" is not a valid Replicate model name (owner/name).`);
      }
      const body = {
        input: {
          prompt: `${input.prompt}\n\nAvoid: ${input.negativePrompt}.`,
          aspect_ratio: input.aspectRatio,
          output_format: "jpg",
          output_quality: 92,
          safety_tolerance: 2,
          prompt_upsampling: false,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
        },
      };
      try {
        const res = await fetchImpl(
          `${API}/models/${cfg.model}/predictions`,
          { method: "POST", headers: { ...headers, Prefer: "wait=60" }, body: JSON.stringify(body) },
          { service: "Replicate", timeoutMs: 75_000, retries: 2, allowedHosts: API_HOSTS },
        );
        let prediction = (await res.json()) as Prediction;
        const started = Date.now();
        while (prediction.status === "starting" || prediction.status === "processing") {
          if (Date.now() - started > POLL_LIMIT_MS) {
            throw new ImageGenerationError("the image service timed out");
          }
          await new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 0 : 2000));
          const poll = await fetchImpl(`${API}/predictions/${encodeURIComponent(prediction.id)}`, { headers }, {
            service: "Replicate",
            timeoutMs: 20_000,
            retries: 2,
            allowedHosts: API_HOSTS,
          });
          prediction = (await poll.json()) as Prediction;
        }
        if (prediction.status !== "succeeded") {
          throw new ImageGenerationError(
            prediction.error ? `the image service reported: ${prediction.error}` : `the image service ended with status "${prediction.status}"`,
          );
        }
        const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (!url) throw new ImageGenerationError("the image service returned no image");
        const file = await fetchImpl(url, { method: "GET" }, { service: "Replicate", timeoutMs: 60_000, retries: 2, allowedHosts: OUTPUT_HOSTS });
        const data = Buffer.from(await file.arrayBuffer());
        log.info("image.replicate.ok", { id: prediction.id, bytes: data.length });
        return { provider: `replicate:${cfg.model}`, assetUrl: url, providerAssetId: prediction.id, data, mimeType: "image/jpeg" };
      } catch (err) {
        throw toImageError(err);
      }
    },
  };
}

function toImageError(err: unknown): Error {
  if (err instanceof ImageGenerationError) return err;
  if (err instanceof HttpError) {
    if (err.status === 401 || err.status === 403) return new ImageGenerationError("the image service rejected the API key (IMAGE_API_KEY)");
    if (err.status === 402) return new ImageGenerationError("the image service account has no credit left (Replicate billing)");
    if (err.status === 404) return new ImageGenerationError("the image model was not found on Replicate (check IMAGE_MODEL)");
    if (err.status === 422) return new ImageGenerationError(`the image service rejected the request: ${summarize(err.body)}`);
    if (err.status === 429) return new ImageGenerationError("the image service is rate-limiting requests");
    if (err.status === "timeout") return new ImageGenerationError("the image service timed out");
    return new ImageGenerationError(`the image service failed (${err.message})`);
  }
  return new ImageGenerationError(`the image service failed (${err instanceof Error ? err.message : String(err)})`);
}

function summarize(body?: string) {
  if (!body) return "no details";
  try {
    const j = JSON.parse(body) as { detail?: string; title?: string };
    return (j.detail || j.title || body).slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
