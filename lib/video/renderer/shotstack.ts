import "server-only";
import { fetchWithRetry, HttpError } from "@/lib/http/fetch";
import { log } from "@/lib/log";
import { planTimeline, type Motion } from "../timeline";
import { RenderError, type RenderRequest, type VideoRenderer } from "./types";

// Shotstack cloud renderer (https://shotstack.io). Works on Vercel because the
// heavy rendering happens on Shotstack's servers; we only submit a JSON
// timeline and later check the status.
// SHOTSTACK_ENV=stage uses the free sandbox (watermarked output);
// SHOTSTACK_ENV=v1 uses production (paid, no watermark).

export const SHOTSTACK_CROSSFADE = 1;
const API_HOSTS = ["api.shotstack.io"];
export const SHOTSTACK_OUTPUT_HOSTS = ["shotstack.io", "amazonaws.com", "cloudfront.net"];

const EFFECTS: Record<Motion, string> = {
  zoomIn: "zoomInSlow",
  zoomOut: "zoomOutSlow",
  panRight: "slideRightSlow",
  panLeft: "slideLeftSlow",
};

export function buildShotstackEdit(req: RenderRequest) {
  const timeline = planTimeline(req.scenes.map((s) => s.durationSeconds), SHOTSTACK_CROSSFADE);
  // Later scenes sit on higher tracks and fade in over the one below = crossfade.
  // In Shotstack, tracks[0] is the top layer.
  const sceneTracks = timeline.clips
    .map((clip) => ({
      clips: [
        {
          asset: { type: "image", src: req.scenes[clip.index].image.url },
          start: clip.start,
          length: clip.length,
          fit: "cover",
          effect: EFFECTS[clip.motion],
          ...(clip.fadeIn ? { transition: { in: "fade" } } : {}),
        },
      ],
    }))
    .reverse();
  const overlayClips = timeline.clips
    .filter((clip) => req.scenes[clip.index].overlay)
    .map((clip) => ({
      asset: { type: "image", src: req.scenes[clip.index].overlay!.url },
      start: clip.start,
      length: clip.duration,
      fit: "none",
      transition: { in: "fade", out: "fade" },
    }));
  const tracks = overlayClips.length ? [{ clips: overlayClips }, ...sceneTracks] : sceneTracks;
  return {
    edit: {
      timeline: { background: "#000000", tracks },
      output: { format: "mp4", size: { width: req.width, height: req.height }, fps: req.fps },
    },
    duration: timeline.total,
  };
}

export function createShotstackRenderer(cfg: { apiKey: string; stage: string }, fetchImpl = fetchWithRetry): VideoRenderer {
  const base = `https://api.shotstack.io/edit/${cfg.stage === "v1" ? "v1" : "stage"}`;
  const headers = { "x-api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "application/json" };

  const wrap = (err: unknown): never => {
    if (err instanceof RenderError) throw err;
    if (err instanceof HttpError) {
      if (err.status === 401 || err.status === 403) throw new RenderError("The video service rejected the API key (VIDEO_API_KEY). Check SHOTSTACK_ENV matches your key (stage or v1).");
      if (err.status === 400) throw new RenderError(`The video service rejected the render: ${err.body?.slice(0, 200) ?? "no details"}`);
      if (err.status === "timeout") throw new RenderError("The video service timed out.");
      throw new RenderError(`The video service failed (${err.message}).`);
    }
    throw new RenderError(`The video service failed (${err instanceof Error ? err.message : String(err)}).`);
  };

  return {
    name: `shotstack:${cfg.stage === "v1" ? "v1" : "stage"}`,
    async renderVideo(req) {
      const { edit } = buildShotstackEdit(req);
      try {
        const res = await fetchImpl(`${base}/render`, { method: "POST", headers, body: JSON.stringify(edit) }, {
          service: "Shotstack",
          timeoutMs: 30_000,
          retries: 2,
          allowedHosts: API_HOSTS,
        });
        const json = (await res.json()) as { success?: boolean; message?: string; response?: { id?: string } };
        const id = json.response?.id;
        if (!json.success || !id) throw new RenderError(`The video service did not accept the render: ${json.message ?? "unknown reason"}`);
        log.info("video.shotstack.queued", { projectId: req.projectId, renderId: id });
        return { state: "pending", renderId: id, message: "Render queued" };
      } catch (err) {
        return wrap(err);
      }
    },
    async checkRender(renderId, expectedDuration) {
      try {
        const res = await fetchImpl(`${base}/render/${encodeURIComponent(renderId)}`, { headers }, {
          service: "Shotstack",
          timeoutMs: 20_000,
          retries: 2,
          allowedHosts: API_HOSTS,
        });
        const json = (await res.json()) as { response?: { status?: string; url?: string; error?: string; duration?: number } };
        const r = json.response ?? {};
        if (r.status === "done" && r.url) {
          return { state: "done", videoUrl: r.url, duration: r.duration ?? expectedDuration, format: "mp4" };
        }
        if (r.status === "failed") throw new RenderError(`The video service could not render the Reel: ${r.error ?? "no details"}`);
        return { state: "pending", renderId, message: `Render ${r.status ?? "in progress"}` };
      } catch (err) {
        return wrap(err);
      }
    },
  };
}
