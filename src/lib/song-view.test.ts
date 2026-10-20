import { describe, expect, it } from "vitest"
import { parseLyricLine, parseLyrics, transposeLyrics } from "@/lib/theory"
import { chartView, playLabel, soundingKeyName } from "./song-view"

describe("lyrics with inline chords", () => {
  it("puts each chord above the word that follows it", () => {
    expect(parseLyricLine("[G]Look at the [D]stars")).toEqual({
      kind: "line",
      hasChords: true,
      segments: [
        { chord: "G", text: "Look at the " },
        { chord: "D", text: "stars" },
      ],
    })
  })

  it("keeps words before the first chord and a chord at the end", () => {
    const line = parseLyricLine("Oh [Em]yeah [C]")
    expect(line).toMatchObject({
      segments: [
        { chord: null, text: "Oh " },
        { chord: "Em", text: "yeah " },
        { chord: "C", text: "" },
      ],
    })
  })

  it("treats [Chorus] and 'Verse 2:' as headings, and leaves other brackets as text", () => {
    expect(parseLyricLine("[Chorus]")).toEqual({ kind: "heading", text: "Chorus" })
    expect(parseLyricLine("Verse 2:")).toEqual({ kind: "heading", text: "Verse 2" })
    expect(parseLyricLine("so [softly] now")).toEqual({
      kind: "line",
      hasChords: false,
      segments: [{ chord: null, text: "so [softly] now" }],
    })
    expect(parseLyrics("a\n\nb").map((l) => l.kind)).toEqual(["line", "blank", "line"])
  })

  it("transposes only the chords", () => {
    expect(transposeLyrics("[G]Look at the [D/F#]stars [Chorus]", 2)).toBe("[A]Look at the [E/G#]stars [Chorus]")
    expect(transposeLyrics("[A]x", 1, true)).toBe("[Bb]x")
  })
})

describe("chartView (my version)", () => {
  const yellow = {
    chords: "Verse: G (320033), Dsus4 (xx0233), Cadd9 (x32033).",
    lyrics: "[G]look [Dsus4]up",
    keyCapo: "Capo 4 (sounds in B)",
    familyKey: "G",
  }

  it("shows the written chart untouched when nothing is changed", () => {
    const v = chartView({ ...yellow, transpose: 0, capo: null })
    expect(v.chords).toBe(yellow.chords)
    expect(v.lyrics).toBe(yellow.lyrics)
    expect(v.capo).toBe(4)
    expect(soundingKeyName(v)).toBe("B")
    expect(playLabel(v)).toBe("Capo 4 · G shapes · sounds in B")
  })

  it("no capo: same sound, B shapes, fret diagrams removed, lyrics moved too", () => {
    const v = chartView({ ...yellow, transpose: 0, capo: 0 })
    expect(v.chords).toBe("Verse: B, F#sus4, Eadd9.")
    expect(v.lyrics).toBe("[B]look [F#sus4]up")
    expect(playLabel(v)).toBe("No capo · B shapes")
  })

  it("transposing down 2 with capo 2 sounds in A with G shapes", () => {
    const v = chartView({ ...yellow, transpose: -2, capo: 2 })
    expect(soundingKeyName(v)).toBe("A")
    expect(v.lyrics).toBe("[G]look [Dsus4]up")
    expect(playLabel(v)).toBe("Capo 2 · G shapes · sounds in A")
  })

  it("guesses the key from lyrics when there is no family and no chords", () => {
    const v = chartView({ chords: null, lyrics: "[Am]a [G]b [F]c [E]d", keyCapo: null, familyKey: null, transpose: 0, capo: null })
    expect(soundingKeyName(v)).toBe("Am")
  })
})
