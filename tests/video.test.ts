import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENE_DURATIONS } from "@/lib/options";
import { buildFfmpegFilter, planTimeline } from "@/lib/video/timeline";
import { buildShotstackEdit } from "@/lib/video/renderer/shotstack";
import { createFfmpegRenderer, resolveFfmpegPath } from "@/lib/video/renderer/ffmpeg";
import { renderDemoImage } from "@/lib/ai/providers/demo";
import { normalizeSceneImage } from "@/lib/video/overlay";
import { downloadFileName } from "@/lib/video/download";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("video timeline metadata", () => {
  it("keeps the total length equal to the chosen duration", () => {
    for (const d of [20, 30, 45] as const) {
      const t = planTimeline(SCENE_DURATIONS[d], 0.8);
      expect(t.total).toBe(d);
      expect(t.clips).toHaveLength(8);
    }
  });

  it("overlaps clips by the crossfade so nothing is cut short", () => {
    const t = planTimeline([3, 4, 3], 0.8);
    expect(t.clips.map((c) => [c.start, c.length, c.fadeIn])).toEqual([
      [0, 3.8, false],
      [3, 4.8, true],
      [7, 3, true],
    ]);
  });

  it("uses only gentle Ken Burns motions", () => {
    const t = planTimeline(SCENE_DURATIONS[30], 0.8);
    for (const c of t.clips) expect(["zoomIn", "zoomOut", "panLeft", "panRight"]).toContain(c.motion);
  });

  it("builds an FFmpeg graph with zoompan, overlays and xfade crossfades", () => {
    const timeline = planTimeline([3, 4, 3], 0.8);
    const { filter, outputLabel } = buildFfmpegFilter({ timeline, width: 1080, height: 1920, fps: 30, overlayInputs: [3, null, 4] });
    expect(filter).toContain("zoompan=");
    expect(filter).toContain("s=1080x1920:fps=30");
    expect(filter).toContain("[3:v]scale=1080:1920");
    expect(filter).toContain("xfade=transition=fade:duration=0.8:offset=3[x1]");
    expect(filter).toContain("xfade=transition=fade:duration=0.8:offset=7[x2]");
    expect(outputLabel).toBe("x2");
  });

  it("builds a Shotstack edit: 1080x1920, 30fps, stacked crossfading tracks", () => {
    const asset = (n: string) => ({ url: `https://storage.test/${n}`, load: async () => Buffer.alloc(0) });
    const scenes = SCENE_DURATIONS[30].map((d, i) => ({ sceneNumber: i + 1, durationSeconds: d, image: asset(`s${i + 1}.jpg`), overlay: i === 0 ? asset("o1.png") : null }));
    const { edit, duration } = buildShotstackEdit({ projectId: "p", scenes, width: 1080, height: 1920, fps: 30 });
    expect(duration).toBe(30);
    expect(edit.output).toEqual({ format: "mp4", size: { width: 1080, height: 1920 }, fps: 30 });
    expect(edit.timeline.tracks).toHaveLength(9); // 1 overlay track + 8 scene tracks
    const bottom = edit.timeline.tracks.at(-1)!.clips[0];
    expect(bottom.asset.src).toContain("s1.jpg");
  });
});

describe("download", () => {
  it("makes a safe file name", () => {
    expect(downloadFileName("Baarish Mein Mulaqat!", "1234567890abcdef")).toBe("baarish-mein-mulaqat-12345678.mp4");
    expect(downloadFileName("बारिश में", "abcdef1234")).toBe("love-reel-abcdef12.mp4");
  });
});

describe("access session", () => {
  it("accepts a valid token and rejects tampered or expired ones", async () => {
    const token = await createSessionToken("secret-1");
    expect(await verifySessionToken(token, "secret-1")).toBe(true);
    expect(await verifySessionToken(token, "other-secret")).toBe(false);
    expect(await verifySessionToken(token.replace("owner.", "owner.9"), "secret-1")).toBe(false);
    expect(await verifySessionToken(token, "secret-1", Date.now() + 40 * 24 * 3600 * 1000)).toBe(false);
  });
});

describe("FFmpeg renderer (real MP4)", async () => {
  const bin = await resolveFfmpegPath(process.env.FFMPEG_PATH ?? "").catch(() => null);
  it.skipIf(!bin)("renders a playable 9:16 H.264 MP4 of the right length", async () => {
    const w = 270;
    const h = 480;
    const scenes = await Promise.all(
      [2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3].map(async (d, i) => {
        const img = await normalizeSceneImage(await renderDemoImage(i + 1, "test"), w, h);
        return { sceneNumber: i + 1, durationSeconds: d, image: { url: "local", load: async () => img }, overlay: null };
      }),
    );
    const result = await createFfmpegRenderer({ ffmpegPath: bin!, preset: "ultrafast" }).renderVideo({ projectId: "t", scenes, width: w, height: h, fps: 30 });
    expect(result.state).toBe("done");
    if (result.state !== "done" || !("video" in result)) return;
    expect(result.duration).toBe(20);
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const file = join(mkdtempSync(join(tmpdir(), "alrs-test-")), "t.mp4");
    writeFileSync(file, result.video);
    expect(existsSync(file)).toBe(true);
    const probe = spawnSync(bin!, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr;
    expect(probe).toMatch(/Duration: 00:00:20\.0/);
    expect(probe).toMatch(/h264/);
    expect(probe).toMatch(/270x480/);
    expect(probe).toMatch(/30 fps/);
  }, 120_000);
});
