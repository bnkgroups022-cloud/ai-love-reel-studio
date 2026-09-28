import { afterEach, describe, expect, it, vi } from "vitest";
import { getImageProvider, ImageGenerationError } from "@/lib/ai/image-provider";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createReplicateProvider } from "@/lib/ai/providers/replicate";
import { ConfigError } from "@/lib/env";
import { fetchWithRetry, HttpError, type RetryOptions } from "@/lib/http/fetch";

const input = { prompt: "A couple under an umbrella", negativePrompt: "cartoon", aspectRatio: "9:16" as const, seed: 7 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ImageProvider factory", () => {
  it("explains exactly which setting is missing", () => {
    vi.stubEnv("IMAGE_PROVIDER", "");
    expect(() => getImageProvider()).toThrow(ConfigError);
    vi.stubEnv("IMAGE_PROVIDER", "replicate");
    vi.stubEnv("IMAGE_API_KEY", "");
    expect(() => getImageProvider()).toThrow(/IMAGE_API_KEY is missing/);
    vi.stubEnv("IMAGE_PROVIDER", "midjourney");
    expect(() => getImageProvider()).toThrow(/Unknown IMAGE_PROVIDER/);
  });

  it("returns a clearly marked demo provider", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "demo");
    const provider = getImageProvider();
    expect(provider.isDemo).toBe(true);
    const img = await provider.generateImage({ ...input, demoLabel: { sceneNumber: 2, description: "Test" } });
    expect(img.provider).toBe("demo");
    expect(img.data.subarray(0, 2).toString("hex")).toBe("ffd8"); // JPEG
  });
});

describe("Replicate adapter", () => {
  it("sends 9:16 + seed, polls until done, downloads from the allowed host", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const fake = vi.fn(async (url: string, init: RequestInit, opts: RetryOptions) => {
      calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      expect(opts.allowedHosts.some((h) => new URL(url).hostname.endsWith(h))).toBe(true);
      if (url.endsWith("/predictions") && init.method === "POST") return json({ id: "p1", status: "processing", output: null, error: null });
      if (url.includes("/predictions/p1")) return json({ id: "p1", status: "succeeded", output: "https://replicate.delivery/x/out.jpg", error: null });
      return new Response(Buffer.from([0xff, 0xd8, 0xff]));
    });
    const provider = createReplicateProvider({ apiKey: "k", model: "black-forest-labs/flux-1.1-pro" }, fake as typeof fetchWithRetry);
    const img = await provider.generateImage(input);
    expect(img.providerAssetId).toBe("p1");
    expect(img.assetUrl).toBe("https://replicate.delivery/x/out.jpg");
    const sent = calls[0].body as { input: { aspect_ratio: string; seed: number; prompt: string } };
    expect(sent.input.aspect_ratio).toBe("9:16");
    expect(sent.input.seed).toBe(7);
    expect(sent.input.prompt).toContain("Avoid: cartoon");
  });

  it("turns HTTP errors into clear reasons", async () => {
    const fake = vi.fn(async () => {
      throw new HttpError("Replicate returned HTTP 401", 401);
    });
    const provider = createReplicateProvider({ apiKey: "bad", model: "a/b" }, fake as unknown as typeof fetchWithRetry);
    await expect(provider.generateImage(input)).rejects.toThrow("the image service rejected the API key (IMAGE_API_KEY)");
  });

  it("reports a failed prediction with the provider's reason", async () => {
    const fake = vi.fn(async () => json({ id: "p2", status: "failed", output: null, error: "NSFW content detected" }));
    const provider = createReplicateProvider({ apiKey: "k", model: "a/b" }, fake as unknown as typeof fetchWithRetry);
    await expect(provider.generateImage(input)).rejects.toThrow(ImageGenerationError);
  });
});

describe("OpenAI adapter", () => {
  it("requests the closest vertical size and decodes base64", async () => {
    let body: Record<string, unknown> = {};
    const fake = vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return json({ created: 1, data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }] });
    });
    const img = await createOpenAIProvider({ apiKey: "k", model: "gpt-image-1" }, fake as unknown as typeof fetchWithRetry).generateImage(input);
    expect(body.size).toBe("1024x1536");
    expect(img.data.toString()).toBe("png-bytes");
  });

  it("maps a timeout to a readable reason", async () => {
    const fake = vi.fn(async () => {
      throw new HttpError("timed out", "timeout");
    });
    await expect(createOpenAIProvider({ apiKey: "k", model: "m" }, fake as unknown as typeof fetchWithRetry).generateImage(input)).rejects.toThrow("the image service timed out");
  });
});

describe("fetchWithRetry", () => {
  const opts = { service: "Test", timeoutMs: 1000, retries: 2, allowedHosts: ["api.example.com"] };

  it("refuses hosts that are not on the allowlist", async () => {
    await expect(fetchWithRetry("https://evil.example.org/x", {}, opts)).rejects.toThrow(/unexpected host/);
    await expect(fetchWithRetry("http://api.example.com/x", {}, opts)).rejects.toThrow(/unexpected host/);
  });

  it("retries 503 then succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("https://api.example.com/x", {}, opts);
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchWithRetry("https://api.example.com/x", {}, opts)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
