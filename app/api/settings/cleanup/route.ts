import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle } from "@/lib/http/api";
import { clearTemporaryFiles } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";

export const maxDuration = 120;

export const POST = handle("settings.cleanup", async () => {
  const userId = await requireOwner();
  return NextResponse.json(await clearTemporaryFiles(userId, realDeps));
});
