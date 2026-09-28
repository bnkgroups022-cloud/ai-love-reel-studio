import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { log } from "@/lib/log";
import { buildFfmpegFilter, planTimeline } from "../timeline";
import { RenderError, type RenderOutcome, type RenderRequest, type VideoRenderer } from "./types";

// Local FFmpeg renderer. Good for running on your own computer or a server/VM.
// NOT suitable for Vercel serverless functions (no FFmpeg binary there and
// long renders exceed time limits) — use the Shotstack renderer on Vercel.

export const FFMPEG_CROSSFADE = 0.8;
export const TMP_PREFIX = "alrs-render-";

export async function resolveFfmpegPath(configured: string): Promise<string> {
  if (configured) {
    if (!existsSync(configured)) throw new RenderError(`FFMPEG_PATH points to a file that does not exist: ${configured}`);
    return configured;
  }
  try {
    // Optional dev dependency; present after `npm install` on your computer.
    const mod = (await import("ffmpeg-static")) as unknown as { default?: string | null };
    const p = mod.default;
    if (p && existsSync(p)) return p;
  } catch {
    // fall through
  }
  throw new RenderError(
    "FFmpeg is not available here. On Vercel use VIDEO_PROVIDER=shotstack; on your computer run `npm install` or set FFMPEG_PATH.",
  );
}

export function runFfmpeg(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new RenderError(`FFmpeg took longer than ${Math.round(timeoutMs / 1000)}s and was stopped.`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new RenderError(`FFmpeg could not start: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new RenderError(`FFmpeg failed (exit ${code}): ${stderr.split("\n").slice(-6).join(" ").trim()}`));
    });
  });
}

export function createFfmpegRenderer(cfg: { ffmpegPath: string; preset?: string; timeoutMs?: number }): VideoRenderer {
  return {
    name: "ffmpeg",
    async renderVideo(req: RenderRequest): Promise<RenderOutcome> {
      const bin = await resolveFfmpegPath(cfg.ffmpegPath);
      const dir = await mkdtemp(path.join(tmpdir(), TMP_PREFIX));
      const started = Date.now();
      try {
        const timeline = planTimeline(
          req.scenes.map((s) => s.durationSeconds),
          FFMPEG_CROSSFADE,
        );
        const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
        // Scene images first...
        for (const scene of req.scenes) {
          const file = path.join(dir, `scene-${scene.sceneNumber}.img`);
          await writeFile(file, await scene.image.load());
          args.push("-i", file);
        }
        // ...then overlays.
        const overlayInputs: (number | null)[] = [];
        let next = req.scenes.length;
        for (const scene of req.scenes) {
          if (!scene.overlay) {
            overlayInputs.push(null);
            continue;
          }
          const file = path.join(dir, `overlay-${scene.sceneNumber}.png`);
          await writeFile(file, await scene.overlay.load());
          args.push("-i", file);
          overlayInputs.push(next++);
        }
        const { filter, outputLabel } = buildFfmpegFilter({ timeline, width: req.width, height: req.height, fps: req.fps, overlayInputs });
        const out = path.join(dir, "reel.mp4");
        args.push(
          "-filter_complex", filter,
          "-map", `[${outputLabel}]`,
          "-an",
          "-c:v", "libx264",
          "-preset", cfg.preset ?? "medium",
          "-crf", "20",
          "-profile:v", "high",
          "-pix_fmt", "yuv420p",
          "-r", String(req.fps),
          "-t", String(timeline.total),
          "-movflags", "+faststart",
          out,
        );
        await runFfmpeg(bin, args, cfg.timeoutMs ?? 10 * 60_000);
        const video = await readFile(out);
        log.info("video.ffmpeg.done", { projectId: req.projectId, seconds: timeline.total, bytes: video.length, ms: Date.now() - started });
        return { state: "done", video, duration: timeline.total, format: "mp4" };
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}
