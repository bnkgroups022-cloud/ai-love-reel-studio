// Pure timing maths shared by all renderers.
//
// Each scene keeps its planned duration. To crossfade without shortening the
// Reel, every clip except the last is extended by the crossfade length and the
// next clip fades in over that extension. Total length = sum of durations.

export type Motion = "zoomIn" | "zoomOut" | "panRight" | "panLeft";

// Gentle, varied Ken Burns moves. No spins, bounces or flashy effects.
export const MOTION_SEQUENCE: Motion[] = ["zoomIn", "panRight", "zoomOut", "panLeft", "zoomIn", "panLeft", "zoomOut", "zoomIn"];

export interface TimelineClip {
  index: number;
  /** When the clip starts (seconds). */
  start: number;
  /** How long the clip is on screen, including the crossfade tail. */
  length: number;
  /** Planned scene duration (without the tail). */
  duration: number;
  motion: Motion;
  fadeIn: boolean;
}

export interface Timeline {
  clips: TimelineClip[];
  total: number;
  crossfade: number;
}

export function planTimeline(durations: number[], crossfade: number): Timeline {
  if (durations.length === 0) throw new Error("A Reel needs at least one scene");
  const minDuration = Math.min(...durations);
  // A crossfade may never be longer than half of the shortest scene.
  const fade = Math.max(0, Math.min(crossfade, minDuration / 2));
  let start = 0;
  const clips = durations.map((duration, index) => {
    const last = index === durations.length - 1;
    const clip: TimelineClip = {
      index,
      start: round(start),
      length: round(duration + (last ? 0 : fade)),
      duration,
      motion: MOTION_SEQUENCE[index % MOTION_SEQUENCE.length],
      fadeIn: index > 0 && fade > 0,
    };
    start += duration;
    return clip;
  });
  return { clips, total: round(start), crossfade: fade };
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** FFmpeg zoompan expressions for a motion. `n` is the clip's frame count. */
export function zoompanExpr(motion: Motion, n: number) {
  const center = { x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  const zoom = 0.12;
  switch (motion) {
    case "zoomIn":
      return { z: `1+${zoom}*on/${n}`, ...center };
    case "zoomOut":
      return { z: `${1 + zoom}-${zoom}*on/${n}`, ...center };
    case "panRight":
      return { z: `${1 + zoom}`, x: `(iw-iw/zoom)*on/${n}`, y: center.y };
    case "panLeft":
      return { z: `${1 + zoom}`, x: `(iw-iw/zoom)*(1-on/${n})`, y: center.y };
  }
}

/**
 * Builds the FFmpeg filter graph. Inputs are ordered: all scene images first,
 * then the overlay PNGs for scenes that have one (`overlayInputs[i]` is the
 * input index of scene i's overlay, or null).
 */
export function buildFfmpegFilter(args: {
  timeline: Timeline;
  width: number;
  height: number;
  fps: number;
  overlayInputs: (number | null)[];
}): { filter: string; outputLabel: string } {
  const { timeline, width, height, fps, overlayInputs } = args;
  const parts: string[] = [];
  for (const clip of timeline.clips) {
    const frames = Math.max(1, Math.round(clip.length * fps));
    const e = zoompanExpr(clip.motion, frames);
    // Upscale first so the slow zoom stays smooth (less pixel jitter).
    parts.push(
      `[${clip.index}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},` +
        `zoompan=z='${e.z}':x='${e.x}':y='${e.y}':d=${frames}:s=${width}x${height}:fps=${fps},setsar=1,format=yuv420p[base${clip.index}]`,
    );
    const ov = overlayInputs[clip.index];
    if (ov !== null && ov !== undefined) {
      parts.push(`[${ov}:v]scale=${width}:${height},format=rgba[ovl${clip.index}]`);
      parts.push(`[base${clip.index}][ovl${clip.index}]overlay=0:0:format=auto,format=yuv420p[v${clip.index}]`);
    } else {
      parts.push(`[base${clip.index}]null[v${clip.index}]`);
    }
  }
  let current = "v0";
  for (let i = 1; i < timeline.clips.length; i++) {
    const out = `x${i}`;
    const clip = timeline.clips[i];
    if (timeline.crossfade > 0) {
      parts.push(`[${current}][v${i}]xfade=transition=fade:duration=${timeline.crossfade}:offset=${clip.start}[${out}]`);
    } else {
      parts.push(`[${current}][v${i}]concat=n=2:v=1:a=0[${out}]`);
    }
    current = out;
  }
  return { filter: parts.join(";"), outputLabel: current };
}
