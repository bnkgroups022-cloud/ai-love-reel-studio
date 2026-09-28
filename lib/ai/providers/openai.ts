import "server-only";
import { fetchWithRetry, HttpError } from "@/lib/http/fetch";
import { log } from "@/lib/log";
import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../image-provider";
import { ImageGenerationError } from "../image-provider";

// OpenAI Images adapter (default model: gpt-image-1).
// Closest vertical size is 1024x1536 (2:3); the app crops/resizes to 1080x1920.
// No seed or negative prompt support, so the "avoid" list goes into the prompt.

const API_HOSTS = ["api.openai.com"];

export function createOpenAIProvider(cfg: { apiKey: string; model: string }, fetchImpl = fetchWithRetry): ImageProvider {
  return {
    name: `openai:${cfg.model}`,
    isDemo: false,
    async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
      try {
        const res = await fetchImpl(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: cfg.model,
              prompt: `${input.prompt}\n\nAvoid: ${input.negativePrompt}.`,
              size: "1024x1536",
              quality: "high",
              n: 1,
            }),
          },
          { service: "OpenAI Images", timeoutMs: 180_000, retries: 1, allowedHosts: API_HOSTS },
        );
        const json = (await res.json()) as { created?: number; data?: Array<{ b64_json?: string }> };
        const b64 = json.data?.[0]?.b64_json;
        if (!b64) throw new ImageGenerationError("the image service returned no image");
        const data = Buffer.from(b64, "base64");
        log.info("image.openai.ok", { bytes: data.length });
        return {
          provider: `openai:${cfg.model}`,
          assetUrl: null,
          providerAssetId: json.created ? `openai-${json.created}` : null,
          data,
          mimeType: "image/png",
        };
      } catch (err) {
        if (err instanceof ImageGenerationError) throw err;
        if (err instanceof HttpError) {
          const detail = openAiMessage(err.body);
          if (err.status === 401) throw new ImageGenerationError("the image service rejected the API key (IMAGE_API_KEY)");
          if (err.status === 400) throw new ImageGenerationError(`the image service refused this prompt: ${detail}`);
          if (err.status === 403) throw new ImageGenerationError(`the image service denied access: ${detail}`);
          if (err.status === 429) throw new ImageGenerationError(`the image service is rate-limiting or out of quota: ${detail}`);
          if (err.status === "timeout") throw new ImageGenerationError("the image service timed out");
          throw new ImageGenerationError(`the image service failed (${err.message})`);
        }
        throw new ImageGenerationError(`the image service failed (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  };
}

function openAiMessage(body?: string) {
  try {
    return (JSON.parse(body ?? "") as { error?: { message?: string } }).error?.message?.slice(0, 200) ?? "no details";
  } catch {
    return body?.slice(0, 200) || "no details";
  }
}
