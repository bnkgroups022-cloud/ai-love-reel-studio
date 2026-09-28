import "server-only";
import { env, ConfigError } from "@/lib/env";
import { createFfmpegRenderer } from "./ffmpeg";
import { createShotstackRenderer } from "./shotstack";
import type { VideoRenderer } from "./types";

export function getVideoRenderer(): VideoRenderer {
  const { videoProvider, videoApiKey, shotstackEnv, ffmpegPath } = env();
  switch (videoProvider) {
    case "shotstack":
      if (!videoApiKey) throw new ConfigError("The video renderer is not connected: VIDEO_API_KEY is missing for Shotstack.");
      return createShotstackRenderer({ apiKey: videoApiKey, stage: shotstackEnv });
    case "ffmpeg":
      return createFfmpegRenderer({ ffmpegPath });
    case "":
      throw new ConfigError('No video renderer is set. Set VIDEO_PROVIDER to "shotstack" (for Vercel) or "ffmpeg" (on your own computer).');
    default:
      throw new ConfigError(`Unknown VIDEO_PROVIDER "${videoProvider}". Use "shotstack" or "ffmpeg".`);
  }
}

export const REEL_FORMAT = { width: 1080, height: 1920, fps: 30 } as const;
