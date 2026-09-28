import { NextResponse } from "next/server";
import { requireOwner, requireSession } from "@/lib/auth/guard";
import { env } from "@/lib/env";
import { handle, readJson } from "@/lib/http/api";
import { createProject } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { buildProjectList } from "@/lib/jobs/views";
import { CreateProjectSchema } from "@/lib/validation/requests";

export const GET = handle("projects.list", async () => {
  const userId = await requireOwner();
  const projects = await realDeps.repo.listProjects(userId);
  return NextResponse.json({ projects: await buildProjectList(projects, realDeps.storage) });
});

export const POST = handle("projects.create", async (req: Request) => {
  await requireSession();
  const input = CreateProjectSchema.parse(await readJson(req));
  const userId = await requireOwner();
  const { project, created } = await createProject(input, userId, realDeps, { maxPerHour: env().maxProjectsPerHour });
  return NextResponse.json({ id: project.id, created }, { status: created ? 201 : 200 });
});
