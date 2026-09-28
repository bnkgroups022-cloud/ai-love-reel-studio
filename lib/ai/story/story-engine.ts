import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { env, ConfigError } from "@/lib/env";
import { log } from "@/lib/log";
import type { Duration, Language, Mood, Style } from "@/lib/options";
import { SCENE_DURATIONS } from "@/lib/options";
import { parseJsonLoose } from "@/lib/validation/json-repair";
import { StorySchema, describeIssues, sanitizeStory, type Story } from "@/lib/validation/story";
import { STORY_SYSTEM_PROMPT, buildStoryUserPrompt } from "./system-prompt";
import { buildDemoStory } from "./demo-story";

export interface StoryRequest {
  topic: string;
  mood: Mood;
  style: Style;
  language: Language;
  duration: Duration;
}

export interface StoryResult {
  story: Story;
  provider: string;
}

export class StoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryError";
  }
}

/**
 * Validates raw model text against the story schema, after a safe JSON repair.
 * Scene durations are always replaced with the app's fixed plan so timing never
 * depends on the model.
 */
export function validateStoryText(raw: string, duration: Duration): { ok: true; story: Story } | { ok: false; error: string } {
  const parsed = parseJsonLoose(raw);
  if (parsed === undefined) return { ok: false, error: "The AI response was not valid JSON." };
  const result = StorySchema.safeParse(parsed);
  if (!result.success) return { ok: false, error: describeIssues(result.error) };
  const durations = SCENE_DURATIONS[duration];
  const story = sanitizeStory(result.data);
  story.scenes = story.scenes.map((s, i) => ({ ...s, duration_seconds: durations[i], transition: "crossfade" }));
  return { ok: true, story };
}

export async function generateStory(req: StoryRequest): Promise<StoryResult> {
  const cfg = env();
  if (cfg.storyProvider === "demo") {
    log.info("story.demo", { topic: req.topic });
    return { story: buildDemoStory(req), provider: "demo" };
  }
  if (cfg.storyProvider !== "anthropic") {
    throw new ConfigError(`Unknown STORY_PROVIDER "${cfg.storyProvider}". Use "anthropic" (or "demo" for test data).`);
  }
  if (!cfg.anthropicApiKey) {
    throw new ConfigError("The story AI is not connected: ANTHROPIC_API_KEY is missing. Add it in your environment variables.");
  }

  const client = new Anthropic({ apiKey: cfg.anthropicApiKey, timeout: 150_000, maxRetries: 2 });
  const format = betaZodOutputFormat(StorySchema);
  const userPrompt = buildStoryUserPrompt(req);

  const call = async (messages: Anthropic.Beta.BetaMessageParam[]) => {
    const response = await client.beta.messages.create({
      model: cfg.storyModel,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format },
      system: STORY_SYSTEM_PROMPT,
      messages,
    });
    if (response.stop_reason === "refusal") {
      const why = response.stop_details?.explanation;
      throw new StoryError(`The story AI declined this idea${why ? `: ${why}` : ""}. Try rephrasing the topic.`);
    }
    if (response.stop_reason === "max_tokens") {
      throw new StoryError("The story AI's answer was cut off before it finished. Please try again.");
    }
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  };

  try {
    const started = Date.now();
    const first = await call([{ role: "user", content: userPrompt }]);
    let result = validateStoryText(first, req.duration);
    if (!result.ok) {
      // One repair round: show the model its own output and the exact problems.
      log.warn("story.invalid_first_attempt", { error: result.error });
      const repaired = await call([
        {
          role: "user",
          content: `${userPrompt}\n\nA previous attempt produced the JSON below, but it failed validation: ${result.error}\nReturn the complete corrected story.\n\n${first.slice(0, 30000)}`,
        },
      ]);
      result = validateStoryText(repaired, req.duration);
    }
    if (!result.ok) {
      throw new StoryError(`The story AI returned a story the app could not use (${result.error}). Please try again.`);
    }
    log.info("story.generated", { model: cfg.storyModel, ms: Date.now() - started, title: result.story.title });
    return { story: result.story, provider: `anthropic:${cfg.storyModel}` };
  } catch (err) {
    throw toStoryError(err);
  }
}

function toStoryError(err: unknown): Error {
  if (err instanceof StoryError || err instanceof ConfigError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new ConfigError("The story AI rejected the API key (ANTHROPIC_API_KEY). Check that it is correct and active.");
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new ConfigError("The story AI key does not have permission to use this model. Check your Anthropic account.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new StoryError("The story AI is busy (rate limit reached). Wait a minute and press TRY AGAIN.");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new StoryError("The story AI timed out. Press TRY AGAIN.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new StoryError("Could not reach the story AI (network problem). Press TRY AGAIN.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new StoryError(`The story AI rejected the request: ${err.message}`);
  }
  if (err instanceof Anthropic.APIError) {
    return new StoryError(`The story AI returned an error (${err.status ?? "unknown"}). Press TRY AGAIN.`);
  }
  return new StoryError(`Story generation failed: ${err instanceof Error ? err.message : String(err)}`);
}
