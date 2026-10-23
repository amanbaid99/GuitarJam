import { describe, expect, it } from "vitest"
import { SEED_REPERTOIRE } from "@/lib/seed/repertoire"
import {
  capoOptions,
  diatonicChords,
  extractChords,
  formatChord,
  guessKey,
  keyName,
  noteToPc,
  numberOf,
  parseCapo,
  parseChord,
  parseKey,
  pcToNote,
  prefersFlats,
  progressionToNumbers,
  shapesForCapo,
  soundingFromShapes,
  stripFretDiagrams,
  suggestGroup,
  transposeChord,
  transposeKey,
  transposeText,
} from "."

describe("notes", () => {
  it("reads sharps, flats and unicode accidentals", () => {
    expect(noteToPc("C")).toBe(0)
    expect(noteToPc("C#")).toBe(1)
    expect(noteToPc("Db")).toBe(1)
    expect(noteToPc("B♭")).toBe(10)
    expect(noteToPc("Cb")).toBe(11)
    expect(noteToPc("H")).toBeNull()
  })
  it("names pitch classes either way", () => {
    expect(pcToNote(10)).toBe("A#")
    expect(pcToNote(10, true)).toBe("Bb")
    expect(pcToNote(-1)).toBe("B")
  })
})

describe("parseChord", () => {
  it.each([
    ["Em", 4, "m", "minor", null],
    ["D", 2, "", "major", null],
    ["Cadd9", 0, "add9", "major", null],
    ["Fmaj7", 5, "maj7", "major", null],
    ["Dsus4", 2, "sus4", "sus", null],
    ["C#m7", 1, "m7", "minor", null],
    ["Bbm", 10, "m", "minor", null],
    ["Bdim", 11, "dim", "dim", null],
    ["Bm7b5", 11, "m7b5", "dim", null],
    ["Caug", 0, "aug", "aug", null],
    ["D/F#", 2, "", "major", 6],
    ["Am/G", 9, "m", "minor", 7],
    ["Badd11", 11, "add11", "major", null],
  ])("%s", (name, root, suffix, quality, bass) => {
    expect(parseChord(name)).toEqual({ root, suffix, quality, bass })
  })

  it("rejects words", () => {
    for (const w of ["Easy", "Barre", "Chorus", "Bridge", "x2", "320033", ""]) {
      expect(parseChord(w)).toBeNull()
    }
  })

  it("round-trips through formatChord", () => {
    for (const name of ["Em", "C#m7", "D/F#", "Fmaj7", "Asus4", "Am/G"]) {
      expect(formatChord(parseChord(name)!)).toBe(name)
    }
  })
})

describe("transposeChord", () => {
  it("moves root and bass, keeps the suffix", () => {
    expect(transposeChord("Em", 2)).toBe("F#m")
    expect(transposeChord("D/F#", 2)).toBe("E/G#")
    expect(transposeChord("Cadd9", -1)).toBe("Badd9")
    expect(transposeChord("Am7", 12)).toBe("Am7")
  })
  it("spells with flats when asked", () => {
    expect(transposeChord("A", 1, true)).toBe("Bb")
    expect(transposeChord("A", 1, false)).toBe("A#")
  })
})

describe("transposeText", () => {
  it("leaves section labels and punctuation alone", () => {
    expect(transposeText("Chorus: Em, D, C, Em. Barre Bm.", 2)).toBe("Chorus: F#m, E, D, F#m. Barre C#m.")
  })

  it("does not touch fret diagrams, repeat marks or time signatures", () => {
    expect(transposeText("G (320033), Dsus4 (xx0233). 6/8 feel. Am, G (x3)", 2)).toBe(
      "A (320033), Esus4 (xx0233). 6/8 feel. Bm, A (x3)",
    )
  })

  it("does not treat string names or the article A as chords", () => {
    const yellow = "Ring and pinky stay anchored on B and high E strings, 3rd fret."
    expect(transposeText(yellow, 3)).toBe(yellow)
    expect(transposeText("A lead riff on top. Verse: A, D", 2)).toBe("A lead riff on top. Verse: B, E")
  })

  it("handles 'Bm-ish' style notes", () => {
    expect(transposeText("D7, Am7, Bm-ish", 1, true)).toBe("Eb7, Bbm7, Cm-ish")
  })

  it("is a no-op for 0 or 12 semitones", () => {
    const text = "Am, G, F, E"
    expect(transposeText(text, 0)).toBe(text)
    expect(transposeText(text, 12)).toBe(text)
  })

  it("transposes every seed chart without losing non-chord text", () => {
    for (const song of SEED_REPERTOIRE.songs) {
      if (!song.chords) continue
      const there = transposeText(song.chords, 5)
      const back = transposeText(there, -5)
      // Spelling may change (A# vs Bb), so compare pitch content.
      expect(extractChords(back).map((c) => parseChord(c)!.root)).toEqual(
        extractChords(song.chords).map((c) => parseChord(c)!.root),
      )
      expect(there.replace(/[A-G][#b]?/g, "")).toBe(song.chords.replace(/[A-G][#b]?/g, ""))
    }
  })
})

describe("extractChords", () => {
  it("lists unique chords in order", () => {
    expect(extractChords("Intro: Am, F, G, Am. Mid: G, F, Am, Em.")).toEqual(["Am", "F", "G", "Em"])
  })
  it("reads the Yellow chart correctly", () => {
    const yellow = SEED_REPERTOIRE.songs.find((s) => s.title === "Yellow")!.chords!
    expect(extractChords(yellow)).toEqual(["G", "Dsus4", "Cadd9", "Em7"])
  })
})

describe("keys", () => {
  it("parses key names", () => {
    expect(parseKey("G")).toEqual({ tonic: 7, minor: false })
    expect(parseKey("Em")).toEqual({ tonic: 4, minor: true })
    expect(parseKey("Bb")).toEqual({ tonic: 10, minor: false })
    expect(parseKey("nope")).toBeNull()
  })

  it("knows which keys use flats", () => {
    expect(prefersFlats(parseKey("F")!)).toBe(true)
    expect(prefersFlats(parseKey("Dm")!)).toBe(true)
    expect(prefersFlats(parseKey("G")!)).toBe(false)
    expect(prefersFlats(parseKey("F#")!)).toBe(false)
    expect(keyName(transposeKey(parseKey("G")!, 3))).toBe("Bb")
    expect(keyName(transposeKey(parseKey("Em")!, 1))).toBe("Fm")
  })

  it("lists the diatonic chords of G major", () => {
    expect(diatonicChords(parseKey("G")!)).toEqual([
      { numeral: "I", chord: "G" },
      { numeral: "ii", chord: "Am" },
      { numeral: "iii", chord: "Bm" },
      { numeral: "IV", chord: "C" },
      { numeral: "V", chord: "D" },
      { numeral: "vi", chord: "Em" },
      { numeral: "vii°", chord: "F#dim" },
    ])
  })

  it("lists the diatonic chords of A minor", () => {
    expect(diatonicChords(parseKey("Am")!).map((d) => `${d.numeral}:${d.chord}`)).toEqual([
      "i:Am", "ii°:Bdim", "III:C", "iv:Dm", "v:Em", "VI:F", "VII:G",
    ])
  })

  it("uses flats for diatonic chords in flat keys", () => {
    expect(diatonicChords(parseKey("F")!).map((d) => d.chord)).toEqual([
      "F", "Gm", "Am", "Bb", "C", "Dm", "Edim",
    ])
  })
})

describe("number system", () => {
  const G = parseKey("G")!
  it("matches the family numbers from the seed", () => {
    for (const f of SEED_REPERTOIRE.families) {
      const key = parseKey(f.key)!
      expect(progressionToNumbers(f.name.replaceAll("-", " "), key).join("-")).toBe(f.numbers)
    }
  })
  it("keeps extensions and marks dim and borrowed chords", () => {
    expect(numberOf("Cadd9", G)).toBe("IVadd9")
    expect(numberOf("Em7", G)).toBe("vi7")
    expect(numberOf("Cmaj7", G)).toBe("IVmaj7")
    expect(numberOf("D7", G)).toBe("V7")
    expect(numberOf("F#dim", G)).toBe("vii°")
    expect(numberOf("F", G)).toBe("bVII")
    expect(numberOf("D/F#", G)).toBe("V")
  })
  it("uses chord case in minor keys", () => {
    const Am = parseKey("Am")!
    expect(progressionToNumbers("Am, G, F, E", Am)).toEqual(["i", "VII", "VI", "V"])
  })
})

describe("guessKey", () => {
  it.each([
    ["G, Em, C, D", "G"],
    ["Em, D, C", "G"],
    ["Am, G, F, G", "C"],
    ["D, G, A", "D"],
    ["Am, G, F, E", "Am"],
  ])("%s -> %s", (chart, key) => {
    expect(keyName(guessKey(chart)!)).toBe(key)
  })
  it("returns null with no chords", () => expect(guessKey("x2, 6/8 feel")).toBeNull())
})

describe("capo", () => {
  it("reads capo from key/capo text", () => {
    expect(parseCapo("Capo 4 (sounds in B)")).toBe(4)
    expect(parseCapo("capo3")).toBe(3)
    expect(parseCapo(null)).toBe(0)
    expect(parseCapo("Key of D")).toBe(0)
  })

  it("converts shapes to sounding chords and back", () => {
    // Yellow: G shapes with capo 4 sound in B.
    expect(soundingFromShapes("G, Dsus4, Cadd9", 4)).toBe("B, F#sus4, Eadd9")
    expect(shapesForCapo("B, F#sus4, Eadd9", 4)).toBe("G, Dsus4, Cadd9")
  })

  it("finds the capo that gives the most open shapes", () => {
    // Bb Gm Eb F: capo 3 turns this into G Em C D.
    const best = capoOptions("Bb, Gm, Eb, F")[0]
    expect(best).toEqual({ capo: 3, openShapes: 4, total: 4 })
  })

  it("prefers no capo when the chords are already open", () => {
    expect(capoOptions("G, Em, C, D")[0].capo).toBe(0)
  })
})

describe("suggestGroup on the seed library", () => {
  const groups = SEED_REPERTOIRE.families.map((f) => ({ id: f.name, key: f.key }))

  it("agrees with most of the groups picked by hand", () => {
    const placed = SEED_REPERTOIRE.songs.filter((s) => s.family && s.chords)
    const agree = placed.filter((s) => suggestGroup(s.chords!, groups)?.groupId === s.family)
    expect(agree.length / placed.length).toBeGreaterThanOrEqual(0.85)
  })
})

describe("stripFretDiagrams", () => {
  it("removes six-string diagrams and keeps everything else", () => {
    expect(stripFretDiagrams("G (320033), Dsus4 (xx0233), Cadd9 (x32033). Am, G (x3)")).toBe(
      "G, Dsus4, Cadd9. Am, G (x3)",
    )
    expect(stripFretDiagrams("Bm (x-2-4-4-3-2)")).toBe("Bm")
  })
})
