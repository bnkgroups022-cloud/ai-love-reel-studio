// Options shown on the Create screen. Shared by browser and server code.

export const MOODS = ["Romantic", "Emotional", "Sad", "Cute", "Nostalgic", "Dramatic"] as const;
export const STYLES = [
  "Cinematic Realistic",
  "Bollywood Romance",
  "Soft Dreamy",
  "Rainy Romance",
  "Vintage Romance",
] as const;
export const LANGUAGES = ["Hindi", "English", "Hinglish"] as const;
export const DURATIONS = [20, 30, 45] as const;

export type Mood = (typeof MOODS)[number];
export type Style = (typeof STYLES)[number];
export type Language = (typeof LANGUAGES)[number];
export type Duration = (typeof DURATIONS)[number];

export const DEFAULTS = {
  mood: "Romantic" as Mood,
  style: "Cinematic Realistic" as Style,
  language: "Hindi" as Language,
  duration: 30 as Duration,
};

export const SCENE_COUNT = 8;

/** Per-scene durations (seconds). Each list sums exactly to its Reel length. */
export const SCENE_DURATIONS: Record<Duration, number[]> = {
  20: [2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3],
  30: [3, 4, 3, 4, 4, 4, 4, 4],
  45: [5, 6, 5, 6, 6, 6, 5, 6],
};

export const TEST_TOPIC = "Ek baarish wali romantic love story";
