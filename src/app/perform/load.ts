import "server-only"
import { requireUser } from "@/lib/auth"
import { chartView, playLabel } from "@/lib/song-view"
import { createClient } from "@/lib/supabase/server"
import type { DeckSong } from "./deck"

/** Songs that make sense on stage: everything except "want to learn". */
const PLAYABLE = ["learning", "can_play", "polished"]

type Deck = { title: string; songs: DeckSong[] } | null

const SONG_COLUMNS = "id, title, chords, lyrics, key_capo, my_transpose, my_capo, first_line_hint, family_id"

type Row = {
  id: string
  title: string
  chords: string | null
  lyrics: string | null
  key_capo: string | null
  my_transpose: number
  my_capo: number | null
  first_line_hint: string | null
  family_id: string | null
}
type FamilyRow = { id: string; name: string; key: string }

/** A song as it should be played: your saved key and capo applied to chords and lyrics. */
function toDeckSong(s: Row, family: FamilyRow | null): DeckSong {
  const view = chartView({
    chords: s.chords,
    lyrics: s.lyrics,
    keyCapo: s.key_capo,
    familyKey: family?.key ?? null,
    transpose: s.my_transpose,
    capo: s.my_capo,
  })
  return {
    id: s.id,
    title: s.title,
    family: family?.name ?? null,
    play: view.shapesKey ? playLabel(view) : s.key_capo,
    chords: view.chords,
    lyrics: view.lyrics,
    hint: s.first_line_hint,
  }
}

async function familyMap() {
  const supabase = await createClient()
  const { data } = await supabase.from("families").select("id, name, key")
  return new Map((data ?? []).map((f) => [f.id, f]))
}

export async function loadFamilyDeck(familyId: string): Promise<Deck> {
  await requireUser()
  const supabase = await createClient()
  const families = await familyMap()
  const family = families.get(familyId)
  if (!family) return null

  const { data: songs } = await supabase
    .from("songs")
    .select(SONG_COLUMNS)
    .eq("family_id", familyId)
    .in("status", PLAYABLE)
    .order("title")

  return { title: `${family.name} medley`, songs: (songs ?? []).map((s) => toDeckSong(s, family)) }
}

export async function loadSetDeck(setId: string): Promise<Deck> {
  await requireUser()
  const supabase = await createClient()
  const { data: set } = await supabase.from("sets").select("id, name, song_ids").eq("id", setId).maybeSingle()
  if (!set) return null

  const [{ data: songs }, families] = await Promise.all([
    supabase.from("songs").select(SONG_COLUMNS).in("id", set.song_ids),
    familyMap(),
  ])
  const byId = new Map((songs ?? []).map((s) => [s.id, s]))

  // Keep the set's order; skip songs deleted since.
  const ordered = set.song_ids.flatMap((id) => {
    const s = byId.get(id)
    return s ? [toDeckSong(s, s.family_id ? (families.get(s.family_id) ?? null) : null)] : []
  })
  return { title: set.name ?? "Set", songs: ordered }
}

/** One song, any status (opened from its own page). */
export async function loadSongDeck(songId: string): Promise<Deck> {
  await requireUser()
  const supabase = await createClient()
  const [{ data: song }, families] = await Promise.all([
    supabase.from("songs").select(SONG_COLUMNS).eq("id", songId).maybeSingle(),
    familyMap(),
  ])
  if (!song) return null
  return {
    title: song.title,
    songs: [toDeckSong(song, song.family_id ? (families.get(song.family_id) ?? null) : null)],
  }
}
