import "server-only";

// All secrets are read here, on the server only. Nothing in this file is ever
// sent to the browser. Values are read on every call so tests can change them.

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function env() {
  return {
    appUrl: read("NEXT_PUBLIC_APP_URL"),
    supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceKey: read("SUPABASE_SERVICE_ROLE_KEY"),
    storageBucket: read("SUPABASE_STORAGE_BUCKET") || "reel-assets",

    storyProvider: (read("STORY_PROVIDER") || "anthropic").toLowerCase(),
    anthropicApiKey: read("ANTHROPIC_API_KEY"),
    storyModel: read("STORY_MODEL") || "claude-opus-5-5",

    imageProvider: read("IMAGE_PROVIDER").toLowerCase(),
    imageApiKey: read("IMAGE_API_KEY"),
    imageModel: read("IMAGE_MODEL"),

    videoProvider: read("VIDEO_PROVIDER").toLowerCase(),
    videoApiKey: read("VIDEO_API_KEY"),
    shotstackEnv: read("SHOTSTACK_ENV") || "stage",
    ffmpegPath: read("FFMPEG_PATH"),

    encryptionKey: read("ENCRYPTION_KEY"),
    accessPassword: read("APP_ACCESS_PASSWORD"),
    ownerEmail: read("OWNER_EMAIL") || "owner@ai-love-reel-studio.local",
    maxProjectsPerHour: Number(read("MAX_PROJECTS_PER_HOUR") || 10),
  };
}

export function isDemoStory() {
  return env().storyProvider === "demo";
}

export function isDemoImages() {
  return env().imageProvider === "demo";
}

/** A config problem the user must fix. The message is shown to the user as-is. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
