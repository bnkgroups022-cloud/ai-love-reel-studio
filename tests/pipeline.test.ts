import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ImageGenerationError, type ImageProvider } from "@/lib/ai/image-provider";
import { buildDemoStory } from "@/lib/ai/story/demo-story";
import { buildReel, createProject, regenerateScene, retryProject, UserActionError } from "@/lib/jobs/actions";
import { advanceProject, type PipelineDeps } from "@/lib/jobs/pipeline";
import { buildProjectView } from "@/lib/jobs/views";
import { CreateProjectSchema } from "@/lib/validation/requests";
import type { VideoRenderer } from "@/lib/video/renderer/types";
import { memoryRepo, memoryStorage } from "./helpers/memory";

function setup(opts: { failScene?: number; renderer?: VideoRenderer; storyError?: Error } = {}) {
  const mem = memoryRepo();
  const store = memoryStorage();
  const generated: number[] = [];
  let failNext = opts.failScene;
  const imageProvider: ImageProvider = {
    name: "fake",
    isDemo: false,
    generateImage: vi.fn(async (input) => {
      const n = input.demoLabel!.sceneNumber;
      generated.push(n);
      if (n === failNext) {
        failNext = undefined; // fail only once
        throw new ImageGenerationError("the image service timed out");
      }
      return { provider: "fake", assetUrl: null, providerAssetId: `img-${n}`, data: Buffer.from(`image-${n}`), mimeType: "image/jpeg" };
    }),
  };
  const renderer: VideoRenderer = opts.renderer ?? {
    name: "fake-renderer",
    renderVideo: vi.fn(async () => ({ state: "done" as const, video: Buffer.alloc(5000, 1), duration: 30, format: "mp4" as const })),
  };
  const deps: PipelineDeps = {
    repo: mem.repo,
    storage: store.storage,
    generateStory: vi.fn(async (req) => {
      if (opts.storyError) throw opts.storyError;
      return { story: buildDemoStory(req), provider: "test" };
    }),
    getImageProvider: () => imageProvider,
    getVideoRenderer: () => renderer,
    renderTextOverlay: vi.fn(async (text: string) => Buffer.from(`overlay:${text}`)),
    normalizeSceneImage: async (d) => d,
    downloadVideo: vi.fn(async () => Buffer.alloc(6000, 2)),
    reelFormat: { width: 1080, height: 1920, fps: 30 },
  };
  return { ...mem, ...store, deps, generated, imageProvider, renderer };
}

async function newProject(t: ReturnType<typeof setup>) {
  const userId = await t.repo.getOrCreateUser("owner@test");
  const input = CreateProjectSchema.parse({ topic: "Rainy night love", mood: "Romantic", style: "Rainy Romance", language: "Hindi", duration: 30, idempotencyKey: randomUUID() });
  const { project } = await createProject(input, userId, { repo: t.repo }, { maxPerHour: 10 });
  return { projectId: project.id, userId };
}

async function runUntilIdle(projectId: string, deps: PipelineDeps, max = 30) {
  const statuses: string[] = [];
  for (let i = 0; i < max; i++) {
    const r = await advanceProject(projectId, deps);
    statuses.push(r.status);
    if (!["queued", "writing_story", "generating_images", "render_queued", "rendering"].includes(r.status)) break;
  }
  return statuses;
}

describe("job pipeline", () => {
  it("writes the story, then generates one image per step, then stops at scene preview", async () => {
    const t = setup();
    const { projectId } = await newProject(t);
    const statuses = await runUntilIdle(projectId, t.deps);
    expect(statuses[0]).toBe("generating_images"); // story step
    expect(statuses.filter((s) => s === "generating_images").length).toBe(8); // story + 7 image steps
    expect(statuses.at(-1)).toBe("scenes_ready");
    expect(t.generated).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const scenes = await t.repo.listScenes(projectId);
    expect(scenes.every((s) => s.image_status === "done" && s.image_url)).toBe(true);
    const jobs = await t.repo.listJobs(projectId);
    expect(jobs.map((j) => `${j.job_type}:${j.status}`)).toEqual(["story:completed", "images:completed"]);
  });

  it("keeps going when one scene fails and shows a specific error for it", async () => {
    const t = setup({ failScene: 4 });
    const { projectId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    const scenes = await t.repo.listScenes(projectId);
    const s4 = scenes.find((s) => s.scene_number === 4)!;
    expect(s4.image_status).toBe("failed");
    expect(s4.image_error).toBe("Scene 4 could not be generated because the image service timed out.");
    expect(scenes.filter((s) => s.image_status === "done").length).toBe(7);
    expect((await t.repo.latestJob(projectId, "images"))?.message).toBe("7 of 8 scenes ready, 1 failed");
  });

  it("retries only the failed scene", async () => {
    const t = setup({ failScene: 4 });
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    const s4 = (await t.repo.listScenes(projectId)).find((s) => s.scene_number === 4)!;
    await expect(buildReel(projectId, userId, t.deps)).rejects.toThrow("Scene 4 still needs an image");

    t.generated.length = 0;
    const result = await regenerateScene({ sceneId: s4.id, userId }, t.deps);
    expect(result.image_status).toBe("done");
    expect(t.generated).toEqual([4]); // nothing else regenerated
    expect(t.deps.generateStory).toHaveBeenCalledTimes(1);
  });

  it("uses an edited prompt and replaces the old image file", async () => {
    const t = setup();
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    const s2 = (await t.repo.listScenes(projectId)).find((s) => s.scene_number === 2)!;
    await new Promise((r) => setTimeout(r, 2));
    await regenerateScene({ sceneId: s2.id, userId, imagePrompt: "The man smiles at the woman across a rainy platform at night." }, t.deps);
    const after = (await t.repo.getScene(s2.id))!;
    expect(after.image_prompt).toContain("rainy platform");
    expect(after.image_url).not.toBe(s2.image_url);
    expect(t.files.has(s2.image_url!)).toBe(false);
    expect(t.files.has(after.image_url!)).toBe(true);
  });

  it("builds the Reel with overlays and stores the MP4", async () => {
    const t = setup();
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    await buildReel(projectId, userId, t.deps);
    const statuses = await runUntilIdle(projectId, t.deps);
    expect(statuses.at(-1)).toBe("completed");
    const project = (await t.repo.getProject(projectId))!;
    expect(project.video_url).toMatch(/reel-\d+\.mp4$/);
    expect(t.files.get(project.video_url!)?.length).toBe(5000);
    const call = vi.mocked(t.renderer.renderVideo).mock.calls[0][0];
    expect(call.scenes).toHaveLength(8);
    expect(call.scenes.filter((s) => s.overlay).length).toBe(3);
    expect([call.width, call.height, call.fps]).toEqual([1080, 1920, 30]);
    // Temporary overlays are removed after the render.
    expect([...t.files.keys()].some((k) => k.includes("/overlays/"))).toBe(false);
    // Opening a finished project regenerates nothing.
    const before = t.generated.length;
    await advanceProject(projectId, t.deps);
    expect(t.generated.length).toBe(before);
  });

  it("handles an asynchronous cloud renderer (pending, then done)", async () => {
    let checks = 0;
    const renderer: VideoRenderer = {
      name: "cloud",
      renderVideo: vi.fn(async () => ({ state: "pending" as const, renderId: "r-1", message: "queued" })),
      checkRender: vi.fn(async () => (++checks < 2 ? { state: "pending" as const, renderId: "r-1", message: "rendering" } : { state: "done" as const, videoUrl: "https://cdn.shotstack.io/r-1.mp4", duration: 30, format: "mp4" as const })),
    };
    const t = setup({ renderer });
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    await buildReel(projectId, userId, t.deps);
    const statuses = await runUntilIdle(projectId, t.deps);
    expect(statuses).toEqual(["rendering", "rendering", "completed"]);
    expect(t.deps.downloadVideo).toHaveBeenCalledWith("https://cdn.shotstack.io/r-1.mp4");
    expect((await t.repo.latestJob(projectId, "render"))?.provider_job_id).toBe("r-1");
  });

  it("shows the real error when the story AI fails, and TRY AGAIN restarts only the story", async () => {
    const t = setup({ storyError: new Error("The story AI timed out. Press TRY AGAIN.") });
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    const project = (await t.repo.getProject(projectId))!;
    expect(project.status).toBe("failed");
    expect(project.error_message).toBe("The story AI timed out. Press TRY AGAIN.");
    expect((await t.repo.latestJob(projectId, "story"))?.status).toBe("failed");
    await retryProject(projectId, userId, t.deps);
    expect((await t.repo.getProject(projectId))!.status).toBe("queued");
  });

  it("does not run two steps at once (lock)", async () => {
    const t = setup();
    const { projectId } = await newProject(t);
    await t.repo.tryLock(projectId, 60);
    const r = await advanceProject(projectId, t.deps);
    expect(r).toEqual({ status: "queued", busy: true });
    expect(t.deps.generateStory).not.toHaveBeenCalled();
  });

  it("refuses regeneration while the project is still being worked on", async () => {
    const t = setup();
    const { projectId, userId } = await newProject(t);
    await advanceProject(projectId, t.deps); // story done, images pending
    const s1 = (await t.repo.listScenes(projectId))[0];
    await expect(regenerateScene({ sceneId: s1.id, userId }, t.deps)).rejects.toBeInstanceOf(UserActionError);
  });
});

describe("job status and download view", () => {
  it("reports job progress and marks a missing video as unavailable", async () => {
    const t = setup();
    const { projectId, userId } = await newProject(t);
    await runUntilIdle(projectId, t.deps);
    await buildReel(projectId, userId, t.deps);
    await runUntilIdle(projectId, t.deps);
    let view = await buildProjectView((await t.repo.getProject(projectId))!, t.deps);
    expect(view.videoAvailable).toBe(true);
    expect(view.videoUrl).toContain("https://storage.test/");
    expect(view.scenes.every((s) => s.imageUrl)).toBe(true);
    expect(view.jobs.map((j) => `${j.job_type}:${j.status}:${j.progress}`)).toEqual(["story:completed:100", "images:completed:100", "render:completed:100"]);

    // Video deleted from storage -> no fake download link.
    const project = (await t.repo.getProject(projectId))!;
    await t.storage.remove([project.video_url!]);
    view = await buildProjectView(project, t.deps);
    expect(view.videoAvailable).toBe(false);
    expect(view.videoUrl).toBeNull();
  });
});
