"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { buildSetProposal } from "@/lib/sets/builder"
import { loadSetSongs } from "@/lib/sets/load"
import { LANGUAGE_MIXES, SET_MINUTES, goToSet, type SetProposal } from "@/lib/sets/template"
import { createClient } from "@/lib/supabase/server"

export type BuildResult =
  | { ok: true; proposal: SetProposal; source: "ai" | "template"; note?: string }
  | { ok: false; error: string }

const buildSchema = z.object({
  room: z.string().trim().max(300),
  mix: z.enum(LANGUAGE_MIXES),
  minutes: z.union(SET_MINUTES.map((m) => z.literal(m))),
})

/** Proposes a set (not saved yet). AI first, built-in builder as fallback. */
export async function buildSet(input: z.input<typeof buildSchema>): Promise<BuildResult> {
  await requireUser()
  const parsed = buildSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the room, language and minutes." }
  try {
    const songs = await loadSetSongs()
    if (songs.filter((s) => s.status === "can_play" || s.status === "polished").length === 0) {
      return { ok: false, error: "Mark some songs as Can play first." }
    }
    const { proposal, source, note } = await buildSetProposal(songs, parsed.data)
    return { ok: true, proposal, source, note }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not build a set." }
  }
}

const saveSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the set a name").max(60),
  room: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  song_ids: z.array(z.uuid()).min(1, "Add at least one song").max(40),
})

export type SaveResult = { ok: true; id: string } | { ok: false; error: string }

export async function saveSet(input: z.input<typeof saveSchema>): Promise<SaveResult> {
  await requireUser()
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the set." }
  const d = parsed.data
  const songIds = [...new Set(d.song_ids)]

  const supabase = await createClient()
  // RLS only shows your songs, so this also proves every id is yours.
  const { count, error: countErr } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .in("id", songIds)
  if (countErr) return { ok: false, error: countErr.message }
  if (count !== songIds.length) return { ok: false, error: "Some songs no longer exist." }

  const row = { name: d.name, room: d.room || null, notes: d.notes || null, song_ids: songIds }
  const res = d.id
    ? await supabase.from("sets").update(row).eq("id", d.id).select("id").single()
    : await supabase.from("sets").insert(row).select("id").single()
  if (res.error) return { ok: false, error: res.error.message }

  refresh()
  return { ok: true, id: res.data.id }
}

export async function deleteSet(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown set." }
  const supabase = await createClient()
  const { error } = await supabase.from("sets").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** Creates the default "Go-to set" from your songs. */
export async function createGoToSet(): Promise<SaveResult> {
  await requireUser()
  const songs = await loadSetSongs()
  const proposal = goToSet(songs)
  if (proposal.song_ids.length === 0) return { ok: false, error: "None of the Go-to songs are marked Can play yet." }
  return saveSet({ name: proposal.name, room: "Anywhere, any crowd", notes: proposal.notes, song_ids: proposal.song_ids })
}
