"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ErrorCard, Spinner } from "@/components/ui/bits";
import { ScenePreview } from "@/components/scenes/ScenePreview";
import { ReelReady } from "@/components/video/ReelReady";
import { isActive } from "@/lib/progress";
import type { ProjectView } from "@/types/api";
import { ProgressView } from "./ProgressView";
import { StoryHeader } from "./StoryHeader";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ProjectScreen({ id }: { id: string }) {
  const [view, setView] = useState<ProjectView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyScene, setBusyScene] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const { project } = await api<{ project: ProjectView }>(`/api/projects/${id}`);
    loaded.current = true;
    if (mounted.current) setView(project);
    return project;
  }, [id]);

  // Drives the server pipeline: each call to /api/jobs/advance performs one
  // real step (story, one image, render start/check). Progress shown on screen
  // is read back from the database after every step.
  const drive = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      let v = await refresh();
      while (mounted.current && isActive(v.status)) {
        const r = await api<{ status: string; busy: boolean }>("/api/jobs/advance", { method: "POST", body: JSON.stringify({ projectId: id }) });
        v = await refresh();
        if (r.busy) await sleep(3000);
        else if (v.status === "rendering") await sleep(4000);
      }
    } catch (err) {
      if (mounted.current) {
        if (!loaded.current) setLoadError((err as Error).message);
        else setStepError((err as Error).message);
      }
    } finally {
      running.current = false;
    }
  }, [id, refresh]);

  useEffect(() => {
    mounted.current = true;
    void drive();
    return () => {
      mounted.current = false;
    };
  }, [drive]);

  async function action(name: string, url: string, body: unknown) {
    setBusyAction(name);
    setActionError(null);
    try {
      await api(url, { method: "POST", body: JSON.stringify(body) });
      setStepError(null);
      await drive();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function regenerateScene(sceneId: string, imagePrompt?: string) {
    setBusyScene(sceneId);
    setActionError(null);
    try {
      await api("/api/images/regenerate", { method: "POST", body: JSON.stringify({ sceneId, imagePrompt }) });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      await refresh().catch(() => undefined);
      setBusyScene(null);
    }
  }

  if (loadError) {
    return (
      <main className="space-y-4 pt-6">
        <ErrorCard
          title="Could not open this Reel"
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            void drive();
          }}
        />
        <Link href="/projects" className="block text-center text-muted underline">
          Back to projects
        </Link>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="flex min-h-[60dvh] items-center justify-center text-muted">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  const hasImages = view.scenes.some((s) => s.imageStatus === "done" || s.imageStatus === "failed");
  const showPreview = view.status === "scenes_ready" || (view.status === "failed" && hasImages) || view.status === "completed";

  return (
    <main className="space-y-6 pt-2">
      <StoryHeader view={view} />

      {stepError && <ErrorCard
          title="Lost contact with the server"
          message={stepError}
          onRetry={() => {
            setStepError(null);
            void drive();
          }}
        />}
      {actionError && <ErrorCard message={actionError} />}

      {view.status === "failed" && (
        <ErrorCard
          title="This step did not work"
          message={view.errorMessage ?? "The last step failed."}
          busy={busyAction === "retry"}
          onRetry={() => void action("retry", `/api/projects/${id}/retry`, {})}
        />
      )}

      {view.status === "completed" && <ReelReady view={view} onRebuild={() => void action("build", "/api/video/build", { projectId: id })} rebuilding={busyAction === "build"} />}

      {(isActive(view.status) || (view.status === "failed" && !hasImages)) && <ProgressView view={view} />}

      {showPreview && (
        <ScenePreview
          view={view}
          busyScene={busyScene}
          busyAction={busyAction}
          locked={!!busyScene || !!busyAction}
          onRegenerate={regenerateScene}
          onRegenerateAll={() => void action("regenerate-all", "/api/images/regenerate-all", { projectId: id })}
          onBuild={() => void action("build", "/api/video/build", { projectId: id })}
          collapsed={view.status === "completed"}
        />
      )}
    </main>
  );
}
