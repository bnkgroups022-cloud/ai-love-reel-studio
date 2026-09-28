"use client";

import { useEffect, useState } from "react";
import { api, Card, Chips, ErrorCard, Spinner } from "@/components/ui/bits";
import { DURATIONS, LANGUAGES, MOODS, STYLES } from "@/lib/options";
import { savePrefs, usePrefs, type Prefs } from "@/lib/prefs";
import type { ServiceStatus } from "@/types/api";

const STATE_STYLE: Record<ServiceStatus["state"], [string, string]> = {
  connected: ["Connected", "bg-ok"],
  not_connected: ["Not connected", "bg-faint"],
  error: ["Error", "bg-bad"],
  demo: ["Demo mode", "bg-amber"],
};

export default function SettingsPage() {
  const prefs = usePrefs();
  const [saved, setSaved] = useState(false);
  const [services, setServices] = useState<ServiceStatus[] | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  const [checkKey, setCheckKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api<{ services: ServiceStatus[] }>("/api/settings/status")
      .then(({ services }) => {
        if (!cancelled) setServices(services);
      })
      .catch((err: Error) => {
        if (!cancelled) setStatusError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [checkKey]);

  function recheck() {
    setServices(null);
    setStatusError(null);
    setCheckKey((k) => k + 1);
  }

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    savePrefs(next);
    setSaved(true);
  }

  async function clean() {
    setCleaning(true);
    setCleanResult(null);
    try {
      const r = await api<{ removedFiles: number; removedFolders: number }>("/api/settings/cleanup", { method: "POST" });
      setCleanResult(`Removed ${r.removedFiles} unused file(s) from storage and ${r.removedFolders} temporary render folder(s).`);
    } catch (err) {
      setCleanResult((err as Error).message);
    } finally {
      setCleaning(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign(new URL("/login", window.location.origin).href);
  }

  return (
    <main className="space-y-6 pt-4">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Default choices</h2>
          {saved && <span className="text-xs text-ok">Saved on this device</span>}
        </div>
        <Chips label="Default language" options={LANGUAGES} value={prefs.language} onChange={(v) => update("language", v)} />
        <Chips label="Default mood" options={MOODS} value={prefs.mood} onChange={(v) => update("mood", v)} />
        <Chips label="Default style" options={STYLES} value={prefs.style} onChange={(v) => update("style", v)} />
        <Chips label="Default duration" options={DURATIONS} value={prefs.duration} onChange={(v) => update("duration", v)} format={(d) => `${d} sec`} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI provider status</h2>
          <button onClick={recheck} className="text-sm text-amber">
            Check again
          </button>
        </div>
        {statusError && <ErrorCard message={statusError} />}
        {!services && !statusError && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Testing each connection…
          </p>
        )}
        {services?.map((s) => {
          const [label, dot] = STATE_STYLE[s.state];
          return (
            <div key={s.service} className="rounded-xl bg-panel-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{s.service}</p>
                <span className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  {label}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {s.provider} — {s.detail}
              </p>
            </div>
          );
        })}
        <p className="text-xs text-faint">API keys are stored only on the server and are never shown here.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Storage</h2>
        <p className="text-sm text-muted">Removes old replaced images, leftover text overlays and temporary render files. Your current scenes and finished Reels are kept.</p>
        <button onClick={() => void clean()} disabled={cleaning} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel-2 font-semibold">
          {cleaning && <Spinner className="h-4 w-4" />} Clear temporary files
        </button>
        {cleanResult && <p className="text-sm text-muted">{cleanResult}</p>}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Music</h2>
        <p className="text-sm text-muted">Reels are exported without music. Add music when you publish on Instagram or Facebook, using the library available to your account. (Royalty-free and your own audio can be added in a future version.)</p>
      </Card>

      <button onClick={() => void logout()} className="min-h-12 w-full rounded-xl border border-line text-sm font-semibold text-muted">
        Lock the app (log out)
      </button>
    </main>
  );
}
