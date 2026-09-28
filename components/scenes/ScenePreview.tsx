"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/bits";
import type { ProjectView, SceneView } from "@/types/api";
import { EditPromptSheet } from "./EditPromptSheet";
import { SceneCard } from "./SceneCard";

export function ScenePreview(props: {
  view: ProjectView;
  busyScene: string | null;
  busyAction: string | null;
  locked: boolean;
  collapsed: boolean;
  onRegenerate: (sceneId: string, prompt?: string) => void;
  onRegenerateAll: () => void;
  onBuild: () => void;
}) {
  const { view, busyScene, busyAction, locked } = props;
  const [editing, setEditing] = useState<SceneView | null>(null);
  const [open, setOpen] = useState(!props.collapsed);
  const allReady = view.scenes.length === 8 && view.scenes.every((s) => s.imageStatus === "done");
  const failedCount = view.scenes.filter((s) => s.imageStatus === "failed").length;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-12 w-full rounded-2xl border border-line text-sm font-semibold tracking-wide text-muted">
        SHOW THE 8 SCENES
      </button>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-semibold">Scene preview</h2>
        <span className="text-sm text-muted">{view.scenes.reduce((a, s) => a + s.durationSeconds, 0)}s total</span>
      </div>
      {view.imageProvider === "demo" && (
        <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm text-amber">Demo mode — these are labelled placeholders, not AI images.</p>
      )}
      {failedCount > 0 && (
        <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-text">
          {failedCount === 1 ? "1 scene" : `${failedCount} scenes`} could not be generated. Press TRY AGAIN on {failedCount === 1 ? "it" : "them"} — only {failedCount === 1 ? "that scene" : "those scenes"} will be made again.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {view.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            busy={busyScene === scene.id}
            disabled={locked}
            onRegenerate={() => props.onRegenerate(scene.id)}
            onEdit={() => setEditing(scene)}
          />
        ))}
      </div>

      <div className="sticky bottom-20 z-20 grid grid-cols-2 gap-3 rounded-2xl bg-ink/85 py-2 backdrop-blur">
        <button
          onClick={() => {
            if (confirm("Make all 8 images again? This uses 8 new image generations. Your story and characters stay the same.")) props.onRegenerateAll();
          }}
          disabled={locked}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-panel-2 text-sm font-bold tracking-widest disabled:opacity-50"
        >
          {busyAction === "regenerate-all" && <Spinner className="h-4 w-4" />}
          REGENERATE ALL
        </button>
        <button onClick={props.onBuild} disabled={locked || !allReady} className="btn-primary flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-widest">
          {busyAction === "build" && <Spinner className="h-4 w-4" />}
          BUILD REEL
        </button>
      </div>
      {!allReady && <p className="text-center text-xs text-muted">BUILD REEL unlocks when all 8 scenes have an image.</p>}

      {editing && (
        <EditPromptSheet
          scene={editing}
          onClose={() => setEditing(null)}
          onSave={(prompt) => {
            setEditing(null);
            props.onRegenerate(editing.id, prompt);
          }}
        />
      )}
    </section>
  );
}
