import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/guard";
import { ConfigError } from "@/lib/env";
import { UserActionError } from "@/lib/jobs/actions";
import { log } from "@/lib/log";
import { describeIssues } from "@/lib/validation/story";

/** Wraps a route handler so every error becomes a clear JSON message. */
export function handle<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
      if (err instanceof UserActionError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: describeIssues(err) }, { status: 400 });
      if (err instanceof ConfigError) {
        log.error("api.config_error", { route: name, error: err.message });
        return NextResponse.json({ error: err.message, kind: "config" }, { status: 503 });
      }
      log.error("api.error", { route: name, error: err });
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new UserActionError("The request body was not valid JSON.");
  }
}
