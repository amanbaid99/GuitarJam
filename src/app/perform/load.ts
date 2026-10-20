import "server-only"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { DeckSong } from "./deck"

/** Songs that make sense on stage: everything except "want to learn". */
const PLAYABLE = ["learning", "can_play", "polished"]

type Deck = { title: string; songs: DeckSong[] } | null

export async function loadFamilyDeck(familyId: string): Promise<Deck> {
  await requireUser()
  const supabase = await createClient()

  const { data: family } = await supabase.from("families").select("id, name").eq("id", familyId).maybeSingle()
  if (!family) return null

  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, chords, key_capo, first_line_hint")
    .eq("family_id", familyId)
    .in("status", PLAYABLE)
    .order("title")

  return {
    title: `${family.name} medley`,
    songs: (songs ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      family: family.name,
      chords: s.chords,
      keyCapo: s.key_capo,
      hint: s.first_line_hint,
    })),
  }
}

export async function loadSetDeck(setId: string): Promise<Deck> {
  await requireUser()
  const supabase = await createClient()

  const { data: set } = await supabase.from("sets").select("id, name, song_ids").eq("id", setId).maybeSingle()
  if (!set) return null

  const [{ data: songs }, { data: families }] = await Promise.all([
    supabase
      .from("songs")
      .select("id, title, chords, key_capo, first_line_hint, family_id")
      .in("id", set.song_ids),
    supabase.from("families").select("id, name"),
  ])

  const familyName = new Map((families ?? []).map((f) => [f.id, f.name]))
  const byId = new Map((songs ?? []).map((s) => [s.id, s]))

  // Keep the set's order; skip songs that were deleted since.
  const ordered = set.song_ids.flatMap((id) => {
    const s = byId.get(id)
    return s
      ? [
          {
            id: s.id,
            title: s.title,
            family: s.family_id ? (familyName.get(s.family_id) ?? null) : null,
            chords: s.chords,
            keyCapo: s.key_capo,
            hint: s.first_line_hint,
          },
        ]
      : []
  })

  return { title: set.name ?? "Set", songs: ordered }
}
