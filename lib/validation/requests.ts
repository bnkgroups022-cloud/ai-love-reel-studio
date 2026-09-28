import { z } from "zod";
import { DURATIONS, LANGUAGES, MOODS, STYLES } from "@/lib/options";
import { sanitizeText } from "./sanitize";

export const CreateProjectSchema = z.object({
  topic: z
    .string()
    .transform((s) => sanitizeText(s, 200))
    .pipe(z.string().min(3, "Please describe your story in at least 3 characters.").max(200)),
  mood: z.enum(MOODS),
  style: z.enum(STYLES),
  language: z.enum(LANGUAGES),
  duration: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<20>, z.ZodLiteral<30>, z.ZodLiteral<45>]),
  idempotencyKey: z.string().uuid("Invalid request id."),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UuidSchema = z.string().uuid();

export const RegenerateSceneSchema = z.object({
  sceneId: z.string().uuid(),
  imagePrompt: z
    .string()
    .transform((s) => sanitizeText(s, 900))
    .pipe(z.string().min(20, "The prompt is too short — describe the shot in a sentence or two."))
    .optional(),
});

export const ProjectIdSchema = z.object({ projectId: z.string().uuid() });
