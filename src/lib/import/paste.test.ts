import { describe, expect, it } from "vitest"
import { mergeChordsIntoWords, parsePastedSheet } from "./paste"

const UG = `Daughters Chords by John Mayer
1,234,567 views, 12,345 saves
Author someone [a] 1,000
Difficulty: novice
Tuning: E A D G B E
Capo: 3rd fret
Key: Bb

[Intro]
G  Cadd9  G  Cadd9

[Verse 1]
G                    Cadd9
I know a girl, she puts the color inside of my world
G                       Cadd9
But she's just like a maze where all of the walls continually change

[Chorus]
Em            D           Cadd9
So fathers, be good to your daughters
Em            D           Cadd9
Daughters will love like you do

[Chorus]
Em            D           Cadd9
So fathers, be good to your daughters
Em            D           Cadd9
Daughters will love like you do

Last update: Jan 1, 2020
Please rate this tab`

describe("parsePastedSheet", () => {
  const song = parsePastedSheet(UG)

  it("reads title, artist and capo from the page header", () => {
    expect(song.title).toBe("Daughters")
    expect(song.artist).toBe("John Mayer")
    expect(song.key_capo).toBe("Capo 3")
  })

  it("keeps the chords exactly as written", () => {
    expect(song.chordNames).toEqual(["G", "Cadd9", "Em", "D"])
  })

  it("puts chords above the right words", () => {
    expect(song.lyrics).toContain("[G]I know a girl, she pu[Cadd9]ts the color inside of my world")
    expect(song.lyrics).toContain("[Em]So fathers, be [D]good to you[Cadd9]r daughters")
  })

  it("keeps section headings and drops page clutter and the footer", () => {
    expect(song.lyrics).toMatch(/^\[Intro\]\n\[G\] \[Cadd9\] \[G\] \[Cadd9\]\n\n\[Verse 1\]/)
    expect(song.lyrics).not.toMatch(/Tuning|views|Last update|rate/)
  })

  it("summarises chords by section, listing a repeated chorus once", () => {
    expect(song.chords).toBe("Intro: G Cadd9 G Cadd9\nVerse 1: G Cadd9\nChorus: Em D Cadd9")
  })

  it("counts lyric lines", () => {
    expect(song.lyricLines).toBe(6)
  })
})

describe("other layouts", () => {
  it("handles 'Chorus:' labels with chords on the same line, and Artist - Title", () => {
    const s = parsePastedSheet("Arijit Singh - Tum Hi Ho\nIntro: Am F G\nChorus:\nAm        F\nHum tere bin ab")
    expect(s.title).toBe("Tum Hi Ho")
    expect(s.artist).toBe("Arijit Singh")
    expect(s.chords).toBe("Intro: Am F G\nChorus: Am F")
    expect(s.lyrics).toBe("[Intro]\n[Am] [F] [G]\n\n[Chorus]\n[Am]Hum tere b[F]in ab")
  })

  it("accepts bar lines and repeat marks on chord lines", () => {
    const s = parsePastedSheet("[Verse]\n| G  D | Em  C | x2")
    expect(s.chordNames).toEqual(["G", "D", "Em", "C"])
  })

  it("keeps chords already written inline", () => {
    const s = parsePastedSheet("[Verse]\n[G]Look at the [D]stars")
    expect(s.lyrics).toBe("[Verse]\n[G]Look at the [D]stars")
    expect(s.chordNames).toEqual(["G", "D"])
  })

  it("does not read ordinary lyric lines as chords", () => {
    const s = parsePastedSheet("[Verse]\nA girl and a boy")
    expect(s.chordNames).toEqual([])
  })

  it("no capo means no key_capo", () => {
    expect(parsePastedSheet("Capo: no capo\n[Verse]\nG D").key_capo).toBeNull()
  })
})

describe("mergeChordsIntoWords", () => {
  it("adds chords past the end of the words after them", () => {
    expect(mergeChordsIntoWords([{ text: "G", col: 0 }, { text: "D", col: 10 }, { text: "C", col: 14 }], "Hi")).toBe(
      "[G]Hi [D] [C]",
    )
  })

  it("moves a chord over a gap to the next word", () => {
    expect(mergeChordsIntoWords([{ text: "D", col: 3 }], "Go  home")).toBe("Go  [D]home")
  })

  it("removes shared indentation", () => {
    expect(mergeChordsIntoWords([{ text: "G", col: 4 }], "    Hello")).toBe("[G]Hello")
  })
})
