import { describe, expect, it } from "vitest";
import { buildSteps } from "@/lib/progress";
import type { ProjectView, SceneView } from "@/types/api";

const scene = (n: number, imageStatus: SceneView["imageStatus"]): SceneView => ({
  id: `s${n}`,
  sceneNumber: n,
  durationSeconds: 4,
  description: "",
  emotion: "",
  imagePrompt: "",
  textOverlay: "",
  imageStatus,
  imageError: imageStatus === "failed" ? `Scene ${n} could not be generated because the image service timed out.` : null,
  imageUrl: null,
});

const view = (patch: Partial<ProjectView>): ProjectView => ({
  id: "p",
  topic: "t",
  mood: "Romantic",
  style: "Cinematic Realistic",
  language: "Hindi",
  duration: 30,
  title: null,
  hook: null,
  summary: null,
  characters: null,
  status: "queued",
  errorMessage: null,
  videoUrl: null,
  videoAvailable: false,
  thumbnailUrl: null,
  storyProvider: null,
  imageProvider: null,
  videoProvider: null,
  createdAt: "",
  scenes: [],
  jobs: [],
  ...patch,
});

const bible = { male: {}, female: {} } as ProjectView["characters"];

describe("job status → progress steps", () => {
  it("has the 15 steps in order", () => {
    const steps = buildSteps(view({}));
    expect(steps).toHaveLength(15);
    expect(steps[4].label).toBe("Generating scene 1/8...");
    expect(steps.at(-1)!.label).toBe("Reel ready!");
  });

  it("marks the story steps active while writing, and nothing else", () => {
    const steps = buildSteps(view({ status: "writing_story" }));
    expect(steps.slice(0, 4).every((s) => s.state === "active")).toBe(true);
    expect(steps.slice(4).every((s) => s.state === "pending")).toBe(true);
  });

  it("follows real scene statuses, including a failure", () => {
    const scenes = [1, 2, 3].map((n) => scene(n, "done")).concat([scene(4, "failed"), scene(5, "generating"), scene(6, "pending"), scene(7, "pending"), scene(8, "pending")]);
    const steps = buildSteps(view({ status: "generating_images", characters: bible, scenes }));
    expect(steps.slice(0, 4).every((s) => s.state === "done")).toBe(true);
    expect(steps.slice(4, 12).map((s) => s.state)).toEqual(["done", "done", "done", "failed", "active", "pending", "pending", "pending"]);
    expect(steps[7].note).toContain("Scene 4 could not be generated");
  });

  it("shows rendering and completion", () => {
    const scenes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => scene(n, "done"));
    expect(buildSteps(view({ status: "rendering", characters: bible, scenes })).slice(12).map((s) => s.state)).toEqual(["done", "active", "pending"]);
    expect(buildSteps(view({ status: "completed", characters: bible, scenes })).every((s) => s.state === "done")).toBe(true);
  });

  it("marks a failed render as failed", () => {
    const scenes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => scene(n, "done"));
    const steps = buildSteps(
      view({ status: "failed", characters: bible, scenes, jobs: [{ job_type: "render", status: "failed", progress: 50, message: "Failed", error_message: "x" }] }),
    );
    expect(steps.slice(12).map((s) => s.state)).toEqual(["done", "failed", "pending"]);
  });
});
