"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { DIFFICULTIES, SONG_STATUSES, STYLES } from "@/lib/domain"
import { HINT_MAX } from "@/lib/songs"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { ok: false; error: string }

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

const songEditSchema = z.object({
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
