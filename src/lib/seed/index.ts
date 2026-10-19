import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, TablesInsert } from "@/lib/database.types"
import { SEED_REPERTOIRE, type SeedRepertoire } from "./repertoire"
import { SEED_SKILLS, type SeedSkill } from "./skills"

export type SeedResult = {
  families: number
  songs: number
  skills: number
}

const songKey = (title: string, artist: string | null) =>
  `${title.trim().toLowerCase()}|${(artist ?? "").trim().toLowerCase()}`

/**
 * Loads the starter families, songs and skills for one user.
 * Safe to run more than once: it only adds what is missing and never
 * overwrites anything already edited in the app.
 *
 * Works with either the user's own session client (RLS applies) or a
 * service role client (from scripts/seed.ts).
 */
export async function seedUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: SeedRepertoire = SEED_REPERTOIRE,
  skills: SeedSkill[] = SEED_SKILLS,
): Promise<SeedResult> {
  // 1. Families, then read them back to map names to ids.
  const { data: existingFamilies, error: famReadErr } = await supabase
    .from("families")
    .select("id, name")
    .eq("user_id", userId)
  if (famReadErr) throw famReadErr

  const knownFamilies = new Set(existingFamilies.map((f) => f.name))
  const newFamilies: TablesInsert<"families">[] = data.families
    .filter((f) => !knownFamilies.has(f.name))
    .map((f) => ({ user_id: userId, name: f.name, key: f.key, numbers: f.numbers, vibe: f.vibe }))

  let insertedFamilies: { id: string; name: string }[] = []
  if (newFamilies.length) {
    const { data: rows, error } = await supabase
      .from("families")
      .insert(newFamilies)
      .select("id, name")
    if (error) throw error
    insertedFamilies = rows
  }

  const familyIdByName = new Map(
    [...existingFamilies, ...insertedFamilies].map((f) => [f.name, f.id]),
  )

  // 2. Songs, skipping any title + artist already in the library.
  const { data: existingSongs, error: songReadErr } = await supabase
    .from("songs")
    .select("title, artist")
    .eq("user_id", userId)
  if (songReadErr) throw songReadErr

  const knownSongs = new Set(existingSongs.map((s) => songKey(s.title, s.artist)))
  const newSongs: TablesInsert<"songs">[] = data.songs
    .filter((s) => !knownSongs.has(songKey(s.title, s.artist)))
    .map((s) => ({
      user_id: userId,
      title: s.title,
      artist: s.artist,
      status: s.status,
      difficulty: s.difficulty,
      style: s.style,
      family_id: s.family ? (familyIdByName.get(s.family) ?? null) : null,
      key_capo: s.key_capo,
      chords: s.chords,
      notes: s.notes,
    }))

  if (newSongs.length) {
    const { error } = await supabase.from("songs").insert(newSongs)
    if (error) throw error
  }

  // 3. Skills. ignoreDuplicates keeps any level already changed in the app.
  const { data: skillRows, error: skillErr } = await supabase
    .from("skills")
    .upsert(
      skills.map((s) => ({
        user_id: userId,
        area: s.area,
        name: s.name,
        level: s.level,
        is_focus: s.is_focus ?? false,
      })),
      { onConflict: "user_id,area,name", ignoreDuplicates: true },
    )
    .select("id")
  if (skillErr) throw skillErr

  return {
    families: newFamilies.length,
    songs: newSongs.length,
    skills: skillRows?.length ?? 0,
  }
}
