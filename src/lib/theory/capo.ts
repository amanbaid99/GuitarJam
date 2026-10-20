import { findChords, transposeChordObj, transposeText, type Chord } from "./chords"
import { mod12 } from "./notes"

/** Reads "Capo 3", "capo 4 (sounds in B)" -> 3, 4. No capo -> 0. */
export function parseCapo(text: string | null | undefined): number {
  const m = /capo\s*(\d{1,2})/i.exec(text ?? "")
  return m ? Number(m[1]) : 0
}

/** Shapes played with a capo -> the chords that actually sound. */
export function soundingFromShapes(chart: string, capo: number, preferFlats = false): string {
  return transposeText(chart, capo, preferFlats)
}

/** Chords you want to hear -> the shapes to play with a capo on `capo`. */
export function shapesForCapo(chart: string, capo: number): string {
  // Open shapes are named with sharps or naturals, so prefer sharps here.
  return transposeText(chart, -capo, false)
}

// Open-position shapes most players reach for without a barre.
const OPEN_MAJOR = new Set([0, 2, 4, 7, 9]) // C D E G A
const OPEN_MINOR = new Set([2, 4, 9]) // Dm Em Am

function isOpenShape(c: Chord): boolean {
  if (c.quality === "minor") return OPEN_MINOR.has(c.root)
  if (c.quality === "dim" || c.quality === "aug") return false
  return OPEN_MAJOR.has(c.root)
}

export type CapoOption = { capo: number; openShapes: number; total: number }

/**
 * For chords you want to hear, how many become open shapes at each capo
 * position (0 to maxFret). Sorted best first; lower frets win ties.
 */
export function capoOptions(chart: string, maxFret = 7): CapoOption[] {
  const chords = findChords(chart).map((f) => f.chord)
  const unique = new Map(chords.map((c) => [`${c.root}|${c.quality}`, c]))
  const list = [...unique.values()]
  const options: CapoOption[] = []
  for (let capo = 0; capo <= maxFret; capo++) {
    const openShapes = list.filter((c) => isOpenShape(transposeChordObj(c, -capo))).length
    options.push({ capo, openShapes, total: list.length })
  }
  return options.sort((a, b) => b.openShapes - a.openShapes || a.capo - b.capo)
}

/** Semitone distance going up, 0..11. */
export const semitonesUp = (from: number, to: number) => mod12(to - from)
