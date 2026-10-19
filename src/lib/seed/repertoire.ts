import { z } from "zod"
import raw from "@/data/repertoire_seed.json"
import { DIFFICULTIES, SONG_STATUSES, STYLES } from "@/lib/domain"

const familySchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  numbers: z.string().min(1),
  vibe: z.string().nullable(),
})

const songSchema = z.object({
  title: z.string().min(1),
  artist: z.string().nullable(),
  status: z.enum(SONG_STATUSES),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  style: z.enum(STYLES).nullable(),
  family: z.string().nullable(),
  key_capo: z.string().nullable(),
  chords: z.string().nullable(),
  notes: z.string().nullable(),
})

export const repertoireSchema = z
  .object({
    families: z.array(familySchema),
    songs: z.array(songSchema),
  })
  .superRefine((data, ctx) => {
    const names = new Set(data.families.map((f) => f.name))
    data.songs.forEach((song, i) => {
      if (song.family && !names.has(song.family)) {
        ctx.addIssue({
          code: "custom",
          path: ["songs", i, "family"],
          message: `Unknown family "${song.family}" on "${song.title}"`,
        })
      }
    })
  })

export type SeedRepertoire = z.infer<typeof repertoireSchema>

/** The repertoire exported from Notion, validated. Throws if the file is malformed. */
export const SEED_REPERTOIRE: SeedRepertoire = repertoireSchema.parse(raw)
