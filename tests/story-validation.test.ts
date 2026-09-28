import { describe, expect, it } from "vitest";
import { buildDemoStory } from "@/lib/ai/story/demo-story";
import { validateStoryText } from "@/lib/ai/story/story-engine";
import { SCENE_DURATIONS } from "@/lib/options";
import { parseJsonLoose } from "@/lib/validation/json-repair";
import { StorySchema } from "@/lib/validation/story";

const demo = () => buildDemoStory({ topic: "Ek baarish wali romantic love story", mood: "Romantic", style: "Rainy Romance", language: "Hindi", duration: 30 });

describe("story JSON validation", () => {
  it("accepts a complete 8-scene story with a character bible", () => {
    const result = StorySchema.safeParse(demo());
    expect(result.success).toBe(true);
  });

  it("rejects a story that does not have exactly 8 scenes", () => {
    const story = demo();
    story.scenes = story.scenes.slice(0, 7);
    const result = StorySchema.safeParse(story);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("Expected exactly 8 scenes");
  });

  it("rejects characters who are not clearly adults", () => {
    const story = demo();
    story.characters.female.age = 17;
    const result = StorySchema.safeParse(story);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("adult");
  });

  it("repairs code fences and trailing commas, then validates", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify(demo(), null, 2).replace(/"transition": "crossfade"\n/g, '"transition": "crossfade",\n') + "\n```";
    const result = validateStoryText(raw, 30);
    expect(result.ok).toBe(true);
  });

  it("returns a clear error for text that is not JSON", () => {
    const result = validateStoryText("Sorry, I cannot help with that.", 30);
    expect(result).toEqual({ ok: false, error: "The AI response was not valid JSON." });
  });

  it("overrides scene durations with the app's plan so the Reel length is exact", () => {
    for (const duration of [20, 30, 45] as const) {
      const story = demo();
      story.scenes.forEach((s) => (s.duration_seconds = 99));
      const result = validateStoryText(JSON.stringify(story), duration);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.story.scenes.map((s) => s.duration_seconds)).toEqual(SCENE_DURATIONS[duration]);
        expect(result.story.scenes.reduce((a, s) => a + s.duration_seconds, 0)).toBe(duration);
      }
    }
  });

  it("sanitizes markup and control characters from generated text", () => {
    const story = demo();
    story.title = "<script>alert(1)</script>Baarish\u0007";
    const result = validateStoryText(JSON.stringify(story), 30);
    expect(result.ok && result.story.title).toBe("scriptalert(1)/scriptBaarish");
  });

  it("parseJsonLoose never invents content", () => {
    expect(parseJsonLoose("{not json at all")).toBeUndefined();
    expect(parseJsonLoose('{"a": 1,}')).toEqual({ a: 1 });
  });
});
