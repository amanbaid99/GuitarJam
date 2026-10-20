import "server-only"
import { z } from "zod"
import { AI_FAILURE_MESSAGE, chatJson, noDashes, type ChatJsonOptions } from "@/lib/ai/openrouter"
import {
  playable,
  songLanguage,
  songCountFor,
  templateSet,
  type SetProposal,
  type SetRequest,
  type SetSong,
} from "./template"

export type BuildResult = { proposal: SetProposal; source: "ai" | "template"; note?: string; model?: string }

const SYSTEM = `You build short live sets for one guitarist, Aman, who plays for friends.
He strums and sings; repertoire is Bollywood, old Hindi songs, classic rock, John Mayer, Coldplay.
Pick songs ONLY from the list given (use their exact ids). Every song listed is one he can play.
Rules:
- Aim for the target song count (about 4 minutes per song).
- Open with a well-known, easy song that suits the room.
- Group songs from the same chord family together so they flow as medleys.
- At most one hard song, as a showpiece near the end.
- End on a sing-along.
- Respect the language mix: "hindi" means mostly Hindi, "english" mostly English, "mixed" both.
- "name": a short, fun set name (max 6 words). "notes": 1 to 2 sentences on the flow.
- Never use em dashes or en dashes. Never quote lyrics.
Reply with JSON only: {"name","song_ids","notes"}.`

const SET_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    song_ids: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["name", "song_ids", "notes"],
  additionalProperties: false,
}

const aiSetSchema = z.object({
  name: z.string(),
  song_ids: z.array(z.string()).min(1).max(30),
  notes: z.string(),
})

export function buildSetMessage(songs: SetSong[], req: SetRequest): string {
  return JSON.stringify({
    room: req.room,
    language_mix: req.mix,
    minutes: req.minutes,
    target_song_count: songCountFor(req.minutes),
    songs: playable(songs).map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      family: s.family_name,
      vibe: s.family_vibe,
      language_guess: songLanguage(s),
      difficulty: s.difficulty,
      style: s.style,
    })),
  })
}

/**
 * Keeps only real, playable songs, once each, with at most one hard song,
 * and not wildly longer than asked. Returns null if too little is left.
 */
export function cleanSetProposal(
  raw: z.infer<typeof aiSetSchema>,
  songs: SetSong[],
  req: SetRequest,
): SetProposal | null {
  const byId = new Map(playable(songs).map((s) => [s.id, s]))
  const seen = new Set<string>()
  let hard = false
  const ids: string[] = []
  for (const id of raw.song_ids) {
    const s = byId.get(id)
    if (!s || seen.has(id)) continue
    if (s.difficulty === "hard") {
      if (hard) continue
      hard = true
    }
    seen.add(id)
    ids.push(id)
  }
  const max = songCountFor(req.minutes) + 2
  if (ids.length < Math.min(3, byId.size)) return null
  return {
    name: noDashes(raw.name).trim().slice(0, 60) || "New set",
    song_ids: ids.slice(0, max),
    notes: noDashes(raw.notes).trim().slice(0, 500),
  }
}

/** AI set when available, the built-in builder otherwise. Never throws. */
export async function buildSetProposal(
  songs: SetSong[],
  req: SetRequest,
  fetchImpl?: ChatJsonOptions<unknown>["fetchImpl"],
): Promise<BuildResult> {
  const result = await chatJson({
    system: SYSTEM,
    user: buildSetMessage(songs, req),
    schema: aiSetSchema,
    jsonSchema: { name: "song_set", schema: SET_JSON_SCHEMA },
    temperature: 0.7,
    fetchImpl,
  })
  if (result.ok) {
    const proposal = cleanSetProposal(result.data, songs, req)
    if (proposal) return { proposal, source: "ai", model: result.model }
  }
  return {
    proposal: templateSet(songs, req),
    source: "template",
    note: result.ok ? "The AI picked songs that are not in your library, so this uses the built-in builder." : AI_FAILURE_MESSAGE[result.reason],
  }
}
