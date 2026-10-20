import { formatChord, parseChord, transposeChordObj } from "./chords"

/**
 * Lyrics with chords inline, ChordPro style: "[G]Look at the [D]stars".
 * - [Chord] before a word puts that chord above it.
 * - A line that is only a non-chord in brackets ("[Chorus]") or ends with ":" ("Verse 2:") is a heading.
 * - Anything else is plain text.
 */

export type LyricSegment = { chord: string | null; text: string }
export type LyricLine =
  | { kind: "heading"; text: string }
  | { kind: "blank" }
  | { kind: "line"; segments: LyricSegment[]; hasChords: boolean }

const BRACKET = /\[([^\]\n]{1,24})\]/g

export function parseLyricLine(raw: string): LyricLine {
  const line = raw.replace(/\s+$/, "")
  if (!line.trim()) return { kind: "blank" }

  const onlyBracket = /^\s*\[([^\]]+)\]\s*$/.exec(line)
  if (onlyBracket && !parseChord(onlyBracket[1])) return { kind: "heading", text: onlyBracket[1].trim() }
  if (!line.includes("[") && /^[A-Za-z0-9 ]{1,24}:$/.test(line.trim())) {
    return { kind: "heading", text: line.trim().replace(/:$/, "") }
  }

  const segments: LyricSegment[] = []
  let last = 0
  let pending: string | null = null
  for (const m of line.matchAll(BRACKET)) {
    const idx = m.index ?? 0
    const inner = m[1].trim()
    if (!parseChord(inner)) continue // not a chord: leave the text as typed
    const before = line.slice(last, idx)
    if (before || pending !== null) segments.push({ chord: pending, text: before })
    pending = inner
    last = idx + m[0].length
  }
  const rest = line.slice(last)
  if (rest || pending !== null) segments.push({ chord: pending, text: rest })
  return { kind: "line", segments, hasChords: segments.some((s) => s.chord) }
}

export function parseLyrics(text: string): LyricLine[] {
  return text.split(/\r?\n/).map(parseLyricLine)
}

/** Moves every [Chord] in the lyrics by `semitones`; words are untouched. */
export function transposeLyrics(text: string, semitones: number, preferFlats = false): string {
  if (((semitones % 12) + 12) % 12 === 0) return text
  return text.replace(BRACKET, (whole, inner: string) => {
    const chord = parseChord(inner.trim())
    return chord ? `[${formatChord(transposeChordObj(chord, semitones), preferFlats)}]` : whole
  })
}
