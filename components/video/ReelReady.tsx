"use client";

import Link from "next/link";
import { useRef } from "react";
import { Spinner } from "@/components/ui/bits";
import type { ProjectView } from "@/types/api";

export function ReelReady({ view, onRebuild, rebuilding }: { view: ProjectView; onRebuild: () => void; rebuilding: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  if (!view.videoAvailable) {
    return (
      <section className="rounded-3xl border border-line bg-panel/80 p-5 text-center">
        <p className="font-semibold">Video expired or unavailable.</p>
        <p className="mt-1 text-sm text-muted">The scene images are still saved. You can build the Reel again.</p>
        <button onClick={onRebuild} disabled={rebuilding} className="btn-primary mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-sm font-bold tracking-widest">
          {rebuilding && <Spinner className="h-4 w-4" />} BUILD REEL AGAIN
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="gold-text text-center font-display text-3xl font-bold tracking-wide">YOUR REEL IS READY</h2>
      {view.videoProvider?.startsWith("shotstack:stage") && (
        <p className="text-center text-xs text-muted">Rendered with the Shotstack sandbox, which adds a watermark. Use a production key for clean videos.</p>
      )}
      <div className="mx-auto w-full max-w-[13.5rem] overflow-hidden rounded-3xl border border-line bg-black shadow-2xl shadow-amber/10">
        <video ref={video} src={view.videoUrl!} poster={view.thumbnailUrl ?? undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black" />
      </div>
      <div className="grid gap-3">
        <button onClick={() => void video.current?.play()} className="min-h-14 rounded-2xl border border-line bg-panel-2 text-base font-bold tracking-widest">
          PLAY
        </button>
        {/* The server redirects to a short-lived signed link that downloads the MP4 file. */}
        <a href={`/api/video/download/${view.id}`} className="btn-primary flex min-h-14 items-center justify-center rounded-2xl text-base font-bold tracking-widest">
          DOWNLOAD MP4
        </a>
        <Link href="/" className="flex min-h-14 items-center justify-center rounded-2xl border border-amber/50 text-base font-bold tracking-widest text-amber">
          CREATE ANOTHER
        </Link>
      </div>

      <div className="rounded-2xl border border-violet/30 bg-violet/10 p-4 text-sm leading-relaxed">
        <p className="font-semibold">Next step:</p>
        <p className="mt-1 text-text/90">Upload this Reel to Instagram or Facebook and add music from the platform&apos;s music library.</p>
        <p className="mt-2 text-muted">Music is added during publishing so you can use the music available to your account and region.</p>
      </div>
    </section>
  );
}
