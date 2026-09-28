"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULTS, DURATIONS, LANGUAGES, MOODS, STYLES, type Duration, type Language, type Mood, type Style } from "./options";

// Default Create-screen choices, remembered on this device only.
export interface Prefs {
  mood: Mood;
  style: Style;
  language: Language;
  duration: Duration;
}

const KEY = "alrs.prefs.v1";
const listeners = new Set<() => void>();

function parsePrefs(raw: string): Prefs {
  try {
    const p = JSON.parse(raw || "{}") as Partial<Prefs>;
    return {
      mood: MOODS.includes(p.mood as Mood) ? (p.mood as Mood) : DEFAULTS.mood,
      style: STYLES.includes(p.style as Style) ? (p.style as Style) : DEFAULTS.style,
      language: LANGUAGES.includes(p.language as Language) ? (p.language as Language) : DEFAULTS.language,
      duration: DURATIONS.includes(p.duration as Duration) ? (p.duration as Duration) : DEFAULTS.duration,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Saved defaults (server render and first paint use the built-in defaults). */
export function usePrefs(): Prefs {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return useMemo(() => parsePrefs(raw), [raw]);
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage may be unavailable (private mode); defaults still work.
  }
  listeners.forEach((l) => l());
}
