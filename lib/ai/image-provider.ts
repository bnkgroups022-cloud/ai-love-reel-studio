import "server-only";
import { env, ConfigError } from "@/lib/env";
import { createReplicateProvider } from "./providers/replicate";
import { createOpenAIProvider } from "./providers/openai";
import { createDemoProvider } from "./providers/demo";

export interface GenerateImageInput {
  prompt: string;
  negativePrompt: string;
  aspectRatio: "9:16";
  /** Same seed for every scene of a project helps keep a consistent look. */
  seed?: number;
  /**
   * Reserved for providers that accept reference / character images
   * (image-to-image, character reference). Not used by the current adapters.
   */
  referenceImageUrls?: string[];
  /** Used only by the demo provider to label its placeholder. */
  demoLabel?: { sceneNumber: number; description: string };
}

export interface GeneratedImage {
  provider: string;
  /** The provider's own URL for the asset, if it returned one (may expire). */
  assetUrl: string | null;
  providerAssetId: string | null;
  /** Downloaded image bytes; the app stores them in Supabase Storage. */
  data: Buffer;
  mimeType: string;
}

export interface ImageProvider {
  readonly name: string;
  readonly isDemo: boolean;
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}

/** Error with a message that is safe and useful to show to the user. */
export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export function getImageProvider(): ImageProvider {
  const { imageProvider, imageApiKey, imageModel } = env();
  switch (imageProvider) {
    case "replicate":
      if (!imageApiKey) throw new ConfigError("The image AI is not connected: IMAGE_API_KEY is missing for Replicate.");
      return createReplicateProvider({ apiKey: imageApiKey, model: imageModel || "black-forest-labs/flux-1.1-pro" });
    case "openai":
      if (!imageApiKey) throw new ConfigError("The image AI is not connected: IMAGE_API_KEY is missing for OpenAI.");
      return createOpenAIProvider({ apiKey: imageApiKey, model: imageModel || "gpt-image-1" });
    case "demo":
      return createDemoProvider();
    case "":
      throw new ConfigError('No image AI is connected. Set IMAGE_PROVIDER to "replicate" or "openai" (or "demo" for labelled test images).');
    default:
      throw new ConfigError(`Unknown IMAGE_PROVIDER "${imageProvider}". Use "replicate", "openai" or "demo".`);
  }
}
