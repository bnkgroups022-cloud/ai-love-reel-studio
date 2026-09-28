import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle, readJson } from "@/lib/http/api";
import { buildReel } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { ProjectIdSchema } from "@/lib/validation/requests";

// Queues the MP4 render. The browser then drives it through /api/jobs/advance.
export const POST = handle("video.build", async (req: Request) => {
  const userId = await requireOwner();
  const { projectId } = ProjectIdSchema.parse(await readJson(req));
  await buildReel(projectId, userId, realDeps);
  return NextResponse.json({ ok: true });
});
