"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { extractSongs, type ExtractResult } from "@/lib/import/extract"
import { groupFor, lastPositions } from "@/lib/groups-server"
import { songEditSchema } from "@/lib/song-schema"
import { createClient } from "@/lib/neon/server"

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_PIECES = 10

/** Read prepared JPEG slices directly and discard them after extraction. */
export async function importScreenshot(formData: FormData): Promise<ExtractResult> {
  await requireUser()
  const files = formData.getAll("screenshot")
  if (
    !files.length || files.length > MAX_PIECES ||
    !files.every((file): file is File => file instanceof File && file.type === "image/jpeg" && file.size > 0)
  ) return { ok: false, error: "Choose a screenshot to import." }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That screenshot is too large. Try a smaller image." }
  }

  const dataUrls = await Promise.all(files.map(async (file) =>
    `data:image/jpeg;base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
  ))
  const db = await createClient()
  const [families, songs] = await Promise.all([
    db.from("families").select("id, key"),
    db.from("songs").select("title"),
  ])
  if (families.error || songs.error) return { ok: false, error: "Could not load your songs and groups." }
  return extractSongs(dataUrls, families.data, songs.data.map((song) => song.title))
}

const addSchema = z
  .array(
    songEditSchema.extend({
      needs_verify: z.boolean().default(false),
      // Your own lyrics (typed or pasted), private to your account.
      lyrics: z
        .string()
        .max(20000, "Lyrics are too long")
        .transform((v) => (v.trim() === "" ? null : v))
        .nullable()
        .optional(),
    }),
  )
  .min(1)
  .max(40)
export type NewSong = z.input<typeof addSchema>[number]
export type AddResult = { ok: true; count: number; ids: string[] } | { ok: false; error: string }

/** Adds one or more songs. AI-read songs come in with needs_verify = true. */
export async function addSongs(input: NewSong[]): Promise<AddResult> {
  await requireUser()
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue ? `Song ${Number(issue.path[0]) + 1}: ${issue.message}` : "Check the songs." }
  }

  const supabase = await createClient()
  // Only songs with chords join a group.
  const rows = parsed.data.map((s) => ({ ...s, family_id: groupFor(s.family_id, s.chords) }))

  // RLS hides other people's groups, so every group id must be one of yours.
  const groupIds = [...new Set(rows.flatMap((s) => (s.family_id ? [s.family_id] : [])))]
  if (groupIds.length) {
    const { data } = await supabase.from("families").select("id").in("id", groupIds)
    if ((data ?? []).length !== groupIds.length) return { ok: false, error: "Unknown group." }
  }

  // New songs go to the end of their group.
  const last = await lastPositions(supabase, groupIds)
  const placed = rows.map((s) => {
    if (!s.family_id) return { ...s, group_position: null }
    const next = (last.get(s.family_id) ?? 0) + 1
    last.set(s.family_id, next)
    return { ...s, group_position: next }
  })

  const { data, error } = await supabase.from("songs").insert(placed).select("id")
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true, count: parsed.data.length, ids: (data ?? []).map((r) => r.id) }
}
