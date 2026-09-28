import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AssetRow, JobRow, JobType, ProjectRow, SceneRow } from "@/types/db";

// Data access for every table. The pipeline depends on this interface (not on
// Supabase directly) so it can be tested with an in-memory version.

export type NewProject = Pick<ProjectRow, "user_id" | "idempotency_key" | "topic" | "mood" | "style" | "language" | "duration">;
export type NewScene = Omit<SceneRow, "id" | "created_at" | "updated_at" | "image_url" | "image_status" | "image_error" | "image_attempts" | "image_provider">;
export type NewAsset = Omit<AssetRow, "id" | "created_at">;

export interface Repo {
  getOrCreateUser(email: string): Promise<string>;
  createProject(p: NewProject): Promise<{ project: ProjectRow; created: boolean }>;
  findProjectByIdempotencyKey(key: string): Promise<ProjectRow | null>;
  countProjectsSince(userId: string, sinceIso: string): Promise<number>;
  getProject(id: string): Promise<ProjectRow | null>;
  listProjects(userId: string): Promise<ProjectRow[]>;
  updateProject(id: string, patch: Partial<ProjectRow>): Promise<ProjectRow>;
  deleteProject(id: string): Promise<void>;
  /** Atomically takes the project's work lock. Returns null if someone else holds it. */
  tryLock(id: string, seconds: number): Promise<ProjectRow | null>;
  unlock(id: string): Promise<void>;

  replaceScenes(projectId: string, scenes: NewScene[]): Promise<SceneRow[]>;
  listScenes(projectId: string): Promise<SceneRow[]>;
  getScene(id: string): Promise<SceneRow | null>;
  updateScene(id: string, patch: Partial<SceneRow>): Promise<SceneRow>;
  updateScenesForProject(projectId: string, patch: Partial<SceneRow>): Promise<void>;

  createJob(projectId: string, type: JobType, fields?: Partial<JobRow>): Promise<JobRow>;
  updateJob(id: string, patch: Partial<JobRow>): Promise<JobRow>;
  latestJob(projectId: string, type?: JobType): Promise<JobRow | null>;
  listJobs(projectId: string): Promise<JobRow[]>;

  insertAsset(a: NewAsset): Promise<void>;
  listAssets(projectId?: string): Promise<AssetRow[]>;
  deleteAssets(ids: string[]): Promise<void>;
}

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new Error(`Database error while ${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`Database error while ${what}: no data returned`);
  return res.data;
}

export const supabaseRepo: Repo = {
  async getOrCreateUser(email) {
    const db = supabaseAdmin();
    const found = await db.from("users").select("id").eq("email", email).maybeSingle();
    if (found.error) throw new Error(`Database error while loading user: ${found.error.message}`);
    if (found.data) return found.data.id as string;
    const inserted = await db.from("users").upsert({ email }, { onConflict: "email" }).select("id").single();
    return must(inserted, "creating user").id as string;
  },

  async createProject(p) {
    const db = supabaseAdmin();
    const res = await db.from("projects").insert(p).select("*").single();
    if (res.error?.code === "23505") {
      // Same idempotency key already used: the browser retried, return the existing project.
      const existing = await db.from("projects").select("*").eq("idempotency_key", p.idempotency_key).single();
      return { project: must(existing, "loading existing project") as ProjectRow, created: false };
    }
    return { project: must(res, "creating project") as ProjectRow, created: true };
  },

  async findProjectByIdempotencyKey(key) {
    const res = await supabaseAdmin().from("projects").select("*").eq("idempotency_key", key).maybeSingle();
    if (res.error) throw new Error(`Database error while checking for duplicates: ${res.error.message}`);
    return (res.data as ProjectRow) ?? null;
  },

  async countProjectsSince(userId, sinceIso) {
    const res = await supabaseAdmin()
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", sinceIso);
    if (res.error) throw new Error(`Database error while checking rate limit: ${res.error.message}`);
    return res.count ?? 0;
  },

  async getProject(id) {
    const res = await supabaseAdmin().from("projects").select("*").eq("id", id).maybeSingle();
    if (res.error) throw new Error(`Database error while loading project: ${res.error.message}`);
    return (res.data as ProjectRow) ?? null;
  },

  async listProjects(userId) {
    const res = await supabaseAdmin()
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return must(res, "listing projects") as ProjectRow[];
  },

  async updateProject(id, patch) {
    const res = await supabaseAdmin().from("projects").update(patch).eq("id", id).select("*").single();
    return must(res, "updating project") as ProjectRow;
  },

  async deleteProject(id) {
    const res = await supabaseAdmin().from("projects").delete().eq("id", id);
    if (res.error) throw new Error(`Database error while deleting project: ${res.error.message}`);
  },

  async tryLock(id, seconds) {
    const now = new Date().toISOString();
    const until = new Date(Date.now() + seconds * 1000).toISOString();
    const res = await supabaseAdmin()
      .from("projects")
      .update({ locked_until: until })
      .eq("id", id)
      .or(`locked_until.is.null,locked_until.lt.${now}`)
      .select("*")
      .maybeSingle();
    if (res.error) throw new Error(`Database error while locking project: ${res.error.message}`);
    return (res.data as ProjectRow) ?? null;
  },

  async unlock(id) {
    await supabaseAdmin().from("projects").update({ locked_until: null }).eq("id", id);
  },

  async replaceScenes(projectId, scenes) {
    const db = supabaseAdmin();
    const del = await db.from("project_scenes").delete().eq("project_id", projectId);
    if (del.error) throw new Error(`Database error while replacing scenes: ${del.error.message}`);
    const res = await db.from("project_scenes").insert(scenes).select("*").order("scene_number");
    return must(res, "saving scenes") as SceneRow[];
  },

  async listScenes(projectId) {
    const res = await supabaseAdmin().from("project_scenes").select("*").eq("project_id", projectId).order("scene_number");
    return must(res, "loading scenes") as SceneRow[];
  },

  async getScene(id) {
    const res = await supabaseAdmin().from("project_scenes").select("*").eq("id", id).maybeSingle();
    if (res.error) throw new Error(`Database error while loading scene: ${res.error.message}`);
    return (res.data as SceneRow) ?? null;
  },

  async updateScene(id, patch) {
    const res = await supabaseAdmin().from("project_scenes").update(patch).eq("id", id).select("*").single();
    return must(res, "updating scene") as SceneRow;
  },

  async updateScenesForProject(projectId, patch) {
    const res = await supabaseAdmin().from("project_scenes").update(patch).eq("project_id", projectId);
    if (res.error) throw new Error(`Database error while updating scenes: ${res.error.message}`);
  },

  async createJob(projectId, type, fields = {}) {
    const res = await supabaseAdmin()
      .from("jobs")
      .insert({ project_id: projectId, job_type: type, ...fields })
      .select("*")
      .single();
    return must(res, "creating job") as JobRow;
  },

  async updateJob(id, patch) {
    const res = await supabaseAdmin().from("jobs").update(patch).eq("id", id).select("*").single();
    return must(res, "updating job") as JobRow;
  },

  async latestJob(projectId, type) {
    let q = supabaseAdmin().from("jobs").select("*").eq("project_id", projectId);
    if (type) q = q.eq("job_type", type);
    const res = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (res.error) throw new Error(`Database error while loading job: ${res.error.message}`);
    return (res.data as JobRow) ?? null;
  },

  async listJobs(projectId) {
    const res = await supabaseAdmin().from("jobs").select("*").eq("project_id", projectId).order("created_at");
    return must(res, "loading jobs") as JobRow[];
  },

  async insertAsset(a) {
    const res = await supabaseAdmin().from("generated_assets").insert(a);
    if (res.error) throw new Error(`Database error while saving asset record: ${res.error.message}`);
  },

  async listAssets(projectId) {
    let q = supabaseAdmin().from("generated_assets").select("*");
    if (projectId) q = q.eq("project_id", projectId);
    const res = await q.limit(5000);
    return must(res, "loading assets") as AssetRow[];
  },

  async deleteAssets(ids) {
    if (ids.length === 0) return;
    const res = await supabaseAdmin().from("generated_assets").delete().in("id", ids);
    if (res.error) throw new Error(`Database error while deleting asset records: ${res.error.message}`);
  },
};
