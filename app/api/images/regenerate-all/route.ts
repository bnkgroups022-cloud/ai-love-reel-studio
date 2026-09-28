import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle, readJson } from "@/lib/http/api";
import { regenerateAllScenes } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { ProjectIdSchema } from "@/lib/validation/requests";

// Queues all 8 images again (the story and characters are kept).
export const POST = handle("images.regenerate_all", async (req: Request) => {
  const userId = await requireOwner();
  const { projectId } = ProjectIdSchema.parse(await readJson(req));
  await regenerateAllScenes(projectId, userId, realDeps);
  return NextResponse.json({ ok: true });
});
