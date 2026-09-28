import { connection } from "next/server";
import { isDemoImages, isDemoStory } from "@/lib/env";

/** Reads the live server config on every request, so it is never out of date. */
export async function DemoBanner() {
  await connection();
  const story = isDemoStory();
  const images = isDemoImages();
  if (!story && !images) return null;
  const parts = [story ? "a fixed test story (no AI)" : null, images ? "labelled placeholder images (not AI generated)" : null].filter(Boolean);
  return (
    <div role="status" className="sticky top-0 z-40 border-b border-amber/40 bg-amber/15 px-4 py-2 text-center text-[13px] leading-snug text-amber backdrop-blur">
      <strong className="font-semibold">DEMO MODE</strong> — using {parts.join(" and ")}.{" "}
      {images ? "Connect an image provider to generate real AI images." : "Connect the story AI to write real stories."}
    </div>
  );
}
