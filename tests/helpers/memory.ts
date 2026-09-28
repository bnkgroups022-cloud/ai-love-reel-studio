import { randomUUID } from "node:crypto";
import type { Repo } from "@/lib/db/repo";
import type { Storage } from "@/lib/supabase/storage";
import type { AssetRow, JobRow, ProjectRow, SceneRow } from "@/types/db";

// In-memory stand-ins for Supabase used by tests.

export function memoryRepo() {
  const users = new Map<string, string>();
  const projects = new Map<string, ProjectRow>();
  const scenes = new Map<string, SceneRow>();
  const jobs: JobRow[] = [];
  const assets: AssetRow[] = [];
  let clock = Date.now();
  const now = () => new Date(clock++).toISOString();

  const repo: Repo = {
    async getOrCreateUser(email) {
      if (!users.has(email)) users.set(email, randomUUID());
      return users.get(email)!;
    },
    async createProject(p) {
      const existing = [...projects.values()].find((x) => x.idempotency_key === p.idempotency_key);
      if (existing) return { project: existing, created: false };
      const row: ProjectRow = {
        ...p,
        id: randomUUID(),
        title: null,
        story_json: null,
        character_bible_json: null,
        seed: 12345,
        status: "queued",
        error_message: null,
        video_url: null,
        thumbnail_url: null,
        video_duration: null,
        story_provider: null,
        image_provider: null,
        video_provider: null,
        locked_until: null,
        created_at: now(),
        updated_at: now(),
      };
      projects.set(row.id, row);
      return { project: row, created: true };
    },
    async findProjectByIdempotencyKey(key) {
      return [...projects.values()].find((x) => x.idempotency_key === key) ?? null;
    },
    async countProjectsSince(userId, since) {
      return [...projects.values()].filter((p) => p.user_id === userId && p.created_at >= since).length;
    },
    async getProject(id) {
      const p = projects.get(id);
      return p ? { ...p } : null;
    },
    async listProjects(userId) {
      return [...projects.values()].filter((p) => p.user_id === userId);
    },
    async updateProject(id, patch) {
      const p = { ...projects.get(id)!, ...patch, updated_at: now() };
      projects.set(id, p);
      return { ...p };
    },
    async deleteProject(id) {
      projects.delete(id);
      for (const [sid, s] of scenes) if (s.project_id === id) scenes.delete(sid);
    },
    async tryLock(id, seconds) {
      const p = projects.get(id);
      if (!p) return null;
      if (p.locked_until && new Date(p.locked_until).getTime() > Date.now()) return null;
      p.locked_until = new Date(Date.now() + seconds * 1000).toISOString();
      return { ...p };
    },
    async unlock(id) {
      const p = projects.get(id);
      if (p) p.locked_until = null;
    },
    async replaceScenes(projectId, list) {
      for (const [sid, s] of scenes) if (s.project_id === projectId) scenes.delete(sid);
      return list.map((s) => {
        const row: SceneRow = {
          ...s,
          id: randomUUID(),
          image_url: null,
          image_status: "pending",
          image_error: null,
          image_attempts: 0,
          image_provider: null,
          created_at: now(),
          updated_at: now(),
        };
        scenes.set(row.id, row);
        return { ...row };
      });
    },
    async listScenes(projectId) {
      return [...scenes.values()].filter((s) => s.project_id === projectId).sort((a, b) => a.scene_number - b.scene_number).map((s) => ({ ...s }));
    },
    async getScene(id) {
      const s = scenes.get(id);
      return s ? { ...s } : null;
    },
    async updateScene(id, patch) {
      const s = { ...scenes.get(id)!, ...patch, updated_at: now() };
      scenes.set(id, s);
      return { ...s };
    },
    async updateScenesForProject(projectId, patch) {
      for (const [sid, s] of scenes) if (s.project_id === projectId) scenes.set(sid, { ...s, ...patch, updated_at: now() });
    },
    async createJob(projectId, type, fields = {}) {
      const job: JobRow = {
        id: randomUUID(),
        project_id: projectId,
        job_type: type,
        status: "queued",
        progress: 0,
        message: null,
        error_message: null,
        provider_job_id: null,
        created_at: now(),
        updated_at: now(),
        ...fields,
      };
      jobs.push(job);
      return { ...job };
    },
    async updateJob(id, patch) {
      const i = jobs.findIndex((j) => j.id === id);
      jobs[i] = { ...jobs[i], ...patch, updated_at: now() };
      return { ...jobs[i] };
    },
    async latestJob(projectId, type) {
      const list = jobs.filter((j) => j.project_id === projectId && (!type || j.job_type === type));
      return list.length ? { ...list[list.length - 1] } : null;
    },
    async listJobs(projectId) {
      return jobs.filter((j) => j.project_id === projectId).map((j) => ({ ...j }));
    },
    async insertAsset(a) {
      assets.push({ ...a, id: randomUUID(), created_at: now() });
    },
    async listAssets(projectId) {
      return assets.filter((a) => !projectId || a.project_id === projectId).map((a) => ({ ...a }));
    },
    async deleteAssets(ids) {
      for (const id of ids) {
        const i = assets.findIndex((a) => a.id === id);
        if (i >= 0) assets.splice(i, 1);
      }
    },
  };
  return { repo, projects, scenes, jobs, assets };
}

export function memoryStorage() {
  const files = new Map<string, Buffer>();
  const storage: Storage = {
    async upload(path, data) {
      files.set(path, data);
    },
    async signedUrl(path, _exp, downloadName) {
      if (!files.has(path)) return null;
      return `https://storage.test/${path}?token=t${downloadName ? `&download=${downloadName}` : ""}`;
    },
    async signedUrls(paths) {
      const out = new Map<string, string>();
      for (const p of paths) if (files.has(p)) out.set(p, `https://storage.test/${p}?token=t`);
      return out;
    },
    async download(path) {
      const f = files.get(path);
      if (!f) throw new Error("not found");
      return f;
    },
    async list(prefix) {
      return [...files.keys()].filter((k) => k.startsWith(prefix));
    },
    async remove(paths) {
      for (const p of paths) files.delete(p);
    },
  };
  return { storage, files };
}
