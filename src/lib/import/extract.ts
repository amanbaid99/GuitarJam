import "server-only"
import { z } from "zod"
import { AI_FAILURE_MESSAGE, VISION_MODEL, chatJson, type ChatJsonOptions } from "@/lib/ai/openrouter"
import { cleanImported, type ImportedSong } from "./clean"

const SYSTEM = `You read photos and screenshots of guitar chord charts for one guitarist.
The image may hold one song or many (often a table from a notes app: title, artist, chords).
For each song, return:
- "title": the song title
- "artist": the artist if shown, else null
- "chords": the chord progression only, keeping section labels (Intro:, Verse:, Chorus:),
  repeat marks like (x2), and short playing notes like "Barre F". Put each section on its own line.
- "key_capo": key or capo if shown (e.g. "Capo 3"), else null
NEVER copy lyrics, not even one line. If chords sit above lyric lines, write only the chords.
Do not invent songs or chords that are not in the image. If nothing is readable, return no songs.
Never use em dashes or en dashes.
Reply with JSON only: {"songs":[{"title","artist","chords","key_capo"}]}.`

const IMPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    songs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          artist: { type: ["string", "null"] },
          chords: { type: ["string", "null"] },
          key_capo: { type: ["string", "null"] },
        },
        required: ["title", "artist", "chords", "key_capo"],
        additionalProperties: false,
      },
    },
  },
  required: ["songs"],
  additionalProperties: false,
}

const importSchema = z.object({
  songs: z
    .array(
      z.object({
        title: z.string(),
        artist: z.string().nullable().optional().transform((v) => v ?? null),
        chords: z.string().nullable().optional().transform((v) => v ?? null),
        key_capo: z.string().nullable().optional().transform((v) => v ?? null),
      }),
    )
    .max(40),
})

export type ExtractResult = { ok: true; songs: ImportedSong[] } | { ok: false; error: string }

/** Reads songs from an image (data URL). Family and duplicates are worked out in code, not by the AI. */
export async function extractSongs(
  imageDataUrl: string,
  families: { id: string; name: string }[],
  existingTitles: string[],
  fetchImpl?: ChatJsonOptions<unknown>["fetchImpl"],
): Promise<ExtractResult> {
  const result = await chatJson({
    model: VISION_MODEL,
    system: SYSTEM,
    user: [
      { type: "text", text: "Read every song in this image." },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    schema: importSchema,
    jsonSchema: { name: "chord_chart_import", schema: IMPORT_JSON_SCHEMA },
    temperature: 0.1,
    maxTokens: 10000,
    timeoutMs: 100_000,
    fetchImpl,
  })

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "bad_reply" || result.reason === "empty"
          ? "Could not read that image. Try a clearer or closer crop, or type it in."
          : `${AI_FAILURE_MESSAGE[result.reason]} You can still type the song in.`,
    }
  }
  const songs = cleanImported(result.data.songs, families, existingTitles)
  if (songs.length === 0) {
    return { ok: false, error: "No songs found in that image. Try a clearer or closer crop." }
  }
  return { ok: true, songs }
}
