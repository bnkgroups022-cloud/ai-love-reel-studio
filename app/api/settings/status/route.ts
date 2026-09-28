import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { handle } from "@/lib/http/api";
import { checkAllServices } from "@/lib/status";

export const GET = handle("settings.status", async () => {
  await requireSession();
  return NextResponse.json({ services: await checkAllServices() });
});
