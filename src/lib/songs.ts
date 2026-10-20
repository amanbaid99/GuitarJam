import type { Tables } from "@/lib/database.types"
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
  status: SongStatus | "all"
  difficulty: Difficulty | "all"
  style: Style | "all"
  query: string
}

export const NO_FILTERS: SongFilters = { status: "all", difficulty: "all", style: "all", query: "" }

export function matchesFilters(song: Song, f: SongFilters): boolean {
  if (f.status !== "all" && song.status !== f.status) return false
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
 * Groups songs by family in the families' order, then an Unassigned group.
 * Songs inside a group are sorted by title. Empty groups are kept so you can
 * still see every family while filtering.
 */
export function groupByFamily(families: Family[], songs: Song[]): FamilyGroup[] {
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title)
  const known = new Set(families.map((f) => f.id))
  const groups: FamilyGroup[] = families.map((family) => ({
    family,
    songs: songs.filter((s) => s.family_id === family.id).sort(byTitle),
  }))
  groups.push({
    family: null,
    songs: songs.filter((s) => !s.family_id || !known.has(s.family_id)).sort(byTitle),
  })
  return groups
}
