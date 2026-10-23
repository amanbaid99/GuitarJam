import { describe, expect, it } from "vitest"
import { fitReason, keyFit, suggestGroup } from "./groups"

const GROUPS = [
  { id: "G", key: "G" },
  { id: "C", key: "C" },
  { id: "D", key: "D" },
  { id: "A", key: "A" },
]
const group = (chart: string) => suggestGroup(chart, GROUPS)?.groupId ?? "Other"

describe("suggestGroup (matches the hand-made grouping of the starting library)", () => {
  it.each([
    ["Perfect", "G, Em, C, D", "G"],
    ["Enna Sona", "Em, D, C, D", "G"],
    ["Mahi", "Em, D, C, B. Barre B.", "G"],
    ["Yellow", "Verse: G, Dsus4, Cadd9. Chorus: Cadd9, Em7, Dsus4", "G"],
    ["Wonderful Tonight", "G, D/F#, C, D, Em", "G"],
    ["O Sanam", "Intro: G, C, A, D. Main: G, D, C, D", "G"],
    ["Girls Like You", "C, G, Am, F", "C"],
    ["Bhula Do", "Am, G, F, E", "C"],
    ["Tu Hi Haqeeqat", "Am, G, F", "C"],
    ["Working Class Hero", "Am, G, Am (Am, G, D, Am)", "G"],
    ["Blowin' in the Wind", "D, G, D / D, G, A / G, A, D, Bm", "D"],
    ["Zara Zara", "Bm, G, A, F#", "D"],
    ["Norwegian Wood", "D, C, D", "G"],
    ["Roobaroo", "Verse: A, D. Chorus: E, D, A", "A"],
    ["Aye Khuda", "E, D, E", "A"],
    ["Best Part", "D7, Am7, Bm, Dm", "Other"],
  ])("%s", (_title, chords, expected) => {
    expect(group(chords)).toBe(expected)
  })

  it("needs at least two chords", () => {
    expect(group("G")).toBe("Other")
    expect(group("")).toBe("Other")
  })

  it("explains the suggestion", () => {
    const s = suggestGroup("G, D, A, Em", GROUPS)!
    expect(s.groupId).toBe("D")
    expect(fitReason(s)).toBe("All 4 chords fit")
    const o = suggestGroup("G, C, A, D", GROUPS)!
    expect(o.groupId).toBe("G")
    expect(fitReason(o)).toBe("3 of 4 chords fit (A is outside)")
  })

  it("reads a minor group key as its relative major", () => {
    expect(keyFit("Em, D, C", "Em")?.fit).toBe(1)
  })
})
