import { findChords, parseChord, type Chord } from "./chords"
import { mod12, noteToPc, pcToNote } from "./notes"

export type Key = { tonic: number; minor: boolean }

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
const MAJOR_QUALITIES = ["major", "minor", "minor", "major", "major", "minor", "dim"] as const
const MINOR_QUALITIES = ["minor", "dim", "major", "minor", "minor", "major", "major"] as const
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]

/** "G", "Em", "Bb", "F#m" -> Key. */
export function parseKey(name: string): Key | null {
  const m = /^\s*([A-G][#b♯♭]?)\s*(m|min|minor)?\s*$/i.exec(name)
  if (!m) return null
  const tonic = noteToPc(m[1][0].toUpperCase() + m[1].slice(1))
  return tonic === null ? null : { tonic, minor: Boolean(m[2]) }
}

// Major keys written with flats: F Bb Eb Ab Db. (F#/Gb is written F#.)
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1])

export function prefersFlats(key: Key): boolean {
  const relativeMajor = key.minor ? mod12(key.tonic + 3) : key.tonic
  return FLAT_MAJOR_TONICS.has(relativeMajor)
}

export function keyName(key: Key): string {
  return pcToNote(key.tonic, prefersFlats(key)) + (key.minor ? "m" : "")
}

export function transposeKey(key: Key, semitones: number): Key {
  return { ...key, tonic: mod12(key.tonic + semitones) }
}

function steps(key: Key) {
  return key.minor ? MINOR_STEPS : MAJOR_STEPS
}

/** The seven chords of a key: I ii iii IV V vi vii° (or i ii° III iv v VI VII in minor). */
export function diatonicChords(key: Key): { numeral: string; chord: string }[] {
  const flats = prefersFlats(key)
  const qualities = key.minor ? MINOR_QUALITIES : MAJOR_QUALITIES
  return steps(key).map((step, i) => {
    const q = qualities[i]
    const root = pcToNote(key.tonic + step, flats)
    const chord = root + (q === "minor" ? "m" : q === "dim" ? "dim" : "")
    const numeral =
      q === "major" ? ROMAN[i] : q === "minor" ? ROMAN[i].toLowerCase() : `${ROMAN[i].toLowerCase()}°`
    return { numeral, chord }
  })
}

// Common names for notes outside the scale.
const CHROMATIC_MAJOR: Record<number, string> = { 1: "bII", 3: "bIII", 6: "#IV", 8: "bVI", 10: "bVII" }
const CHROMATIC_MINOR: Record<number, string> = { 1: "bII", 4: "#III", 6: "#IV", 9: "#VI", 11: "#VII" }

/** One chord as a number in a key. Case follows the chord: Em in G -> "vi", E in Am -> "V". */
export function chordToNumber(chord: Chord, key: Key): string {
  const interval = mod12(chord.root - key.tonic)
  const degree = steps(key).indexOf(interval)
  let numeral: string
  if (degree >= 0) numeral = ROMAN[degree]
  else numeral = (key.minor ? CHROMATIC_MINOR : CHROMATIC_MAJOR)[interval]

  const lower = chord.quality === "minor" || chord.quality === "dim"
  // Keep the accidental prefix (b/#) as is, change case of the roman part.
  numeral = numeral.replace(/[IV]+/, (r) => (lower ? r.toLowerCase() : r))

  // Drop only the quality marker (case already shows minor). "maj7" stays: it is not a plain 7.
  const extra = chord.suffix.replace(/^(min|m(?!aj)|dim|°|aug|\+)/, "")
  const mark = chord.quality === "dim" ? "°" : chord.quality === "aug" ? "+" : ""
  return numeral + mark + extra
}

/** A progression ("Em, D, C" or a full chart) as numbers, in order, repeats kept. */
export function progressionToNumbers(text: string, key: Key): string[] {
  return findChords(text).map((f) => chordToNumber(f.chord, key))
}

export function numberOf(name: string, key: Key): string | null {
  const chord = parseChord(name)
  return chord ? chordToNumber(chord, key) : null
}

/**
 * Best guess at a chart's key: the key whose scale fits the most chords
 * (with the right major/minor quality). Ties go to major, then to the key
 * whose tonic chord appears first in the chart.
 */
export function guessKey(text: string): Key | null {
  const chords = findChords(text).map((f) => f.chord)
  if (chords.length === 0) return null

  let best: { key: Key; score: number; firstTonic: number } | null = null
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const key = { tonic, minor }
      const qualities = minor ? MINOR_QUALITIES : MAJOR_QUALITIES
      let score = 0
      for (const c of chords) {
        const degree = steps(key).indexOf(mod12(c.root - tonic))
        if (degree < 0) continue
        const want = qualities[degree]
        const have = c.quality === "sus" || c.quality === "aug" ? want : c.quality
        // A major V in a minor key (harmonic minor) is the classic sign of minor.
        const harmonicV = minor && degree === 4 && have === "major"
        if (have === want || harmonicV) score++
      }
      const firstTonic = chords.findIndex(
        (c) => c.root === tonic && (minor ? c.quality === "minor" : c.quality !== "minor"),
      )
      const ft = firstTonic < 0 ? Infinity : firstTonic
      // Ties: prefer major (how the families are written: vi-V-IV in G, not i-VII-VI in Em),
      // then the key whose tonic chord shows up first.
      const better =
        !best ||
        score > best.score ||
        (score === best.score && best.key.minor && !minor) ||
        (score === best.score && best.key.minor === minor && ft < best.firstTonic)
      if (better) best = { key, score, firstTonic: ft }
    }
  }
  return best?.key ?? null
}
