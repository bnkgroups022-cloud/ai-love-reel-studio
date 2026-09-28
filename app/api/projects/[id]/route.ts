import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle } from "@/lib/http/api";
import { deleteProject, UserActionError } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { buildProjectView } from "@/lib/jobs/views";
import { UuidSchema } from "@/lib/validation/requests";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle("projects.get", async (_req: Request, ctx: Ctx) => {
  const userId = await requireOwner();
  const id = UuidSchema.parse((await ctx.params).id);
  const project = await realDeps.repo.getProject(id);
  if (!project || project.user_id !== userId) throw new UserActionError("This Reel was not found. It may have been deleted.", 404);
  return NextResponse.json({ project: await buildProjectView(project, realDeps) });
});

export const DELETE = handle("projects.delete", async (_req: Request, ctx: Ctx) => {
  const userId = await requireOwner();
  const id = UuidSchema.parse((await ctx.params).id);
  await deleteProject(id, userId, realDeps);
  return NextResponse.json({ ok: true });
});
