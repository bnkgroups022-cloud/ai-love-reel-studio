"use client";

import { useState } from "react";
import type { SceneView } from "@/types/api";

export function EditPromptSheet({ scene, onClose, onSave }: { scene: SceneView; onClose: () => void; onSave: (prompt: string) => void }) {
  const [text, setText] = useState(scene.imagePrompt);
  const tooShort = text.trim().length < 20;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-modal="true" aria-label={`Edit prompt for scene ${scene.sceneNumber}`} onClick={onClose}>
      <div className="pb-safe w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl font-semibold">Scene {scene.sceneNumber} — what should the picture show?</h3>
        <p className="mt-1 text-sm text-muted">
          Describe the shot in plain English. The couple&apos;s looks and clothes are added automatically, so you don&apos;t need to repeat them.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={900}
          className="mt-4 w-full rounded-2xl border border-line bg-panel-2 p-3 text-[15px] leading-relaxed focus:border-amber focus:outline-none"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="min-h-12 rounded-xl border border-line font-semibold text-muted">
            Cancel
          </button>
          <button onClick={() => onSave(text.trim())} disabled={tooShort} className="btn-primary min-h-12 rounded-xl text-sm font-bold tracking-wider">
            SAVE & REGENERATE
          </button>
        </div>
      </div>
    </div>
  );
}
