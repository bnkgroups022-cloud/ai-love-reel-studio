import type { Repo } from "@/lib/db/repo";
import type { Storage } from "@/lib/supabase/storage";
import type { ProjectListItem, ProjectView } from "@/types/api";
import type { ProjectRow } from "@/types/db";

const VIEW_URL_SECONDS = 60 * 60;

export async function buildProjectView(project: ProjectRow, deps: { repo: Repo; storage: Storage }): Promise<ProjectView> {
  const [scenes, jobs] = await Promise.all([deps.repo.listScenes(project.id), deps.repo.listJobs(project.id)]);
  const paths = scenes.map((s) => s.image_url).filter((p): p is string => !!p);
  if (project.video_url) paths.push(project.video_url);
  // createSignedUrls only returns URLs for files that still exist.
  const urls = await deps.storage.signedUrls(paths, VIEW_URL_SECONDS);
  const videoUrl = project.video_url ? (urls.get(project.video_url) ?? null) : null;

  return {
    id: project.id,
    topic: project.topic,
    mood: project.mood,
    style: project.style,
    language: project.language,
    duration: project.duration,
    title: project.title,
    hook: project.story_json?.hook ?? null,
    summary: project.story_json?.summary ?? null,
    characters: project.character_bible_json,
    status: project.status,
    errorMessage: project.error_message,
    videoUrl,
    videoAvailable: !!videoUrl,
    thumbnailUrl: project.thumbnail_url ? (urls.get(project.thumbnail_url) ?? null) : null,
    storyProvider: project.story_provider,
    imageProvider: project.image_provider,
    videoProvider: project.video_provider,
    createdAt: project.created_at,
    scenes: scenes.map((s) => ({
      id: s.id,
      sceneNumber: s.scene_number,
      durationSeconds: Number(s.duration_seconds),
      description: s.description,
      emotion: s.emotion,
      imagePrompt: s.image_prompt,
      textOverlay: s.text_overlay,
      imageStatus: s.image_status,
      imageError: s.image_error,
      imageUrl: s.image_url ? (urls.get(s.image_url) ?? null) : null,
    })),
    jobs: jobs.map((j) => ({ job_type: j.job_type, status: j.status, progress: j.progress, message: j.message, error_message: j.error_message })),
  };
}

export async function buildProjectList(projects: ProjectRow[], storage: Storage): Promise<ProjectListItem[]> {
  const paths = projects.flatMap((p) => [p.thumbnail_url, p.video_url]).filter((x): x is string => !!x);
  const urls = await storage.signedUrls(paths, VIEW_URL_SECONDS);
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    topic: p.topic,
    duration: p.duration,
    status: p.status,
    createdAt: p.created_at,
    thumbnailUrl: p.thumbnail_url ? (urls.get(p.thumbnail_url) ?? null) : null,
    videoAvailable: !!(p.video_url && urls.get(p.video_url)),
  }));
}
