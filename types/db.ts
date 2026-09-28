import type { Duration, Language, Mood, Style } from "@/lib/options";
import type { CharacterBible, Story } from "@/lib/validation/story";

export type ProjectStatus =
  | "queued"
  | "writing_story"
  | "generating_images"
  | "scenes_ready"
  | "render_queued"
  | "rendering"
  | "completed"
  | "failed";

export type ImageStatus = "pending" | "generating" | "done" | "failed";
export type JobType = "story" | "images" | "render";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type AssetType = "scene_image" | "overlay" | "video";

export interface ProjectRow {
  id: string;
  user_id: string;
  idempotency_key: string;
  topic: string;
  mood: Mood;
  style: Style;
  language: Language;
  duration: Duration;
  title: string | null;
  story_json: Story | null;
  character_bible_json: CharacterBible | null;
  seed: number;
  status: ProjectStatus;
  error_message: string | null;
  /** Storage object path, not a public URL. */
  video_url: string | null;
  /** Storage object path, not a public URL. */
  thumbnail_url: string | null;
  video_duration: number | null;
  story_provider: string | null;
  image_provider: string | null;
  video_provider: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneRow {
  id: string;
  project_id: string;
  scene_number: number;
  duration_seconds: number;
  description: string;
  action: string;
  emotion: string;
  location: string;
  time_of_day: string;
  lighting: string;
  camera: string;
  lens: string;
  characters_present: string[];
  image_prompt: string;
  text_overlay: string;
  transition: string;
  /** Storage object path, not a public URL. */
  image_url: string | null;
  image_status: ImageStatus;
  image_error: string | null;
  image_attempts: number;
  image_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  project_id: string;
  job_type: JobType;
  status: JobStatus;
  progress: number;
  message: string | null;
  error_message: string | null;
  provider_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  asset_type: AssetType;
  provider: string;
  provider_asset_id: string | null;
  asset_url: string;
  created_at: string;
}
