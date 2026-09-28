import type { Mood, Style } from "@/lib/options";
import type { Character, CharacterBible } from "@/lib/validation/story";

// Builds the final text sent to the image AI. The same character bible text is
// repeated in every scene prompt — that repetition is what keeps the couple
// looking the same across all 8 images.

export const QUALITY_TERMS = [
  "photorealistic",
  "cinematic photography",
  "natural skin texture with pores and small imperfections",
  "realistic hands with five fingers",
  "realistic body proportions",
  "realistic Indian environment",
  "natural lighting",
  "shallow depth of field",
  "professional movie cinematography",
  "cinematic color grading",
  "subtle film grain",
  "high detail",
].join(", ");

export const NEGATIVE_PROMPT = [
  "cartoon",
  "anime",
  "illustration",
  "3d render",
  "plastic skin",
  "airbrushed skin",
  "deformed face",
  "extra fingers",
  "missing fingers",
  "bad hands",
  "duplicate person",
  "extra limbs",
  "distorted body",
  "unnatural eyes",
  "text",
  "logo",
  "watermark",
  "celebrity",
  "famous person",
  "low resolution",
].join(", ");

export const STYLE_LOOKS: Record<Style, string> = {
  "Cinematic Realistic": "grounded realistic film still, natural colour palette, gentle contrast",
  "Bollywood Romance": "Hindi-film romance cinematography, warm rich colours, golden highlights, still realistic",
  "Soft Dreamy": "soft diffused light, gentle highlight bloom, warm pastel tones, light haze, still photorealistic",
  "Rainy Romance": "monsoon atmosphere, visible raindrops, wet reflective surfaces, cool blue-teal shadows with warm practical lights",
  "Vintage Romance": "1980s Indian film look, warm faded film stock, soft grain, period-appropriate details",
};

export const MOOD_TONES: Record<Mood, string> = {
  Romantic: "warm, tender atmosphere",
  Emotional: "heartfelt, intimate atmosphere",
  Sad: "melancholic, quiet atmosphere with muted colours",
  Cute: "light, playful, sweet atmosphere",
  Nostalgic: "wistful, memory-like atmosphere",
  Dramatic: "intense, high-contrast emotional atmosphere",
};

export function describeCharacter(role: "male" | "female", c: Character): string {
  const who = role === "male" ? "Indian man" : "Indian woman";
  const parts = [
    `${c.age}-year-old ${who}`,
    `${c.skin_tone} skin`,
    c.face,
    c.hairstyle,
    role === "male" && c.facial_hair && c.facial_hair.toLowerCase() !== "none" ? c.facial_hair : "",
    `${c.body_type} build`,
    `wearing ${c.clothing}`,
    c.accessories && c.accessories.toLowerCase() !== "none" ? c.accessories : "",
  ];
  return parts.filter(Boolean).join(", ");
}

export interface PromptScene {
  image_prompt: string;
  action: string;
  emotion: string;
  location: string;
  time_of_day: string;
  lighting: string;
  camera: string;
  lens: string;
  characters_present: string[];
}

export function buildImagePrompt(args: { scene: PromptScene; bible: CharacterBible; style: Style; mood: Mood }) {
  const { scene, bible, style, mood } = args;
  const present = scene.characters_present.filter((r): r is "male" | "female" => r === "male" || r === "female");
  const cast = present.length ? present : (["male", "female"] as const);
  const castLines = cast.map((role) => `THE ${role === "male" ? "MAN" : "WOMAN"}: ${describeCharacter(role, bible[role])}.`);
  const count = cast.length === 1 ? "Exactly one person in the frame." : "Exactly two people in the frame, the man and the woman.";

  const prompt = [
    "Vertical 9:16 photorealistic cinematic film still.",
    scene.image_prompt,
    `Action: ${scene.action}. Facial expression: ${scene.emotion}.`,
    `Location: ${scene.location}, ${scene.time_of_day}. Lighting: ${scene.lighting}.`,
    `Camera: ${scene.camera}, ${scene.lens} lens, shallow depth of field.`,
    `Characters (keep identical in every shot): ${castLines.join(" ")}`,
    count,
    `Look: ${STYLE_LOOKS[style]}; ${MOOD_TONES[mood]}.`,
    `${QUALITY_TERMS}.`,
    "Both people are fictional adults and do not resemble any real person or celebrity. Tasteful and fully clothed.",
  ].join("\n");

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
