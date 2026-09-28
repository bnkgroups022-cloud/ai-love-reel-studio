"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ErrorCard, Spinner, StatusPill } from "@/components/ui/bits";
import type { ProjectListItem } from "@/types/api";

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ projects: ProjectListItem[] }>("/api/projects")
      .then(({ projects }) => {
        if (!cancelled) setItems(projects);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function remove(item: ProjectListItem) {
    if (!confirm(`Delete "${item.title ?? item.topic}"? Its images and video are removed for good.`)) return;
    setDeleting(item.id);
    try {
      await api(`/api/projects/${item.id}`, { method: "DELETE" });
      setItems((list) => list?.filter((p) => p.id !== item.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="pt-4">
      <h1 className="mb-5 font-display text-3xl font-bold">Your Reels</h1>
      {error && <ErrorCard title="Could not load your Reels" message={error} onRetry={() => {
            setError(null);
            setReloadKey((k) => k + 1);
          }} />}
      {!items && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-36 rounded-2xl" />
          ))}
        </div>
      )}
      {items?.length === 0 && (
        <div className="rounded-2xl border border-line p-8 text-center text-muted">
          No Reels yet.{" "}
          <Link href="/" className="text-amber underline">
            Create your first one
          </Link>
          .
        </div>
      )}
      <ul className="space-y-3">
        {items?.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-2xl border border-line bg-panel/80 p-3">
            <Link href={`/project/${p.id}`} className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-xl bg-panel-2">
              {p.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusPill status={p.status} />
                <span className="text-xs text-muted">{p.duration}s</span>
              </div>
              <p className="mt-1 truncate font-semibold">{p.title ?? "Untitled"}</p>
              <p className="truncate text-sm text-muted">{p.topic}</p>
              <p className="text-xs text-faint">{new Date(p.createdAt).toLocaleString()}</p>
              {p.status === "completed" && !p.videoAvailable && <p className="mt-1 text-xs text-bad">Video expired or unavailable.</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/project/${p.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-panel-2 px-3 text-xs font-bold tracking-wider">
                  OPEN
                </Link>
                {p.videoAvailable && (
                  <a href={`/api/video/download/${p.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-amber/15 px-3 text-xs font-bold tracking-wider text-amber">
                    DOWNLOAD
                  </a>
                )}
                <button onClick={() => void remove(p)} disabled={deleting === p.id} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-xs font-bold tracking-wider text-muted">
                  {deleting === p.id && <Spinner className="h-3 w-3" />} DELETE
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
