import "server-only"
import { z } from "zod"
import { AI_FAILURE_MESSAGE, VISION_MODELS, chatJson, type ChatJsonOptions } from "@/lib/ai/openrouter"
import { cleanImported, type ImportedSong } from "./clean"

const SYSTEM = `You transcribe guitar chord charts from photos and screenshots, for one guitarist.
You may get several images: they are consecutive slices of ONE long screenshot, top to bottom,
overlapping slightly. Read them as one page and do not repeat lines that appear in two slices.
The page may hold one song (like an Ultimate Guitar page) or many (a table in a notes app).

Accuracy is everything:
- Copy every chord EXACTLY as written (Bm7 stays Bm7, A7sus4 stays A7sus4). Never transpose,
  simplify, "correct" or guess chords. Never fill in a section you cannot read.
- If the text is too small or blurry to read with certainty, return {"songs": []}. An empty
  answer is far better than a plausible-looking wrong one.

For each song return:
- "title", "artist" (null if not shown)
- "chords": the chord progression only, in page order, with section labels on their own line
  ([Intro], Verse 1:, Chorus:...), repeat marks like x2, and short notes like "Barre F".
- "key_capo": key or capo if shown (e.g. "Capo 3" or "Key: Bm"), else null
- "chord_legend": the chord names shown in a chord-diagram box or list near the top (on Ultimate
  Guitar, the CHORDS section), exactly as written; [] if there is none.
NEVER copy lyrics, not even one line. Where chords sit above lyric lines, write only the chords.
Never use em dashes or en dashes.
Reply with JSON only: {"songs":[{"title","artist","chords","key_capo","chord_legend"}]}.`

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
          chord_legend: { type: "array", items: { type: "string" } },
        },
        required: ["title", "artist", "chords", "key_capo", "chord_legend"],
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
        chord_legend: z.array(z.string()).max(60).optional().transform((v) => v ?? []),
      }),
    )
    .max(40),
})

export type ExtractResult = { ok: true; songs: ImportedSong[] } | { ok: false; error: string }

/**
 * Reads songs from one image, or several slices of one long screenshot (data URLs,
 * top to bottom). Family, duplicates and the chord-box check are done in code, not by the AI.
 */
export async function extractSongs(
  images: string | string[],
  families: { id: string; name: string }[],
  existingTitles: string[],
  fetchImpl?: ChatJsonOptions<unknown>["fetchImpl"],
): Promise<ExtractResult> {
  const list = Array.isArray(images) ? images : [images]
  const intro =
    list.length > 1
      ? `Read every song in these ${list.length} images. They are slices of one long screenshot, top to bottom.`
      : "Read every song in this image."
  const result = await chatJson({
    models: VISION_MODELS,
    system: SYSTEM,
    user: [
      { type: "text", text: intro },
      ...list.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ],
    schema: importSchema,
    jsonSchema: { name: "chord_chart_import", schema: IMPORT_JSON_SCHEMA },
    temperature: 0,
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
