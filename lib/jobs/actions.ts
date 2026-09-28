import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { log } from "@/lib/log";
import { SCENE_COUNT } from "@/lib/options";
import type { CreateProjectInput } from "@/lib/validation/requests";
import type { ProjectRow, SceneRow } from "@/types/db";
import { ACTIVE_STATUSES, LOCK_SECONDS, generateSceneImage, type PipelineDeps } from "./pipeline";

// User actions on a project. Each one does only what is needed — nothing is
// regenerated unless the user asked for it.

/** An expected problem with a clear message for the user (HTTP 4xx). */
export class UserActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UserActionError";
  }
}

export async function createProject(
  input: CreateProjectInput,
  userId: string,
  deps: Pick<PipelineDeps, "repo">,
  opts: { maxPerHour: number },
): Promise<{ project: ProjectRow; created: boolean }> {
  // A repeated click / network retry with the same key returns the same project.
  const existing = await deps.repo.findProjectByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    if (existing.user_id !== userId) throw new UserActionError("Invalid request id.", 400);
    log.info("project.duplicate_ignored", { projectId: existing.id });
    return { project: existing, created: false };
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await deps.repo.countProjectsSince(userId, since);
  if (recent >= opts.maxPerHour) {
    throw new UserActionError(`You have created ${recent} Reels in the last hour (limit ${opts.maxPerHour}). Please wait a little and try again.`, 429);
  }
  const result = await deps.repo.createProject({
    user_id: userId,
    idempotency_key: input.idempotencyKey,
    topic: input.topic,
    mood: input.mood,
    style: input.style,
    language: input.language,
    duration: input.duration,
  });
  if (result.created) {
    await deps.repo.createJob(result.project.id, "story", { status: "queued", message: "Waiting to start" });
    log.info("project.created", { projectId: result.project.id, topic: input.topic, duration: input.duration });
  } else {
    log.info("project.duplicate_ignored", { projectId: result.project.id });
  }
  return result;
}

async function loadOwned(projectId: string, userId: string, deps: Pick<PipelineDeps, "repo">) {
  const project = await deps.repo.getProject(projectId);
  if (!project || project.user_id !== userId) throw new UserActionError("This Reel was not found. It may have been deleted.", 404);
  return project;
}

function assertIdle(project: ProjectRow) {
  if (ACTIVE_STATUSES.includes(project.status)) {
    throw new UserActionError("This Reel is still being worked on. Please wait until the current step finishes.", 409);
  }
}

export async function regenerateScene(
  args: { projectId?: string; sceneId: string; imagePrompt?: string; userId: string },
  deps: PipelineDeps,
): Promise<SceneRow> {
  const scene = await deps.repo.getScene(args.sceneId);
  if (!scene) throw new UserActionError("That scene was not found.", 404);
  const project = await loadOwned(scene.project_id, args.userId, deps);
  assertIdle(project);
  const locked = await deps.repo.tryLock(project.id, LOCK_SECONDS);
  if (!locked) throw new UserActionError("Another change to this Reel is in progress. Try again in a moment.", 409);
  try {
    let target = scene;
    if (args.imagePrompt && args.imagePrompt !== scene.image_prompt) {
      target = await deps.repo.updateScene(scene.id, { image_prompt: args.imagePrompt });
    }
    const result = await generateSceneImage(locked, target, deps);
    // The finished video no longer matches the scenes: the user rebuilds it when ready.
    if (locked.status === "completed" || locked.status === "failed") {
      await deps.repo.updateProject(project.id, { status: "scenes_ready", error_message: null });
    }
    return result;
  } finally {
    await deps.repo.unlock(project.id);
  }
}

export async function regenerateAllScenes(projectId: string, userId: string, deps: PipelineDeps) {
  const project = await loadOwned(projectId, userId, deps);
  assertIdle(project);
  if (!project.character_bible_json) throw new UserActionError("This Reel has no story yet, so there is nothing to regenerate.");
  await deps.repo.updateScenesForProject(project.id, { image_status: "pending", image_error: null });
  await deps.repo.createJob(project.id, "images", { status: "running", progress: 0, message: `Generating scene 1/${SCENE_COUNT}` });
  await deps.repo.updateProject(project.id, { status: "generating_images", error_message: null });
  log.info("images.regenerate_all", { projectId });
}

export async function buildReel(projectId: string, userId: string, deps: PipelineDeps) {
  const project = await loadOwned(projectId, userId, deps);
  assertIdle(project);
  const scenes = await deps.repo.listScenes(project.id);
  const notReady = scenes.filter((s) => s.image_status !== "done");
  if (scenes.length !== SCENE_COUNT) throw new UserActionError("This Reel does not have all 8 scenes yet.");
  if (notReady.length) {
    throw new UserActionError(`Scene ${notReady.map((s) => s.scene_number).join(", ")} still needs an image. Regenerate it first.`);
  }
  await deps.repo.updateProject(project.id, { status: "render_queued", error_message: null });
  log.info("video.queued", { projectId });
}

export async function retryProject(projectId: string, userId: string, deps: PipelineDeps) {
  const project = await loadOwned(projectId, userId, deps);
  if (project.status !== "failed") throw new UserActionError("Only a failed Reel can be retried.");
  const failedJob = (await deps.repo.listJobs(project.id)).filter((j) => j.status === "failed").pop();
  const next = failedJob?.job_type === "render" ? "render_queued" : failedJob?.job_type === "images" ? "generating_images" : project.story_json ? "scenes_ready" : "queued";
  await deps.repo.updateProject(project.id, { status: next, error_message: null });
  log.info("project.retry", { projectId, from: failedJob?.job_type ?? "story", next });
}

export async function deleteProject(projectId: string, userId: string, deps: PipelineDeps) {
  const project = await loadOwned(projectId, userId, deps);
  const files = await deps.storage.list(project.id);
  if (files.length) await deps.storage.remove(files);
  await deps.repo.deleteProject(project.id);
  log.info("project.deleted", { projectId, files: files.length });
}

/**
 * "Clear temporary files": removes storage files no project still uses
 * (old overlays, replaced images/videos, leftovers of deleted projects) and
 * local render folders. Current scene images and final videos are kept.
 */
export async function clearTemporaryFiles(userId: string, deps: PipelineDeps) {
  const projects = await deps.repo.listProjects(userId);
  let removedFiles = 0;
  for (const project of projects) {
    if (ACTIVE_STATUSES.includes(project.status)) continue;
    const scenes = await deps.repo.listScenes(project.id);
    const keep = new Set<string>([...scenes.map((s) => s.image_url).filter((p): p is string => !!p)]);
    if (project.video_url) keep.add(project.video_url);
    const files = await deps.storage.list(project.id);
    const orphans = files.filter((f) => !keep.has(f));
    if (orphans.length) {
      await deps.storage.remove(orphans);
      const assets = await deps.repo.listAssets(project.id);
      await deps.repo.deleteAssets(assets.filter((a) => orphans.includes(a.asset_url)).map((a) => a.id));
      removedFiles += orphans.length;
    }
  }
  let removedFolders = 0;
  try {
    for (const entry of await readdir(tmpdir())) {
      if (entry.startsWith("alrs-render-")) {
        await rm(path.join(tmpdir(), entry), { recursive: true, force: true });
        removedFolders++;
      }
    }
  } catch (err) {
    log.warn("cleanup.tmp_failed", { error: err instanceof Error ? err.message : String(err) });
  }
  log.info("cleanup.done", { removedFiles, removedFolders });
  return { removedFiles, removedFolders };
}
