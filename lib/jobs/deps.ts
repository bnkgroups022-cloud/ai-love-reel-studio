import "server-only";
import { getImageProvider } from "@/lib/ai/image-provider";
import { generateStory } from "@/lib/ai/story/story-engine";
import { supabaseRepo } from "@/lib/db/repo";
import { downloadBytes } from "@/lib/http/fetch";
import { storage } from "@/lib/supabase/storage";
import { normalizeSceneImage, renderTextOverlay } from "@/lib/video/overlay";
import { getVideoRenderer, REEL_FORMAT } from "@/lib/video/renderer";
import { SHOTSTACK_OUTPUT_HOSTS } from "@/lib/video/renderer/shotstack";
import type { PipelineDeps } from "./pipeline";

export const realDeps: PipelineDeps = {
  repo: supabaseRepo,
  storage,
  generateStory,
  getImageProvider,
  getVideoRenderer,
  renderTextOverlay: (text) => renderTextOverlay(text, REEL_FORMAT.width, REEL_FORMAT.height),
  normalizeSceneImage: (data) => normalizeSceneImage(data, REEL_FORMAT.width, REEL_FORMAT.height),
  downloadVideo: (url) => downloadBytes(url, { service: "video download", timeoutMs: 120_000, retries: 2, allowedHosts: SHOTSTACK_OUTPUT_HOSTS }),
  reelFormat: { ...REEL_FORMAT },
};
