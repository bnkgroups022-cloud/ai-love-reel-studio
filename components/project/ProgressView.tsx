"use client";

import { buildSteps, type StepState } from "@/lib/progress";
import type { ProjectView } from "@/types/api";
import { Spinner } from "@/components/ui/bits";

function Dot({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    );
  if (state === "active")
    return (
      <span className="pulse-ring flex h-6 w-6 items-center justify-center rounded-full border border-amber text-amber">
        <Spinner className="h-4 w-4" />
      </span>
    );
  if (state === "failed") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bad text-sm font-bold text-ink">!</span>;
  return <span className="h-6 w-6 rounded-full border border-line" />;
}

export function ProgressView({ view }: { view: ProjectView }) {
  const steps = buildSteps(view);
  const done = steps.filter((s) => s.state === "done").length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section aria-live="polite" className="rounded-3xl border border-line bg-panel/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Creating your Reel</h2>
        <span className="text-sm tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-deep to-amber transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="flex gap-3">
            <Dot state={s.state} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] ${s.state === "pending" ? "text-faint" : s.state === "failed" ? "text-bad" : "text-text"}`}>{s.label}</p>
              {s.note && <p className="mt-0.5 text-xs leading-snug text-muted">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs leading-relaxed text-faint">Keep this screen open while your Reel is being made. If you close it, the work pauses and continues when you open this Reel again.</p>
    </section>
  );
}
