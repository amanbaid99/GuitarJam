import { describe, expect, it } from "vitest"
import { SEED_REPERTOIRE, repertoireSchema } from "./repertoire"
import { SEED_SKILLS } from "./skills"

describe("seed repertoire", () => {
  it("has the 4 groups and 63 songs from Notion", () => {
    expect(SEED_REPERTOIRE.families).toHaveLength(4)
    expect(SEED_REPERTOIRE.songs).toHaveLength(63)
  })

  it("only points songs at families that exist", () => {
    const names = new Set(SEED_REPERTOIRE.families.map((f) => f.name))
    for (const song of SEED_REPERTOIRE.songs) {
      if (song.family) expect(names.has(song.family)).toBe(true)
    }
  })

  it("rejects a song with an unknown family", () => {
    const bad = {
      families: [],
      songs: [{ ...SEED_REPERTOIRE.songs[0], family: "Nope" }],
    }
    expect(repertoireSchema.safeParse(bad).success).toBe(false)
  })

  it("has no duplicate songs", () => {
    const keys = SEED_REPERTOIRE.songs.map((s) => `${s.title}|${s.artist ?? ""}`.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("seed skills", () => {
  it("has exactly one focus skill: strumming with a metronome", () => {
    const focus = SEED_SKILLS.filter((s) => s.is_focus)
    expect(focus.map((s) => s.name)).toEqual(["Strumming with a metronome"])
  })

  it("has no duplicate area + name pairs", () => {
    const keys = SEED_SKILLS.map((s) => `${s.area}|${s.name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
