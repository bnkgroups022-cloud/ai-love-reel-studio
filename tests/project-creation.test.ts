import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createProject, UserActionError } from "@/lib/jobs/actions";
import { CreateProjectSchema } from "@/lib/validation/requests";
import { memoryRepo } from "./helpers/memory";

const valid = () => ({
  topic: "Ek baarish wali romantic love story",
  mood: "Romantic",
  style: "Cinematic Realistic",
  language: "Hindi",
  duration: 30,
  idempotencyKey: randomUUID(),
});

describe("project creation input", () => {
  it("accepts the default Create screen values", () => {
    expect(CreateProjectSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects unknown options and bad durations", () => {
    expect(CreateProjectSchema.safeParse({ ...valid(), mood: "Angry" }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ ...valid(), duration: 60 }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ ...valid(), idempotencyKey: "x" }).success).toBe(false);
  });

  it("rejects an empty topic and strips markup", () => {
    expect(CreateProjectSchema.safeParse({ ...valid(), topic: "  " }).success).toBe(false);
    const parsed = CreateProjectSchema.parse({ ...valid(), topic: "<b>Rainy</b> night love" });
    expect(parsed.topic).toBe("bRainy/b night love");
  });
});

describe("createProject", () => {
  it("creates a project and a queued story job", async () => {
    const { repo, jobs } = memoryRepo();
    const userId = await repo.getOrCreateUser("owner@test");
    const { project, created } = await createProject(CreateProjectSchema.parse(valid()), userId, { repo }, { maxPerHour: 10 });
    expect(created).toBe(true);
    expect(project.status).toBe("queued");
    expect(jobs.filter((j) => j.project_id === project.id).map((j) => [j.job_type, j.status])).toEqual([["story", "queued"]]);
  });

  it("prevents duplicate creation when CREATE REEL is sent twice", async () => {
    const { repo, projects, jobs } = memoryRepo();
    const userId = await repo.getOrCreateUser("owner@test");
    const input = CreateProjectSchema.parse(valid());
    const [a, b] = await Promise.all([
      createProject(input, userId, { repo }, { maxPerHour: 10 }),
      createProject(input, userId, { repo }, { maxPerHour: 10 }),
    ]);
    expect(a.project.id).toBe(b.project.id);
    expect(projects.size).toBe(1);
    expect(jobs.length).toBe(1);
  });

  it("enforces the hourly rate limit", async () => {
    const { repo } = memoryRepo();
    const userId = await repo.getOrCreateUser("owner@test");
    for (let i = 0; i < 3; i++) await createProject(CreateProjectSchema.parse(valid()), userId, { repo }, { maxPerHour: 3 });
    await expect(createProject(CreateProjectSchema.parse(valid()), userId, { repo }, { maxPerHour: 3 })).rejects.toBeInstanceOf(UserActionError);
  });
});
