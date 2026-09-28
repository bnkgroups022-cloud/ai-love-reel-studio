"use client";

import type { ReactNode } from "react";

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorCard({ title = "This step did not work", message, onRetry, retryLabel = "TRY AGAIN", busy }: { title?: string; message: string; onRetry?: () => void; retryLabel?: string; busy?: boolean }) {
  return (
    <div role="alert" className="rounded-2xl border border-bad/40 bg-bad/10 p-4">
      <p className="text-sm font-semibold text-bad">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-text">{message}</p>
      {onRetry && (
        <button onClick={onRetry} disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-bad/50 px-4 text-sm font-semibold tracking-wide text-text active:scale-[0.98] disabled:opacity-60">
          {busy && <Spinner className="h-4 w-4" />}
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel/80 p-4 ${className}`}>{children}</div>;
}

export function Chips<T extends string | number>({ label, options, value, onChange, format }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt)}
              className={`min-h-11 rounded-full border px-4 text-[15px] transition ${active ? "border-amber bg-amber/15 text-amber" : "border-line bg-panel-2 text-text/85 hover:border-faint"}`}
            >
              {format ? format(opt) : String(opt)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    completed: ["Ready", "text-ok border-ok/40"],
    failed: ["Failed", "text-bad border-bad/40"],
    scenes_ready: ["Scenes ready", "text-amber border-amber/40"],
    queued: ["Starting", "text-muted border-line"],
    writing_story: ["Writing story", "text-violet border-violet/40"],
    generating_images: ["Making images", "text-violet border-violet/40"],
    render_queued: ["Building", "text-violet border-violet/40"],
    rendering: ["Rendering", "text-violet border-violet/40"],
  };
  const [label, cls] = map[status] ?? [status, "text-muted border-line"];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** fetch() helper that returns the server's JSON error message. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new Error("No internet connection, or the server could not be reached.");
  }
  if (res.status === 401) {
    window.location.assign(new URL("/login", window.location.origin).href);
    throw new Error("Please unlock the app first.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `The server returned an error (${res.status}).`);
  return data as T;
}
