import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle } from "@/lib/http/api";
import { UserActionError } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { UuidSchema } from "@/lib/validation/requests";
import { downloadFileName } from "@/lib/video/download";

// Redirects to a short-lived signed URL that forces a file download
// (Content-Disposition: attachment), which works on mobile browsers.
export const GET = handle("video.download", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireOwner();
  const id = UuidSchema.parse((await ctx.params).id);
  const project = await realDeps.repo.getProject(id);
  if (!project || project.user_id !== userId) throw new UserActionError("This Reel was not found.", 404);
  if (!project.video_url) throw new UserActionError("This Reel has no video yet.", 404);
  const url = await realDeps.storage.signedUrl(project.video_url, 10 * 60, downloadFileName(project.title, project.id));
  if (!url) throw new UserActionError("Video expired or unavailable.", 410);
  return NextResponse.redirect(url, 302);
});
