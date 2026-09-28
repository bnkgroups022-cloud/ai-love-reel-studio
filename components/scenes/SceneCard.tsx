"use client";

import { Spinner } from "@/components/ui/bits";
import type { SceneView } from "@/types/api";

export function SceneCard({ scene, busy, disabled, onRegenerate, onEdit }: { scene: SceneView; busy: boolean; disabled: boolean; onRegenerate: () => void; onEdit: () => void }) {
  const generating = busy || scene.imageStatus === "generating";
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="relative aspect-[9/16] w-full bg-panel-2">
        {scene.imageUrl && !generating && (
          // Signed, short-lived storage URLs — plain <img> avoids caching them in the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}: ${scene.description}`} className="h-full w-full object-cover" loading="lazy" />
        )}
        {generating && (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            <Spinner className="h-6 w-6 text-amber" />
            Generating…
          </div>
        )}
        {!generating && scene.imageStatus === "failed" && (
          <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-bad/10 p-3 text-center">
            <p className="text-xs leading-snug text-text">{scene.imageError}</p>
            <button onClick={onRegenerate} disabled={disabled} className="mx-auto min-h-10 rounded-xl border border-bad/50 px-3 text-xs font-bold tracking-wider disabled:opacity-50">
              TRY AGAIN
            </button>
          </div>
        )}
        {!generating && scene.imageStatus === "pending" && <div className="absolute inset-0 flex items-center justify-center text-xs text-faint">Waiting…</div>}
        <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-semibold backdrop-blur">
          {scene.sceneNumber} · {scene.durationSeconds}s
        </span>
        {scene.textOverlay && !generating && scene.imageUrl && (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-ink/70 px-2 py-1 text-center text-[11px] leading-tight backdrop-blur">“{scene.textOverlay}”</span>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        <p className="line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-muted">{scene.description}</p>
        <div className="grid grid-cols-1 gap-1.5">
          <button onClick={onRegenerate} disabled={disabled || generating} className="min-h-10 rounded-lg bg-panel-2 text-[11px] font-bold tracking-wider disabled:opacity-40">
            REGENERATE SCENE
          </button>
          <button onClick={onEdit} disabled={disabled || generating} className="min-h-10 rounded-lg border border-line text-[11px] font-bold tracking-wider text-muted disabled:opacity-40">
            EDIT PROMPT
          </button>
        </div>
      </div>
    </article>
  );
}
