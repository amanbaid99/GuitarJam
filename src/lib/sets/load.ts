import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { SetSong } from "./template"

/** Your songs with their family name and vibe, as the set builders need them. */
export async function loadSetSongs(): Promise<SetSong[]> {
  const supabase = await createClient()
  const [songs, families] = await Promise.all([
    supabase.from("songs").select("id, title, artist, status, difficulty, style, family_id").order("title"),
    supabase.from("families").select("id, name, vibe"),
  ])
  const error = songs.error ?? families.error
  if (error) throw new Error(error.message)
  const fam = new Map((families.data ?? []).map((f) => [f.id, f]))
  return (songs.data ?? []).map((s) => ({
    ...s,
    family_name: s.family_id ? (fam.get(s.family_id)?.name ?? null) : null,
    family_vibe: s.family_id ? (fam.get(s.family_id)?.vibe ?? null) : null,
  }))
}
