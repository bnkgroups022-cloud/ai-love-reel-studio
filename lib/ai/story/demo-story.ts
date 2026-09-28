import type { Duration, Language, Mood, Style } from "@/lib/options";
import { SCENE_DURATIONS } from "@/lib/options";
import type { Story } from "@/lib/validation/story";

// DEMO / TEST DATA ONLY. Used when STORY_PROVIDER=demo and by automated tests.
// This is a fixed rain story (the spec's sample test), NOT AI-written. The title
// is prefixed with "[DEMO]" so it can never be mistaken for real AI output.

const SCENES: Array<Pick<Story["scenes"][number], "description" | "action" | "emotion" | "location" | "camera" | "lens" | "characters_present" | "image_prompt" | "text_overlay">> = [
  {
    description: "A woman waits alone under a bus stop shelter in heavy rain.",
    action: "Holding her dupatta close, watching the road",
    emotion: "Quiet, a little impatient",
    location: "Old city bus stop",
    camera: "Wide establishing shot, eye level",
    lens: "35mm",
    characters_present: ["female"],
    image_prompt: "The woman stands under a tin bus-stop shelter in heavy evening monsoon rain, water streaming off the roof edge, wet road reflecting orange street lights.",
    text_overlay: "Ek baarish wali shaam…",
  },
  {
    description: "A man runs in from the rain and takes shelter at the same stop.",
    action: "Shaking water from his hair, closed umbrella in hand",
    emotion: "Breathless, amused",
    location: "Same bus stop",
    camera: "Medium shot, slight low angle",
    lens: "50mm",
    characters_present: ["male", "female"],
    image_prompt: "The man steps under the shelter, shaking rain from his hair, while the woman glances at him from the other end of the bench.",
    text_overlay: "",
  },
  {
    description: "Their eyes meet for the first time.",
    action: "Both look up at the same moment",
    emotion: "Shy surprise",
    location: "Bus stop",
    camera: "Over-the-shoulder close-up",
    lens: "85mm",
    characters_present: ["male", "female"],
    image_prompt: "Over-the-shoulder close-up from behind the man towards the woman, their eyes meeting, rain drops blurred in the foreground.",
    text_overlay: "",
  },
  {
    description: "He opens his umbrella and offers it to her.",
    action: "Holding the umbrella out with a gentle smile",
    emotion: "Kind, hopeful",
    location: "Edge of the shelter",
    camera: "Medium two-shot",
    lens: "50mm",
    characters_present: ["male", "female"],
    image_prompt: "The man opens a black umbrella and holds it towards the woman at the edge of the shelter, rain falling behind them.",
    text_overlay: "Ek chhata, do dil",
  },
  {
    description: "They walk together under one umbrella.",
    action: "Walking side by side on a wet street",
    emotion: "Comfortable, smiling",
    location: "Rain-soaked street lined with shops",
    camera: "Wide tracking-style shot from behind",
    lens: "35mm",
    characters_present: ["male", "female"],
    image_prompt: "The man and the woman walk away from camera under one umbrella along a rain-soaked street with glowing shop lights and puddle reflections.",
    text_overlay: "",
  },
  {
    description: "A close, quiet moment under the umbrella.",
    action: "She laughs; he looks at her instead of the road",
    emotion: "Warm, tender",
    location: "Street corner",
    camera: "Close-up two-shot",
    lens: "85mm",
    characters_present: ["male", "female"],
    image_prompt: "Close-up of the woman laughing under the umbrella while the man looks at her softly, rain drops on the umbrella edge catching light.",
    text_overlay: "",
  },
  {
    description: "The rain becomes lighter.",
    action: "She holds out her palm to feel the drizzle",
    emotion: "Peaceful wonder",
    location: "Street near a chai stall",
    camera: "Medium shot, profile",
    lens: "50mm",
    characters_present: ["male", "female"],
    image_prompt: "The woman holds out her open palm to catch the light drizzle while the man lowers the umbrella beside her, a steaming chai stall in soft focus behind.",
    text_overlay: "",
  },
  {
    description: "They walk together into warm evening light.",
    action: "Walking hand in hand towards the glow",
    emotion: "Hopeful, in love",
    location: "Wet street opening to a sunset sky",
    camera: "Wide back shot, silhouettes",
    lens: "35mm",
    characters_present: ["male", "female"],
    image_prompt: "Wide shot from behind: the man and the woman walk hand in hand down a wet glistening street towards warm golden evening light breaking through clouds.",
    text_overlay: "Kuch kahaniyan baarish se shuru hoti hain",
  },
];

export function buildDemoStory(req: { topic: string; mood: Mood; style: Style; language: Language; duration: Duration }): Story {
  const durations = SCENE_DURATIONS[req.duration];
  return {
    title: "[DEMO] Baarish Mein Mulaqat",
    hook: "Demo story — not written by AI",
    summary: `Fixed demo story used for testing (your topic was: "${req.topic}"). Connect the story AI to get a real story.`,
    characters: {
      male: {
        name: "Arjun",
        age: 27,
        appearance: "Everyday Indian man, friendly and slightly shy",
        skin_tone: "medium wheatish",
        face: "oval face, dark brown eyes, thick brows, small scar on left eyebrow",
        hairstyle: "slightly curly short black hair",
        facial_hair: "short natural beard",
        body_type: "lean, average height",
        clothing: "charcoal linen shirt with sleeves rolled up, cream trousers",
        accessories: "black umbrella, simple steel wristwatch",
        personality: "gentle, thoughtful",
      },
      female: {
        name: "Meera",
        age: 25,
        appearance: "Natural Indian woman, expressive eyes",
        skin_tone: "warm light-brown",
        face: "soft round face, large dark eyes, small nose stud",
        hairstyle: "long black hair in a loose braid",
        facial_hair: "none",
        body_type: "slim, medium height",
        clothing: "mustard-golden cotton saree with a thin maroon border",
        accessories: "small white flower in hair, thin gold bangles",
        personality: "independent, playful",
      },
    },
    scenes: SCENES.map((s, i) => ({
      scene_number: i + 1,
      duration_seconds: durations[i],
      time_of_day: i === 7 ? "sunset" : "evening",
      lighting: i === 7 ? "warm golden backlight" : "overcast rain light with warm street lamps",
      transition: "crossfade" as const,
      ...s,
    })),
  };
}
