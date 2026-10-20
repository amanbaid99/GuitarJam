import { noDashesPure } from "./text"
import { findChords, suggestFamily } from "@/lib/theory"

/** What the vision model returns for one song. */
export type RawImportedSong = {
  title: string
  artist: string | null
  chords: string | null
  key_capo: string | null
}

/** A song ready for the review screen. */
export type ImportedSong = {
  title: string
  artist: string | null
  chords: string | null
  key_capo: string | null
  /** Suggested by the theory engine from the chords, never by the AI. */
  family_id: string | null
  /** Already in your library (same title). */
  duplicate: boolean
  /** Lines were removed because they looked like lyrics. */
  lyricsRemoved: boolean
}

const MAX_WORDS_WITHOUT_CHORDS = 5

/**
 * Lyrics guard. Keeps a line if it has chords in it, or if it is short
 * (section labels like "Chorus:", notes like "Capo 3", "Barre F").
 * Drops longer lines with no chords at all: those are lyrics.
 * Within a line, long runs of plain words between chords are cut too.
 */
export function stripLyrics(text: string): { text: string; removed: boolean } {
  let removed = false
  const kept: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/).length
    const chordCount = findChords(trimmed).length
    if (chordCount === 0 && words > MAX_WORDS_WITHOUT_CHORDS) {
      removed = true
      continue
    }
    // Chord-over-lyric styles inline words between chords: keep chords and short labels.
    if (chordCount > 0 && words - chordCount > 8) {
      const chordsOnly = findChords(trimmed).map((f) => f.text)
      const label = /^([A-Za-z ]{1,20}:)/.exec(trimmed)?.[1]
      kept.push([label, chordsOnly.join(" ")].filter(Boolean).join(" "))
      removed = true
      continue
    }
    kept.push(trimmed)
  }
  return { text: kept.join("\n"), removed }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * Tidies what the model read: trims, removes dashes and lyrics, suggests a
 * family with the theory engine, and flags songs already in the library.
 */
export function cleanImported(
  raw: RawImportedSong[],
  families: { id: string; name: string }[],
  existingTitles: string[],
): ImportedSong[] {
  const existing = new Set(existingTitles.map(norm))
  const seen = new Set<string>()
  const out: ImportedSong[] = []
  for (const r of raw) {
    const title = noDashesPure(r.title).trim().slice(0, 200)
    if (!title || seen.has(norm(title))) continue
    seen.add(norm(title))

    const guarded = r.chords ? stripLyrics(noDashesPure(r.chords)) : { text: "", removed: false }
    const chords = guarded.text.slice(0, 4000) || null

    out.push({
      title,
      artist: r.artist ? noDashesPure(r.artist).trim().slice(0, 200) || null : null,
      chords,
      key_capo: r.key_capo ? noDashesPure(r.key_capo).trim().slice(0, 100) || null : null,
      family_id: chords ? (suggestFamily(chords, families)?.familyId ?? null) : null,
      duplicate: existing.has(norm(title)),
      lyricsRemoved: guarded.removed,
    })
  }
  return out
}
