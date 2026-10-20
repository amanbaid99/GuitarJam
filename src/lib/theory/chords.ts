import { mod12, noteToPc, pcToNote } from "./notes"

export type Quality = "major" | "minor" | "dim" | "aug" | "sus"

export type Chord = {
  root: number // pitch class
  /** Everything after the root, as written: "m7", "add9", "sus4", "maj7". */
  suffix: string
  quality: Quality
  /** Slash bass pitch class, e.g. D/F# -> 6. */
  bass: number | null
}

// Root, then a suffix built only from chord vocabulary, then an optional slash bass.
// Kept strict so words like "Easy", "Barre" or "Chorus" are never read as chords.
const ROOT = "([A-G])([#b♯♭]?)"
const SUFFIX = "((?:maj|min|dim|aug|sus|add|m|M|°|ø|\\+|[b#♭♯](?=\\d)|\\d{1,2})*)"
const BASS = "(?:/([A-G][#b♯♭]?))?"
const CHORD_BODY = `${ROOT}${SUFFIX}${BASS}`

const CHORD_EXACT = new RegExp(`^${CHORD_BODY}$`)
// In running text: not glued to letters/digits on either side.
const CHORD_IN_TEXT = new RegExp(`(?<![A-Za-z0-9#♯♭/])${CHORD_BODY}(?![A-Za-z0-9#♯♭])`, "g")

function qualityOf(suffix: string): Quality {
  if (/^(maj|M)/.test(suffix)) return "major"
  if (/^(dim|°|ø)/.test(suffix) || /^m7b5/.test(suffix)) return "dim"
  if (/^(min|m)/.test(suffix)) return "minor"
  if (/^(aug|\+)/.test(suffix)) return "aug"
  if (/^sus/.test(suffix)) return "sus"
  return "major"
}

export function parseChord(name: string): Chord | null {
  const m = CHORD_EXACT.exec(name.trim())
  if (!m) return null
  const root = noteToPc(m[1] + (m[2] ?? ""))
  if (root === null) return null
  const bass = m[4] ? noteToPc(m[4]) : null
  return { root, suffix: m[3] ?? "", quality: qualityOf(m[3] ?? ""), bass }
}

export function formatChord(chord: Chord, preferFlats = false): string {
  const base = pcToNote(chord.root, preferFlats) + chord.suffix
  return chord.bass === null ? base : `${base}/${pcToNote(chord.bass, preferFlats)}`
}

export function transposeChordObj(chord: Chord, semitones: number): Chord {
  return {
    ...chord,
    root: mod12(chord.root + semitones),
    bass: chord.bass === null ? null : mod12(chord.bass + semitones),
  }
}

export function transposeChord(name: string, semitones: number, preferFlats = false): string {
  const chord = parseChord(name)
  if (!chord) return name
  return formatChord(transposeChordObj(chord, semitones), preferFlats)
}

/**
 * Things that look like chords but are not, in free-text charts:
 *  - string names: "on B and high E strings", "low E string"
 *  - the article "A": "A lead riff on top"
 */
function isFalseChord(text: string, start: number, match: string): boolean {
  const before = text.slice(Math.max(0, start - 6), start)
  const after = text.slice(start + match.length, start + match.length + 40)
  if (/\b(high|low)\s+$/i.test(before)) return true
  if (/^\s+(?:and\s+(?:high|low)\s+[A-G]\s+)?strings?\b/i.test(after)) return true
  if (match === "A" && /^\s+[a-z]/.test(after)) return true
  return false
}

type Found = { index: number; text: string; chord: Chord }

/** Every chord in a free-text chart, in order, with its position. */
export function findChords(text: string): Found[] {
  const out: Found[] = []
  for (const m of text.matchAll(CHORD_IN_TEXT)) {
    const index = m.index ?? 0
    if (isFalseChord(text, index, m[0])) continue
    const chord = parseChord(m[0])
    if (chord) out.push({ index, text: m[0], chord })
  }
  return out
}

/** Unique chord names in order of first appearance. */
export function extractChords(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const f of findChords(text)) {
    if (!seen.has(f.text)) {
      seen.add(f.text)
      out.push(f.text)
    }
  }
  return out
}

/**
 * Shifts every chord in a free-text chart, leaving everything else
 * (section labels, fret diagrams like 320033, notes) untouched.
 */
export function transposeText(text: string, semitones: number, preferFlats = false): string {
  if (mod12(semitones) === 0) return text
  let out = ""
  let last = 0
  for (const f of findChords(text)) {
    out += text.slice(last, f.index) + formatChord(transposeChordObj(f.chord, semitones), preferFlats)
    last = f.index + f.text.length
  }
  return out + text.slice(last)
}

/** Root + basic triad quality, for comparing chord sets ("Cadd9" ~ "C", "Em7" ~ "Em"). */
export function triadKey(chord: Chord): string {
  const q = chord.quality === "minor" ? "m" : chord.quality === "dim" ? "dim" : chord.quality === "aug" ? "aug" : ""
  return `${chord.root}${q}`
}

/**
 * Removes fret diagrams like "(320033)" or "(x32033)". They describe the
 * original shapes, so they are wrong once a chart is transposed.
 */
export function stripFretDiagrams(text: string): string {
  return text.replace(/\s*\((?:[0-9xX]{6}|(?:[0-9xX]{1,2}[- ]){5}[0-9xX]{1,2})\)/g, "")
}
