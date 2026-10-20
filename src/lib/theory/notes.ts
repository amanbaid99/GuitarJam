// Pitch classes: C = 0 ... B = 11.

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const mod12 = (n: number) => ((n % 12) + 12) % 12

/** "C#" / "Db" / "D♭" -> pitch class. Returns null for anything else. */
export function noteToPc(note: string): number | null {
  const m = /^([A-G])([#b♯♭]?)$/.exec(note.trim())
  if (!m) return null
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0
  return mod12(LETTER_PC[m[1]] + acc)
}

export function pcToNote(pc: number, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]
}
