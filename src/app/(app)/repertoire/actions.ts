"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { SONG_STATUSES } from "@/lib/domain"
import { groupFor, lastPositions } from "@/lib/groups-server"
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

  // RLS hides other people's groups, so this also proves the group is yours.
  const familyId = groupFor(parsed.data.family_id, parsed.data.chords)
  if (familyId) {
    const { data: fam } = await supabase.from("families").select("id").eq("id", familyId).maybeSingle()
    if (!fam) return { ok: false, error: "That group does not exist." }
  }

  // Joining a new group puts the song at the end of it; staying keeps its place.
  const { data: before } = await supabase.from("songs").select("family_id, group_position").eq("id", id).maybeSingle()
  let groupPosition: number | null = null
  if (familyId && before?.family_id === familyId) groupPosition = before.group_position
  else if (familyId) groupPosition = ((await lastPositions(supabase, [familyId])).get(familyId) ?? 0) + 1

  const { error, count } = await supabase
    .from("songs")
    .update({ ...parsed.data, family_id: familyId, group_position: groupPosition }, { count: "exact" })
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

/**
 * Moves a song into a group (at the end) or to Other (groupId null).
 * Songs without chords cannot join a group.
 */
export async function moveToGroup(songId: string, groupId: string | null): Promise<ActionResult> {
  await requireUser()
  const ok = z.object({ songId: z.uuid(), groupId: z.uuid().nullable() }).safeParse({ songId, groupId })
  if (!ok.success) return { ok: false, error: "Unknown song or group." }

  const supabase = await createClient()
  const { data: song } = await supabase.from("songs").select("chords, family_id").eq("id", songId).maybeSingle()
  if (!song) return { ok: false, error: "Song not found." }
  if (groupId && !song.chords?.trim()) return { ok: false, error: "Add the chords first, then pick a group." }
  if (song.family_id === groupId) return { ok: true }
  if (groupId) {
    const { data: fam } = await supabase.from("families").select("id").eq("id", groupId).maybeSingle()
    if (!fam) return { ok: false, error: "That group does not exist." }
  }

  const position = groupId ? ((await lastPositions(supabase, [groupId])).get(groupId) ?? 0) + 1 : null
  const { error } = await supabase
    .from("songs")
    .update({ family_id: groupId, group_position: position })
    .eq("id", songId)
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
