"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, Chips, ErrorCard, Spinner } from "@/components/ui/bits";
import { DURATIONS, LANGUAGES, MOODS, STYLES, TEST_TOPIC } from "@/lib/options";
import { usePrefs, type Prefs } from "@/lib/prefs";

const IDEAS = ["College love story", "Rainy night love", "First meeting", "Long distance relationship", "Village love story", "Railway station love story"];

export function CreateForm({ showTestButton }: { showTestButton: boolean }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const saved = usePrefs();
  const [edits, setEdits] = useState<Partial<Prefs>>({});
  const prefs: Prefs = { ...saved, ...edits };
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One request id per attempt: a double tap or a network retry can't create two Reels.
  const requestId = useRef<string>("");

  useEffect(() => {
    requestId.current = crypto.randomUUID();
  }, []);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setEdits((p) => ({ ...p, [key]: value }));

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (creating) return;
    if (topic.trim().length < 3) {
      setError("Please describe your story in a few words first.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ topic, ...prefs, idempotencyKey: requestId.current }),
      });
      router.push(`/project/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
      requestId.current = crypto.randomUUID();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label htmlFor="topic" className="mb-2 block text-lg font-semibold">
          What kind of story do you want?
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ek baarish wali romantic love story"
          rows={3}
          maxLength={200}
          className="w-full resize-none rounded-2xl border border-line bg-panel-2 p-4 text-lg leading-relaxed text-text placeholder:text-faint focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
        />
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setTopic(idea)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-text">
              {idea}
            </button>
          ))}
        </div>
      </div>

      <Chips label="Mood" options={MOODS} value={prefs.mood} onChange={(v) => set("mood", v)} />
      <Chips label="Visual style" options={STYLES} value={prefs.style} onChange={(v) => set("style", v)} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Chips label="Language" options={LANGUAGES} value={prefs.language} onChange={(v) => set("language", v)} />
        <Chips label="Duration" options={DURATIONS} value={prefs.duration} onChange={(v) => set("duration", v)} format={(d) => `${d} sec`} />
      </div>

      {error && <ErrorCard title="Could not start your Reel" message={error} />}

      <button type="submit" disabled={creating} className="btn-primary flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-bold tracking-[0.12em] active:scale-[0.99]">
        {creating ? (
          <>
            <Spinner /> Creating...
          </>
        ) : (
          "CREATE REEL"
        )}
      </button>

      {showTestButton && (
        <button type="button" onClick={() => setTopic(TEST_TOPIC)} className="w-full text-center text-sm text-faint underline underline-offset-4">
          Dev: fill the sample test topic
        </button>
      )}
    </form>
  );
}
