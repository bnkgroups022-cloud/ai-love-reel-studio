import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle } from "@/lib/http/api";
import { retryProject } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { UuidSchema } from "@/lib/validation/requests";

export const POST = handle("projects.retry", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireOwner();
  const id = UuidSchema.parse((await ctx.params).id);
  await retryProject(id, userId, realDeps);
  return NextResponse.json({ ok: true });
});
