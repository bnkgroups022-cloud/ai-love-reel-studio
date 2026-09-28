// Local check of the video pipeline without Supabase or any API key:
// demo story -> labelled placeholder images -> text overlays -> FFmpeg MP4.
// Usage: npm run render:demo -- [output.mp4] [duration 20|30|45]
import { writeFile } from "node:fs/promises";
import { buildDemoStory } from "@/lib/ai/story/demo-story";
import { renderDemoImage } from "@/lib/ai/providers/demo";
import { normalizeSceneImage, renderTextOverlay } from "@/lib/video/overlay";
import { createFfmpegRenderer } from "@/lib/video/renderer/ffmpeg";
import { REEL_FORMAT } from "@/lib/video/renderer";
import type { Duration } from "@/lib/options";

async function main() {
  const out = process.argv[2] ?? "demo-reel.mp4";
  const duration = Number(process.argv[3] ?? 30) as Duration;
  const story = buildDemoStory({ topic: "Ek baarish wali romantic love story", mood: "Romantic", style: "Rainy Romance", language: "Hinglish", duration });
  const scenes = await Promise.all(
    story.scenes.map(async (s) => {
      const image = await normalizeSceneImage(await renderDemoImage(s.scene_number, s.description));
      const overlay = s.text_overlay ? await renderTextOverlay(s.text_overlay) : null;
      return {
        sceneNumber: s.scene_number,
        durationSeconds: s.duration_seconds,
        image: { url: "local", load: async () => image },
        overlay: overlay ? { url: "local", load: async () => overlay } : null,
      };
    }),
  );
  const started = Date.now();
  const result = await createFfmpegRenderer({ ffmpegPath: process.env.FFMPEG_PATH ?? "" }).renderVideo({
    projectId: "local-demo",
    scenes,
    ...REEL_FORMAT,
  });
  if (result.state !== "done" || !("video" in result)) throw new Error("unexpected render result");
  await writeFile(out, result.video);
  console.log(`Wrote ${out}: ${result.duration}s, ${(result.video.length / 1e6).toFixed(1)} MB, rendered in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
