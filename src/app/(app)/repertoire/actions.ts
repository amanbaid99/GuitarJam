"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { SONG_STATUSES } from "@/lib/domain"
import { songEditSchema } from "@/lib/song-schema"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { ok: false; error: string }

export type SongEdit = z.input<typeof songEditSchema>

export async function updateSong(id: string, input: SongEdit): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown song." }

  const parsed = songEditSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." }
  }

  const supabase = await createClient()

  // RLS hides other people's families, so this also proves the family is yours.
  if (parsed.data.family_id) {
    const { data: fam } = await supabase
      .from("families")
      .select("id")
      .eq("id", parsed.data.family_id)
      .maybeSingle()
    if (!fam) return { ok: false, error: "That family does not exist." }
  }

  const { error, count } = await supabase
    .from("songs")
    .update(parsed.data, { count: "exact" })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: "Song not found." }

  refresh()
  return { ok: true }
}

export async function setSongStatus(id: string, status: string): Promise<ActionResult> {
  await requireUser()
  const parsed = z.object({ id: z.uuid(), status: z.enum(SONG_STATUSES) }).safeParse({ id, status })
  if (!parsed.success) return { ok: false, error: "Unknown song or status." }

  const supabase = await createClient()
  const { error } = await supabase.from("songs").update({ status: parsed.data.status }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

/** Clears the "check chords" badge once you have confirmed AI-filled chords. */
export async function markVerified(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown song." }

  const supabase = await createClient()
  const { error } = await supabase.from("songs").update({ needs_verify: false }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}

/** Saves how you play it: transpose (semitones) and capo (null = the written capo). */
export async function saveMyVersion(id: string, transpose: number, capo: number | null): Promise<ActionResult> {
  await requireUser()
  const parsed = z
    .object({
      id: z.uuid(),
      transpose: z.number().int().min(-11).max(11),
      capo: z.number().int().min(0).max(12).nullable(),
    })
    .safeParse({ id, transpose, capo })
  if (!parsed.success) return { ok: false, error: "That transpose or capo is out of range." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("songs")
    .update({ my_transpose: parsed.data.transpose, my_capo: parsed.data.capo })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** Your own lyrics, typed by you. Private; never sent to the AI. */
export async function saveLyrics(id: string, lyrics: string): Promise<ActionResult> {
  await requireUser()
  const parsed = z
    .object({ id: z.uuid(), lyrics: z.string().max(20000, "Lyrics are too long (20,000 characters max).") })
    .safeParse({ id, lyrics })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the lyrics." }

  const supabase = await createClient()
  const text = parsed.data.lyrics.replace(/\r\n/g, "\n").trim()
  const { error } = await supabase
    .from("songs")
    .update({ lyrics: text || null })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** Deletes a song for good and takes it out of any set it was in. */
export async function deleteSong(id: string): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown song." }

  const supabase = await createClient()
  const { error, count } = await supabase.from("songs").delete({ count: "exact" }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: "Song not found." }

  // Sets keep an ordered list of song ids; drop this one from each.
  const { data: sets } = await supabase.from("sets").select("id, song_ids").contains("song_ids", [id])
  for (const set of sets ?? []) {
    await supabase
      .from("sets")
      .update({ song_ids: set.song_ids.filter((s) => s !== id) })
      .eq("id", set.id)
  }

  refresh()
  return { ok: true }
}
