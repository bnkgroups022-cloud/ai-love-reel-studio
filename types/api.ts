// Shapes returned by the API to the browser. Never contain secrets or storage paths.
import type { JobRow, ProjectStatus, ImageStatus } from "./db";
import type { CharacterBible } from "@/lib/validation/story";

export interface SceneView {
  id: string;
  sceneNumber: number;
  durationSeconds: number;
  description: string;
  emotion: string;
  imagePrompt: string;
  textOverlay: string;
  imageStatus: ImageStatus;
  imageError: string | null;
  imageUrl: string | null;
}

export interface ProjectView {
  id: string;
  topic: string;
  mood: string;
  style: string;
  language: string;
  duration: number;
  title: string | null;
  hook: string | null;
  summary: string | null;
  characters: CharacterBible | null;
  status: ProjectStatus;
  errorMessage: string | null;
  videoUrl: string | null;
  videoAvailable: boolean;
  thumbnailUrl: string | null;
  storyProvider: string | null;
  imageProvider: string | null;
  videoProvider: string | null;
  createdAt: string;
  scenes: SceneView[];
  jobs: Pick<JobRow, "job_type" | "status" | "progress" | "message" | "error_message">[];
}

export interface ProjectListItem {
  id: string;
  title: string | null;
  topic: string;
  duration: number;
  status: ProjectStatus;
  createdAt: string;
  thumbnailUrl: string | null;
  videoAvailable: boolean;
}

export type ServiceState = "connected" | "not_connected" | "error" | "demo";

export interface ServiceStatus {
  service: string;
  provider: string;
  state: ServiceState;
  detail: string;
}
