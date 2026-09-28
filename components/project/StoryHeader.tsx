import type { ProjectView } from "@/types/api";
import { StatusPill } from "@/components/ui/bits";

export function StoryHeader({ view }: { view: ProjectView }) {
  const { characters } = view;
  return (
    <header>
      <div className="flex items-center gap-2 text-xs text-muted">
        <StatusPill status={view.status} />
        <span>
          {view.mood} · {view.style} · {view.language} · {view.duration}s
        </span>
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight">{view.title ?? view.topic}</h1>
      {view.hook && <p className="mt-1 text-[15px] italic text-amber/90">{view.hook}</p>}
      {characters && (
        <details className="mt-3 rounded-2xl border border-line bg-panel/60 p-3 text-sm">
          <summary className="cursor-pointer select-none font-semibold text-muted">Character bible (kept the same in every scene)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["male", "female"] as const).map((role) => {
              const c = characters[role];
              return (
                <div key={role} className="rounded-xl bg-panel-2 p-3">
                  <p className="font-semibold">
                    {c.name}, {c.age}
                  </p>
                  <p className="mt-1 text-muted">
                    {c.skin_tone} skin · {c.hairstyle}
                    {role === "male" && c.facial_hair && c.facial_hair !== "none" ? ` · ${c.facial_hair}` : ""}
                  </p>
                  <p className="mt-1 text-muted">Wears {c.clothing}</p>
                  {c.accessories && <p className="mt-1 text-muted">{c.accessories}</p>}
                </div>
              );
            })}
          </div>
          {view.summary && <p className="mt-3 leading-relaxed text-muted">{view.summary}</p>}
        </details>
      )}
    </header>
  );
}
