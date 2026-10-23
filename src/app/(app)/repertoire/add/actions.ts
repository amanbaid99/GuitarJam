"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { extractSongs, type ExtractResult } from "@/lib/import/extract"
import { groupFor, lastPositions } from "@/lib/groups-server"
import { songEditSchema } from "@/lib/song-schema"
import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const MAX_PIECES = 10

/**
 * Reads the screenshot you just uploaded to your private folder (a long page
 * arrives as several pieces, top to bottom), asks the vision model for the
 * songs in it, then deletes the pieces (they are not needed after reading).
 */
export async function importScreenshot(paths: string[]): Promise<ExtractResult> {
  const user = await requireUser()
  // Only your own folder: "<your user id>/<file>".
  const own = new RegExp(`^${user.id}/[\\w.-]{1,100}$`)
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PIECES || !paths.every((p) => own.test(p))) {
    return { ok: false, error: "That upload does not belong to you." }
  }

  const supabase = await createClient()
  try {
    const dataUrls: string[] = []
    for (const path of paths) {
      const { data: file, error } = await supabase.storage.from("screenshots").download(path)
      if (error || !file) return { ok: false, error: "Could not open the uploaded image. Try again." }
      if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "That image is too large." }
      const type = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
      dataUrls.push(`data:${type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`)
    }

    const [families, songs] = await Promise.all([
      supabase.from("families").select("id, key"),
      supabase.from("songs").select("title"),
    ])
    return await extractSongs(
      dataUrls,
      families.data ?? [],
      (songs.data ?? []).map((s) => s.title),
    )
  } finally {
    await supabase.storage.from("screenshots").remove(paths)
  }
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
