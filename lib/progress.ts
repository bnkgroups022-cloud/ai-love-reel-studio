import type { ProjectView } from "@/types/api";

// Turns the real project state from the server into the progress checklist.
// Nothing here is timed or simulated: every tick comes from the database.

export type StepState = "done" | "active" | "pending" | "failed";
export interface Step {
  key: string;
  label: string;
  state: StepState;
  note?: string;
}

const STORY_LABELS = ["Understanding your idea...", "Writing your story...", "Creating characters...", "Planning cinematic scenes..."];

export function buildSteps(view: ProjectView): Step[] {
  const { status } = view;
  const failed = status === "failed";
  const failedJob = failed ? [...view.jobs].reverse().find((j) => j.status === "failed")?.job_type : undefined;
  const storyDone = !!view.characters && view.scenes.length > 0;
  const steps: Step[] = [];

  // The story, characters and scene plan come from ONE AI request, so these
  // four lines move together.
  const storyState: StepState = storyDone ? "done" : failed && failedJob === "story" ? "failed" : status === "writing_story" || status === "queued" ? "active" : "pending";
  STORY_LABELS.forEach((label, i) =>
    steps.push({ key: `story-${i}`, label, state: storyState, note: i === 0 && storyState === "active" ? "One AI request writes the story, characters and scene plan together." : undefined }),
  );

  const total = view.scenes.length || 8;
  let activeMarked = false;
  for (let n = 1; n <= total; n++) {
    const scene = view.scenes.find((s) => s.sceneNumber === n);
    let state: StepState = "pending";
    if (scene?.imageStatus === "done") state = "done";
    else if (scene?.imageStatus === "failed") state = "failed";
    else if (scene?.imageStatus === "generating") {
      state = "active";
      activeMarked = true;
    } else if (status === "generating_images" && scene?.imageStatus === "pending" && !activeMarked) {
      state = "active";
      activeMarked = true;
    }
    steps.push({ key: `scene-${n}`, label: `Generating scene ${n}/${total}...`, state, note: state === "failed" ? (scene?.imageError ?? undefined) : undefined });
  }

  const renderJob = [...view.jobs].reverse().find((j) => j.job_type === "render");
  const renderFailed = failed && failedJob === "render";
  const building: StepState =
    status === "completed" || status === "rendering" ? "done" : status === "render_queued" ? "active" : renderFailed && (renderJob?.progress ?? 0) < 20 ? "failed" : renderFailed ? "done" : "pending";
  const rendering: StepState = status === "completed" ? "done" : status === "rendering" ? "active" : renderFailed && building === "done" ? "failed" : "pending";
  steps.push({ key: "build", label: "Building cinematic Reel...", state: building });
  steps.push({ key: "render", label: "Rendering MP4...", state: rendering, note: rendering === "active" ? (renderJob?.message ?? undefined) : undefined });
  steps.push({ key: "ready", label: "Reel ready!", state: status === "completed" ? "done" : "pending" });
  return steps;
}

export function isActive(status: ProjectView["status"]) {
  return status === "queued" || status === "writing_story" || status === "generating_images" || status === "render_queued" || status === "rendering";
}
