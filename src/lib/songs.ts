import type { Tables } from "@/lib/database.types"
import { chartView } from "@/lib/song-view"
import { keyName } from "@/lib/theory"
import type { Difficulty, SongStatus, Style } from "@/lib/domain"

export type Song = Tables<"songs">
export type Family = Tables<"families">

export const STATUS_LABEL: Record<SongStatus, string> = {
  want_to_learn: "Want to learn",
  learning: "Learning",
  can_play: "Can play",
  polished: "Polished",
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

export const STYLE_LABEL: Record<Style, string> = {
  strumming: "Strumming",
  fingerstyle: "Fingerstyle",
  riff_lead: "Riff / lead",
  mixed: "Mixed",
}

/** Max length of a first-line hint. A memory jog, never lyrics. Matches the DB check. */
export const HINT_MAX = 60

/** Whole days from `fromISO` to `toISO` (both YYYY-MM-DD). */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`)
  const to = Date.parse(`${toISO}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

/** "Today", "3 days ago", "2 weeks ago"... or "Not yet" when never practised. */
export function lastPractisedLabel(lastISO: string | null, todayISO: string): string {
  if (!lastISO) return "Not yet"
  const days = daysBetween(lastISO, todayISO)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export type SongFilters = {
  /** "known" = Can play or Polished. */
  status: SongStatus | "all" | "known"
  difficulty: Difficulty | "all"
  style: Style | "all"
  query: string
}

export const NO_FILTERS: SongFilters = { status: "all", difficulty: "all", style: "all", query: "" }

export function matchesFilters(song: Song, f: SongFilters): boolean {
  if (f.status === "known") {
    if (song.status !== "can_play" && song.status !== "polished") return false
  } else if (f.status !== "all" && song.status !== f.status) return false
  if (f.difficulty !== "all" && song.difficulty !== f.difficulty) return false
  if (f.style !== "all" && song.style !== f.style) return false
  const q = f.query.trim().toLowerCase()
  if (q) {
    const haystack = `${song.title} ${song.artist ?? ""}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export type FamilyGroup = {
  family: Family | null // null = Unassigned
  songs: Song[]
}

/**
 * Groups songs by group (families table) in the groups' order, then Other.
 * Songs inside a group are in your play order, then by title. Empty groups are kept so you can
 * still see every family while filtering.
 */
export function groupByFamily(families: Family[], songs: Song[]): FamilyGroup[] {
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title)
  const byOrder = (a: Song, b: Song) =>
    (a.group_position ?? Number.MAX_SAFE_INTEGER) - (b.group_position ?? Number.MAX_SAFE_INTEGER) || byTitle(a, b)
  const known = new Set(families.map((f) => f.id))
  const groups: FamilyGroup[] = families.map((family) => ({
    family,
    songs: songs.filter((s) => s.family_id === family.id).sort(byOrder),
  }))
  groups.push({
    family: null,
    songs: songs.filter((s) => !s.family_id || !known.has(s.family_id)).sort(byTitle),
  })
  return groups
}

export const SORT_MODES = ["family", "az", "key", "recent", "difficulty"] as const
export type SortMode = (typeof SORT_MODES)[number]

export const SORT_LABEL: Record<SortMode, string> = {
  family: "Group",
  az: "A to Z",
  key: "Key",
  recent: "Least played",
  difficulty: "Difficulty",
}

export type SongGroup = { label: string | null; songs: Song[] }

const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title)

/** The key you hear when you play it your way (saved transpose and capo applied). */
export function playingKey(song: Song, familyKey: string | null) {
  return chartView({
    chords: song.chords,
    lyrics: song.lyrics,
    keyCapo: song.key_capo,
    familyKey,
    transpose: song.my_transpose,
    capo: song.my_capo,
  }).soundingKey
}

/**
 * Groups for every sort except "family" (which uses groupByFamily):
 * - az: one list by title
 * - key: grouped by the key you play it in (C, C#, D ... then minors), so
 *   songs you can chain without moving the capo sit together
 * - recent: least recently played first; never played at the top
 * - difficulty: Easy, Medium, Hard, then not set
 */
export function sortSongs(songs: Song[], families: Family[], mode: Exclude<SortMode, "family">): SongGroup[] {
  if (mode === "az") return [{ label: null, songs: [...songs].sort(byTitle) }]

  if (mode === "recent") {
    const sorted = [...songs].sort((a, b) => {
      const ad = a.last_practised ?? ""
      const bd = b.last_practised ?? ""
      return ad === bd ? byTitle(a, b) : ad < bd ? -1 : 1
    })
    return [{ label: null, songs: sorted }]
  }

  if (mode === "difficulty") {
    const order = ["easy", "medium", "hard", null] as const
    return order
      .map((d) => ({
        label: d ? DIFFICULTY_LABEL[d] : "Not set",
        songs: songs.filter((s) => (s.difficulty ?? null) === d).sort(byTitle),
      }))
      .filter((g) => g.songs.length > 0)
  }

  // key
  const famKey = new Map(families.map((f) => [f.id, f.key]))
  const groups = new Map<string, { rank: number; songs: Song[] }>()
  for (const song of songs) {
    const key = playingKey(song, song.family_id ? (famKey.get(song.family_id) ?? null) : null)
    const label = key ? `Key of ${keyName(key)}` : "Key unknown"
    const rank = key ? key.tonic + (key.minor ? 12 : 0) : 99
    const g = groups.get(label) ?? { rank, songs: [] }
    g.songs.push(song)
    groups.set(label, g)
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([label, g]) => ({ label, songs: g.songs.sort(byTitle) }))
}
