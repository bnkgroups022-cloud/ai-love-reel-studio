import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle, readJson } from "@/lib/http/api";
import { UserActionError } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { advanceProject } from "@/lib/jobs/pipeline";
import { ProjectIdSchema } from "@/lib/validation/requests";

// Runs ONE real pipeline step (story, one image, start render, or check render).
// The browser calls this repeatedly while a Reel is being made.
export const maxDuration = 300;

export const POST = handle("jobs.advance", async (req: Request) => {
  const userId = await requireOwner();
  const { projectId } = ProjectIdSchema.parse(await readJson(req));
  const project = await realDeps.repo.getProject(projectId);
  if (!project || project.user_id !== userId) throw new UserActionError("This Reel was not found.", 404);
  const result = await advanceProject(projectId, realDeps);
  return NextResponse.json(result);
});
