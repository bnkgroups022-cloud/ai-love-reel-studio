import { ConfigError } from "@/lib/env";
import { log } from "@/lib/log";
import { SCENE_COUNT } from "@/lib/options";
import type { ImageProvider } from "@/lib/ai/image-provider";
import { buildImagePrompt } from "@/lib/ai/image/prompt-builder";
import type { StoryRequest, StoryResult } from "@/lib/ai/story/story-engine";
import type { Repo } from "@/lib/db/repo";
import type { Storage } from "@/lib/supabase/storage";
import type { RenderOutcome, RenderScene, VideoRenderer } from "@/lib/video/renderer/types";
import type { JobRow, ProjectRow, ProjectStatus, SceneRow } from "@/types/db";

// The whole Reel pipeline as a small state machine. advanceProject() performs
// ONE unit of real work per call (write story / generate one image / start the
// render / check the render), so each call fits inside a serverless time limit.
// The browser keeps calling it while the project is active and shows progress.

export interface PipelineDeps {
  repo: Repo;
  storage: Storage;
  generateStory(req: StoryRequest): Promise<StoryResult>;
  getImageProvider(): ImageProvider;
  getVideoRenderer(): VideoRenderer;
  renderTextOverlay(text: string): Promise<Buffer>;
  normalizeSceneImage(data: Buffer): Promise<Buffer>;
  downloadVideo(url: string): Promise<Buffer>;
  reelFormat: { width: number; height: number; fps: number };
}

export const ACTIVE_STATUSES: ProjectStatus[] = ["queued", "writing_story", "generating_images", "render_queued", "rendering"];
export const LOCK_SECONDS = 290;
const STALE_GENERATING_MS = 6 * 60_000;
const RENDER_TIMEOUT_MS = 20 * 60_000;
const SIGNED_URL_SECONDS = 2 * 60 * 60;

export type AdvanceResult = { status: ProjectStatus; busy: boolean };

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function advanceProject(projectId: string, deps: PipelineDeps): Promise<AdvanceResult> {
  const { repo } = deps;
  const project = await repo.tryLock(projectId, LOCK_SECONDS);
  if (!project) {
    const current = await repo.getProject(projectId);
    if (!current) throw new Error("Project not found");
    return { status: current.status, busy: true };
  }
  try {
    switch (project.status) {
      case "queued":
      case "writing_story":
        await runStoryStep(project, deps);
        break;
      case "generating_images":
        await runNextImageStep(project, deps);
        break;
      case "render_queued":
        await startRenderStep(project, deps);
        break;
      case "rendering":
        await checkRenderStep(project, deps);
        break;
      default:
        break; // scenes_ready / completed / failed: nothing to do, nothing is regenerated.
    }
  } finally {
    await repo.unlock(projectId);
  }
  const after = await repo.getProject(projectId);
  return { status: after?.status ?? project.status, busy: false };
}

async function failProject(deps: PipelineDeps, project: ProjectRow, job: JobRow | null, message: string) {
  log.error("project.failed", { projectId: project.id, message });
  await deps.repo.updateProject(project.id, { status: "failed", error_message: message });
  if (job) await deps.repo.updateJob(job.id, { status: "failed", error_message: message, message: "Failed" });
}

// ---------------------------------------------------------------- story

async function runStoryStep(project: ProjectRow, deps: PipelineDeps) {
  const { repo } = deps;
  let job = await repo.latestJob(project.id, "story");
  if (!job || job.status === "completed" || job.status === "failed") job = await repo.createJob(project.id, "story");
  job = await repo.updateJob(job.id, { status: "running", progress: 10, message: "Writing story, characters and scenes" });
  await repo.updateProject(project.id, { status: "writing_story", error_message: null });
  log.info("story.started", { projectId: project.id });

  try {
    const { story, provider } = await deps.generateStory({
      topic: project.topic,
      mood: project.mood,
      style: project.style,
      language: project.language,
      duration: project.duration,
    });
    await repo.replaceScenes(
      project.id,
      story.scenes.map((s) => ({
        project_id: project.id,
        scene_number: s.scene_number,
        duration_seconds: s.duration_seconds,
        description: s.description,
        action: s.action,
        emotion: s.emotion,
        location: s.location,
        time_of_day: s.time_of_day,
        lighting: s.lighting,
        camera: s.camera,
        lens: s.lens,
        characters_present: s.characters_present,
        image_prompt: s.image_prompt,
        text_overlay: s.text_overlay,
        transition: s.transition,
      })),
    );
    await repo.updateProject(project.id, {
      title: story.title,
      story_json: story,
      character_bible_json: story.characters,
      story_provider: provider,
      status: "generating_images",
    });
    await repo.updateJob(job.id, { status: "completed", progress: 100, message: "Story ready" });
    await repo.createJob(project.id, "images", { status: "running", progress: 0, message: `Generating scene 1/${SCENE_COUNT}` });
    log.info("story.completed", { projectId: project.id, provider });
  } catch (err) {
    await failProject(deps, project, job, reason(err));
  }
}

// ---------------------------------------------------------------- images

export function isStale(scene: SceneRow, now = Date.now()) {
  return scene.image_status === "generating" && now - new Date(scene.updated_at).getTime() > STALE_GENERATING_MS;
}

async function runNextImageStep(project: ProjectRow, deps: PipelineDeps) {
  const { repo } = deps;
  const scenes = await repo.listScenes(project.id);
  let job = await repo.latestJob(project.id, "images");
  if (!job || job.status !== "running") job = await repo.createJob(project.id, "images", { status: "running" });

  const next = scenes.find((s) => s.image_status === "pending" || isStale(s));
  if (next) {
    await repo.updateJob(job.id, {
      message: `Generating scene ${next.scene_number}/${scenes.length}`,
      progress: Math.round(((next.scene_number - 1) / scenes.length) * 100),
    });
    await generateSceneImage(project, next, deps);
  }

  const after = await repo.listScenes(project.id);
  const remaining = after.filter((s) => s.image_status === "pending" || isStale(s)).length;
  const failed = after.filter((s) => s.image_status === "failed").length;
  const done = after.filter((s) => s.image_status === "done").length;
  if (remaining > 0) {
    await repo.updateJob(job.id, { progress: Math.round(((done + failed) / after.length) * 100) });
    return;
  }
  await repo.updateJob(job.id, {
    status: "completed",
    progress: 100,
    message: failed ? `${done} of ${after.length} scenes ready, ${failed} failed` : "All scenes ready",
  });
  await repo.updateProject(project.id, { status: "scenes_ready" });
  log.info("images.completed", { projectId: project.id, done, failed });
}

/** Generates (or regenerates) exactly one scene image. Never touches other scenes. */
export async function generateSceneImage(project: ProjectRow, scene: SceneRow, deps: PipelineDeps): Promise<SceneRow> {
  const { repo, storage } = deps;
  const n = scene.scene_number;
  await repo.updateScene(scene.id, { image_status: "generating", image_error: null, image_attempts: scene.image_attempts + 1 });
  log.info("image.started", { projectId: project.id, scene: n });
  try {
    if (!project.character_bible_json) throw new Error("the character bible is missing");
    const provider = deps.getImageProvider();
    const { prompt, negativePrompt } = buildImagePrompt({
      scene,
      bible: project.character_bible_json,
      style: project.style,
      mood: project.mood,
    });
    const image = await provider.generateImage({
      prompt,
      negativePrompt,
      aspectRatio: "9:16",
      seed: project.seed,
      demoLabel: { sceneNumber: n, description: scene.description },
    });
    const jpeg = await deps.normalizeSceneImage(image.data);
    const path = `${project.id}/scenes/scene-${n}-${Date.now()}.jpg`;
    await storage.upload(path, jpeg, "image/jpeg");
    await repo.insertAsset({
      project_id: project.id,
      scene_id: scene.id,
      asset_type: "scene_image",
      provider: image.provider,
      provider_asset_id: image.providerAssetId,
      asset_url: path,
    });
    const updated = await repo.updateScene(scene.id, { image_status: "done", image_url: path, image_error: null, image_provider: image.provider });
    if (scene.image_url && scene.image_url !== path) await removeStoredAsset(deps, project.id, scene.image_url);
    await repo.updateProject(project.id, {
      image_provider: provider.name,
      ...(n === 1 ? { thumbnail_url: path } : {}),
    });
    log.info("image.completed", { projectId: project.id, scene: n, provider: image.provider });
    return updated;
  } catch (err) {
    const msg =
      err instanceof ConfigError
        ? `Scene ${n} could not be generated: ${err.message}`
        : `Scene ${n} could not be generated because ${reason(err).replace(/\.$/, "")}.`;
    log.error("image.failed", { projectId: project.id, scene: n, error: reason(err) });
    return repo.updateScene(scene.id, { image_status: "failed", image_error: msg });
  }
}

async function removeStoredAsset(deps: PipelineDeps, projectId: string, path: string) {
  try {
    await deps.storage.remove([path]);
    const assets = await deps.repo.listAssets(projectId);
    await deps.repo.deleteAssets(assets.filter((a) => a.asset_url === path).map((a) => a.id));
  } catch (err) {
    log.warn("asset.remove_failed", { path, error: reason(err) });
  }
}

// ---------------------------------------------------------------- render

async function startRenderStep(project: ProjectRow, deps: PipelineDeps) {
  const { repo, storage } = deps;
  const job = await repo.createJob(project.id, "render", { status: "running", progress: 5, message: "Building cinematic Reel" });
  log.info("video.started", { projectId: project.id });
  try {
    const scenes = await repo.listScenes(project.id);
    const missing = scenes.filter((s) => s.image_status !== "done" || !s.image_url);
    if (scenes.length !== SCENE_COUNT || missing.length) {
      throw new Error(`Scene ${missing[0]?.scene_number ?? "?"} has no image yet. Regenerate it before building the Reel.`);
    }

    // Text overlays (temporary files, removed after the render).
    const overlayPaths = new Map<number, string>();
    const overlayProblems: number[] = [];
    for (const scene of scenes) {
      if (!scene.text_overlay) continue;
      try {
        const png = await deps.renderTextOverlay(scene.text_overlay);
        const path = `${project.id}/overlays/scene-${scene.scene_number}-${Date.now()}.png`;
        await storage.upload(path, png, "image/png");
        await repo.insertAsset({ project_id: project.id, scene_id: scene.id, asset_type: "overlay", provider: "app", provider_asset_id: null, asset_url: path });
        overlayPaths.set(scene.scene_number, path);
      } catch (err) {
        overlayProblems.push(scene.scene_number);
        log.warn("overlay.failed", { projectId: project.id, scene: scene.scene_number, error: reason(err) });
      }
    }

    const allPaths = [...scenes.map((s) => s.image_url!), ...overlayPaths.values()];
    const urls = await storage.signedUrls(allPaths, SIGNED_URL_SECONDS);
    const asset = (path: string) => {
      const url = urls.get(path);
      if (!url) throw new Error(`Could not create a secure link for ${path.split("/").pop()}`);
      return { url, load: () => storage.download(path) };
    };
    const renderScenes: RenderScene[] = scenes.map((s) => ({
      sceneNumber: s.scene_number,
      durationSeconds: Number(s.duration_seconds),
      image: asset(s.image_url!),
      overlay: overlayPaths.has(s.scene_number) ? asset(overlayPaths.get(s.scene_number)!) : null,
    }));

    const renderer = deps.getVideoRenderer();
    await repo.updateProject(project.id, { status: "rendering", video_provider: renderer.name });
    await repo.updateJob(job.id, {
      progress: 20,
      message: overlayProblems.length ? `Rendering MP4 (text for scene ${overlayProblems.join(", ")} could not be drawn)` : "Rendering MP4",
    });
    const outcome = await renderer.renderVideo({ projectId: project.id, scenes: renderScenes, ...deps.reelFormat });
    await handleRenderOutcome(project, job, outcome, deps);
  } catch (err) {
    await failProject(deps, project, job, reason(err));
  }
}

async function checkRenderStep(project: ProjectRow, deps: PipelineDeps) {
  const job = await deps.repo.latestJob(project.id, "render");
  try {
    if (!job?.provider_job_id) throw new Error("The render job was lost. Press TRY AGAIN to render again.");
    if (Date.now() - new Date(job.created_at).getTime() > RENDER_TIMEOUT_MS) {
      throw new Error("The video service did not finish within 20 minutes. Press TRY AGAIN.");
    }
    const renderer = deps.getVideoRenderer();
    if (!renderer.checkRender) throw new Error("The video renderer changed while this Reel was rendering. Press TRY AGAIN.");
    const outcome = await renderer.checkRender(job.provider_job_id, Number(project.duration));
    await handleRenderOutcome(project, job, outcome, deps);
  } catch (err) {
    await failProject(deps, project, job, reason(err));
  }
}

async function handleRenderOutcome(project: ProjectRow, job: JobRow, outcome: RenderOutcome, deps: PipelineDeps) {
  const { repo, storage } = deps;
  if (outcome.state === "pending") {
    await repo.updateJob(job.id, { provider_job_id: outcome.renderId, message: `Rendering MP4 — ${outcome.message}`, progress: 50 });
    await repo.updateProject(project.id, { status: "rendering" });
    return;
  }
  const video = "video" in outcome ? outcome.video : await deps.downloadVideo(outcome.videoUrl);
  if (video.length < 1000) throw new Error("The rendered video file is empty.");
  const path = `${project.id}/reel-${Date.now()}.mp4`;
  await storage.upload(path, video, "video/mp4");
  const fresh = await repo.getProject(project.id);
  const oldVideo = fresh?.video_url;
  await repo.insertAsset({ project_id: project.id, scene_id: null, asset_type: "video", provider: fresh?.video_provider ?? "renderer", provider_asset_id: job.provider_job_id, asset_url: path });
  await repo.updateProject(project.id, { status: "completed", video_url: path, video_duration: outcome.duration, error_message: null });
  await repo.updateJob(job.id, { status: "completed", progress: 100, message: "Reel ready" });
  if (oldVideo && oldVideo !== path) await removeStoredAsset(deps, project.id, oldVideo);
  // Overlays were only needed for the render.
  const overlays = (await repo.listAssets(project.id)).filter((a) => a.asset_type === "overlay");
  if (overlays.length) {
    await storage.remove(overlays.map((a) => a.asset_url)).catch((err) => log.warn("overlay.cleanup_failed", { error: reason(err) }));
    await repo.deleteAssets(overlays.map((a) => a.id));
  }
  log.info("video.completed", { projectId: project.id, bytes: video.length, duration: outcome.duration });
}
