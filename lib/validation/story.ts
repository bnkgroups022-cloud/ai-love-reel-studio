import { z } from "zod";
import { SCENE_COUNT } from "@/lib/options";
import { sanitizeText } from "./sanitize";

// Schema for the story engine's JSON. The same schema is sent to the model as
// the required output format and is used to validate whatever comes back.
// Rules JSON Schema can't express (exactly 8 scenes, adult ages) are checked in
// superRefine, so a bad response is rejected rather than trusted.

// Plain strings (no transforms) so the schema converts cleanly to JSON Schema.
// Lengths are generous here; sanitizeStory() applies the real limits afterwards.
const text = (max: number) => z.string().max(max * 4);

export const CharacterSchema = z.object({
  name: text(60).describe("Fictional first name"),
  age: z.number().describe("Age in years. Must be an adult between 21 and 45."),
  appearance: text(300).describe("Overall look; natural, not model-like"),
  skin_tone: text(120),
  face: text(300).describe("Face shape, eyes, nose, brows, natural imperfections"),
  hairstyle: text(200),
  facial_hair: text(160).describe("For the woman use 'none'"),
  body_type: text(160),
  clothing: text(300).describe("Exact outfit with colours and fabrics, worn in every scene"),
  accessories: text(200),
  personality: text(200),
});

export const CharacterBibleSchema = z.object({
  male: CharacterSchema,
  female: CharacterSchema,
});

export const SceneSchema = z.object({
  scene_number: z.number().int(),
  duration_seconds: z.number(),
  description: text(400).describe("One short sentence a viewer would understand"),
  action: text(300),
  emotion: text(160).describe("Facial expression and feeling"),
  location: text(200),
  time_of_day: text(80),
  lighting: text(200),
  camera: text(200).describe("Shot size, angle and composition"),
  lens: text(80).describe("e.g. 35mm, 50mm, 85mm"),
  characters_present: z.array(z.enum(["male", "female"])).describe("Who is visible in this shot"),
  image_prompt: text(900).describe("English visual prompt for this shot (scene content only)"),
  text_overlay: text(60).describe("Very short on-screen line in the requested language, or empty"),
  transition: z.enum(["crossfade"]),
});

export const StorySchema = z
  .object({
    title: text(80),
    hook: text(140),
    summary: text(600),
    characters: CharacterBibleSchema,
    scenes: z.array(SceneSchema),
  })
  .superRefine((story, ctx) => {
    if (story.scenes.length !== SCENE_COUNT) {
      ctx.addIssue({ code: "custom", path: ["scenes"], message: `Expected exactly ${SCENE_COUNT} scenes, got ${story.scenes.length}` });
    }
    story.scenes.forEach((scene, i) => {
      if (scene.scene_number !== i + 1) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "scene_number"], message: `Scene at position ${i + 1} is numbered ${scene.scene_number}` });
      }
      if (!scene.image_prompt || scene.image_prompt.length < 20) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "image_prompt"], message: "Image prompt is missing or too short" });
      }
      if (scene.characters_present.length === 0) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "characters_present"], message: "At least one character must be in every shot" });
      }
    });
    for (const role of ["male", "female"] as const) {
      const age = story.characters[role].age;
      if (!Number.isFinite(age) || age < 21 || age > 45) {
        ctx.addIssue({ code: "custom", path: ["characters", role, "age"], message: `Character age must be an adult between 21 and 45 (got ${age})` });
      }
    }
    if (!story.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Title is empty" });
  });

export type Character = z.infer<typeof CharacterSchema>;
export type CharacterBible = z.infer<typeof CharacterBibleSchema>;
export type StoryScene = z.infer<typeof SceneSchema>;
export type Story = z.infer<typeof StorySchema>;

/** Cleans every string in a validated story (control chars, markup, length). */
export function sanitizeStory(story: Story): Story {
  const clip = sanitizeText;
  const character = (c: Character): Character => ({
    ...c,
    name: clip(c.name, 60),
    appearance: clip(c.appearance, 300),
    skin_tone: clip(c.skin_tone, 120),
    face: clip(c.face, 300),
    hairstyle: clip(c.hairstyle, 200),
    facial_hair: clip(c.facial_hair, 160),
    body_type: clip(c.body_type, 160),
    clothing: clip(c.clothing, 300),
    accessories: clip(c.accessories, 200),
    personality: clip(c.personality, 200),
  });
  return {
    title: clip(story.title, 80),
    hook: clip(story.hook, 140),
    summary: clip(story.summary, 600),
    characters: { male: character(story.characters.male), female: character(story.characters.female) },
    scenes: story.scenes.map((sc) => ({
      ...sc,
      description: clip(sc.description, 400),
      action: clip(sc.action, 300),
      emotion: clip(sc.emotion, 160),
      location: clip(sc.location, 200),
      time_of_day: clip(sc.time_of_day, 80),
      lighting: clip(sc.lighting, 200),
      camera: clip(sc.camera, 200),
      lens: clip(sc.lens, 80),
      image_prompt: clip(sc.image_prompt, 900),
      text_overlay: clip(sc.text_overlay, 60),
    })),
  };
}

/** Turns Zod issues into one readable line, e.g. "scenes: Expected exactly 8 scenes". */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
    .join("; ");
}
