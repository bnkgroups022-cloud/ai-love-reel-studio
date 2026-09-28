"use client";

import { useState } from "react";
import { ErrorCard, Spinner } from "@/components/ui/bits";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not unlock.");
      window.location.assign(new URL("/", window.location.origin).href);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[80dvh] flex-col justify-center">
      <h1 className="gold-text text-center font-display text-4xl font-bold">AI LOVE REEL STUDIO</h1>
      <p className="mt-3 text-center text-muted">This studio is private. Enter your access password.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Access password"
          className="min-h-14 w-full rounded-2xl border border-line bg-panel-2 px-4 text-lg focus:border-amber focus:outline-none"
        />
        {error && <ErrorCard title="Not unlocked" message={error} />}
        <button disabled={busy || !password} className="btn-primary flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold tracking-widest">
          {busy && <Spinner />} UNLOCK
        </button>
      </form>
    </main>
  );
}
