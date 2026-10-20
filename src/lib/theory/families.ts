import { findChords, parseChord, triadKey } from "./chords"

export type FamilyLike = { id: string; name: string }

export type FamilySuggestion = {
  familyId: string
  /** Share of the family's chords that appear in the song, 0..1. */
  coverage: number
  /** Song chords that are not in the family. */
  extras: number
}

/** "Em-D-C" -> triad keys of Em, D, C. Names that do not parse are skipped. */
export function familyTriads(name: string): Set<string> {
  const out = new Set<string>()
  for (const part of name.split("-")) {
    const chord = parseChord(part)
    if (chord) out.add(triadKey(chord))
  }
  return out
}

/**
 * Suggests the family whose chords best cover the song's chords.
 * Needs at least two matching chords and two thirds of the family present.
 * Ties go to the family with fewer chords left over in the song.
 */
export function suggestFamily(
  chart: string,
  families: FamilyLike[],
  minCoverage = 0.66,
): FamilySuggestion | null {
  const songTriads = new Set(findChords(chart).map((f) => triadKey(f.chord)))
  if (songTriads.size === 0) return null

  let best: FamilySuggestion | null = null
  for (const family of families) {
    const triads = familyTriads(family.name)
    if (triads.size === 0) continue
    const matched = [...triads].filter((t) => songTriads.has(t)).length
    const coverage = matched / triads.size
    const extras = [...songTriads].filter((t) => !triads.has(t)).length
    if (matched < 2 || coverage < minCoverage) continue
    if (!best || coverage > best.coverage || (coverage === best.coverage && extras < best.extras)) {
      best = { familyId: family.id, coverage, extras }
    }
  }
  return best
}
