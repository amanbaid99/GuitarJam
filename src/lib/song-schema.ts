import { z } from "zod"
import { DIFFICULTIES, SONG_STATUSES, STYLES } from "@/lib/domain"
import { HINT_MAX } from "@/lib/songs"

// Form fields arrive as strings. Blank means "clear it".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()

/** One song as typed in a form. Used for editing and adding songs. */
export const songEditSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  artist: optionalText(200),
  status: z.enum(SONG_STATUSES),
  difficulty: optionalEnum(DIFFICULTIES),
  style: optionalEnum(STYLES),
  family_id: z
    .union([z.uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  key_capo: optionalText(100),
  chords: optionalText(4000),
  first_line_hint: optionalText(HINT_MAX),
  tab_link: optionalText(500).refine((v) => v === null || /^https?:\/\//i.test(v), {
    message: "Tab link must start with http:// or https://",
  }),
  notes: optionalText(2000),
})

