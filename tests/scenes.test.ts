import { describe, expect, it } from "vitest";
import { buildDemoStory } from "@/lib/ai/story/demo-story";
import { buildImagePrompt, describeCharacter, NEGATIVE_PROMPT } from "@/lib/ai/image/prompt-builder";
import { SceneSchema, StorySchema } from "@/lib/validation/story";

const story = buildDemoStory({ topic: "t", mood: "Romantic", style: "Cinematic Realistic", language: "English", duration: 30 });

describe("scene validation", () => {
  it("accepts a well-formed scene", () => {
    expect(SceneSchema.safeParse(story.scenes[0]).success).toBe(true);
  });

  it("rejects an unknown transition", () => {
    expect(SceneSchema.safeParse({ ...story.scenes[0], transition: "spin" }).success).toBe(false);
  });

  it("rejects scenes numbered out of order", () => {
    const bad = { ...story, scenes: story.scenes.map((s, i) => ({ ...s, scene_number: i === 3 ? 9 : s.scene_number })) };
    const result = StorySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a scene with nobody in the frame or an empty image prompt", () => {
    const bad = { ...story, scenes: story.scenes.map((s, i) => (i === 2 ? { ...s, characters_present: [], image_prompt: "" } : s)) };
    const issues = JSON.stringify(StorySchema.safeParse(bad).error?.issues);
    expect(issues).toContain("At least one character");
    expect(issues).toContain("Image prompt is missing");
  });
});

describe("image prompt engine", () => {
  const male = describeCharacter("male", story.characters.male);
  const female = describeCharacter("female", story.characters.female);

  it("repeats the same character bible text in every scene prompt", () => {
    for (const scene of story.scenes) {
      const { prompt } = buildImagePrompt({ scene, bible: story.characters, style: "Cinematic Realistic", mood: "Romantic" });
      if (scene.characters_present.includes("male")) expect(prompt).toContain(male);
      if (scene.characters_present.includes("female")) expect(prompt).toContain(female);
    }
  });

  it("includes framing, lens, lighting, quality terms and 9:16", () => {
    const { prompt, negativePrompt } = buildImagePrompt({ scene: story.scenes[3], bible: story.characters, style: "Rainy Romance", mood: "Emotional" });
    expect(prompt).toContain("Vertical 9:16");
    expect(prompt).toContain("50mm lens");
    expect(prompt).toContain("shallow depth of field");
    expect(prompt).toContain("realistic hands");
    expect(prompt).toContain("natural skin texture");
    expect(prompt).toContain("monsoon");
    expect(prompt).toContain("fictional adults");
    expect(negativePrompt).toBe(NEGATIVE_PROMPT);
    expect(negativePrompt).toContain("celebrity");
    expect(negativePrompt).toContain("extra fingers");
  });

  it("only describes the woman in a solo shot of her", () => {
    const { prompt } = buildImagePrompt({ scene: story.scenes[0], bible: story.characters, style: "Cinematic Realistic", mood: "Romantic" });
    expect(prompt).toContain(female);
    expect(prompt).not.toContain(male);
    expect(prompt).toContain("Exactly one person");
  });
});
