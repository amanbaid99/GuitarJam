import {
  guessKey,
  keyName,
  parseCapo,
  parseKey,
  prefersFlats,
  stripFretDiagrams,
  transposeKey,
  transposeLyrics,
  transposeText,
  type Key,
} from "@/lib/theory"

/**
 * One place that works out how a song is actually played ("my version").
 *
 * The chart is written as shapes. If key/capo says "Capo 3", those shapes sound
 * 3 semitones higher. `transpose` moves the sound; `capo` picks the shapes.
 * Shapes to play = written + baseCapo + transpose - capo.
 */
export type ChartInput = {
  chords: string | null
  lyrics?: string | null
  keyCapo: string | null
  familyKey: string | null
  transpose: number
  /** null = keep the capo written in keyCapo. */
  capo: number | null
}

export type ChartView = {
  baseCapo: number
  capo: number
  transpose: number
  /** Semitones applied to the written chords. 0 means show them as written. */
  shift: number
  writtenKey: Key | null
  soundingKey: Key | null
  shapesKey: Key | null
  chords: string | null
  lyrics: string | null
}

export function chartView(input: ChartInput): ChartView {
  const baseCapo = Math.min(parseCapo(input.keyCapo), 12)
  const capo = input.capo ?? baseCapo
  const transpose = input.transpose
  const shift = baseCapo + transpose - capo

  const keySource = [input.chords, input.lyrics].filter(Boolean).join("\n")
  const writtenKey = (input.familyKey ? parseKey(input.familyKey) : null) ?? guessKey(keySource)
  const soundingKey = writtenKey ? transposeKey(writtenKey, baseCapo + transpose) : null
  const shapesKey = soundingKey ? transposeKey(soundingKey, -capo) : null

  const moved = ((shift % 12) + 12) % 12 !== 0
  const flats = shapesKey ? prefersFlats(shapesKey) : false
  return {
    baseCapo,
    capo,
    transpose,
    shift,
    writtenKey,
    soundingKey,
    shapesKey,
    // Fret diagrams describe the written shapes, so they go once the shapes move.
    chords: input.chords ? (moved ? stripFretDiagrams(transposeText(input.chords, shift, flats)) : input.chords) : null,
    lyrics: input.lyrics ? (moved ? transposeLyrics(input.lyrics, shift, flats) : input.lyrics) : null,
  }
}

/** Short label for how to play it: "Capo 3 · G shapes · sounds in Bb". */
export function playLabel(view: ChartView): string {
  const parts = [
    view.capo > 0 ? `Capo ${view.capo}` : "No capo",
    view.shapesKey ? `${keyName(view.shapesKey)} shapes` : null,
    view.soundingKey && view.capo > 0 ? `sounds in ${keyName(view.soundingKey)}` : null,
  ]
  return parts.filter(Boolean).join(" · ")
}

/** The key you hear, for sorting: "G", "Bb", "Em". */
export function soundingKeyName(view: ChartView): string | null {
  return view.soundingKey ? keyName(view.soundingKey) : null
}
