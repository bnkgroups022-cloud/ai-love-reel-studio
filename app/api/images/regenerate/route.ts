import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard";
import { handle, readJson } from "@/lib/http/api";
import { regenerateScene } from "@/lib/jobs/actions";
import { realDeps } from "@/lib/jobs/deps";
import { RegenerateSceneSchema } from "@/lib/validation/requests";

// Regenerates exactly one scene image (optionally with an edited prompt).
export const maxDuration = 300;

export const POST = handle("images.regenerate", async (req: Request) => {
  const userId = await requireOwner();
  const input = RegenerateSceneSchema.parse(await readJson(req));
  const scene = await regenerateScene({ ...input, userId }, realDeps);
  return NextResponse.json({ status: scene.image_status, error: scene.image_error });
});
