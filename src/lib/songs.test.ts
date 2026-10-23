import { describe, expect, it } from "vitest"
import {
  NO_FILTERS,
  daysBetween,
  groupByFamily,
  lastPractisedLabel,
  matchesFilters,
  sortSongs,
  type Family,
  type Song,
} from "./songs"

const song = (over: Partial<Song>): Song => ({
  id: crypto.randomUUID(),
  user_id: "u",
  title: "Song",
  artist: null,
  status: "can_play",
  difficulty: "easy",
  style: "strumming",
  family_id: null,
  key_capo: null,
  chords: null,
  first_line_hint: null,
  tab_link: null,
  notes: null,
  needs_verify: false,
  last_practised: null,
  lyrics: null,
  my_capo: null,
  my_transpose: 0,
  group_position: null,
  created_at: "2026-10-19T00:00:00Z",
  ...over,
})

const family = (id: string, name: string): Family => ({
  id,
  user_id: "u",
  name,
  key: "G",
  numbers: "I-IV-V",
  vibe: null,
  position: 0,
  created_at: "2026-10-19T00:00:00Z",
})

describe("lastPractisedLabel", () => {
  const today = "2026-10-20"
  it.each([
    [null, "Not yet"],
    ["2026-10-20", "Today"],
    ["2026-10-19", "Yesterday"],
    ["2026-10-15", "5 days ago"],
    ["2026-10-01", "2 weeks ago"],
    ["2026-07-20", "3 months ago"],
  ])("%s -> %s", (last, label) => {
    expect(lastPractisedLabel(last, today)).toBe(label)
  })

  it("counts days across months", () => {
    expect(daysBetween("2026-09-30", "2026-10-02")).toBe(2)
  })
})

describe("matchesFilters", () => {
  const s = song({ title: "Pani Da Rang", artist: "Ayushmann Khurrana", status: "can_play" })
  it("passes with no filters", () => expect(matchesFilters(s, NO_FILTERS)).toBe(true))
  it("filters by status", () => {
    expect(matchesFilters(s, { ...NO_FILTERS, status: "learning" })).toBe(false)
  })
  it("searches title and artist, ignoring case", () => {
    expect(matchesFilters(s, { ...NO_FILTERS, query: "ayush" })).toBe(true)
    expect(matchesFilters(s, { ...NO_FILTERS, query: "yellow" })).toBe(false)
  })
  it("treats a missing difficulty as not matching a difficulty filter", () => {
    expect(matchesFilters(song({ difficulty: null }), { ...NO_FILTERS, difficulty: "easy" })).toBe(false)
  })
})

describe("groupByFamily", () => {
  it("keeps family order, sorts by title, and puts the rest in Unassigned", () => {
    const fams = [family("a", "Em-D-C"), family("b", "Am-G-F")]
    const songs = [
      song({ title: "Woh Lamhe", family_id: "a" }),
      song({ title: "Enna Sona", family_id: "a" }),
      song({ title: "Labon Ko", family_id: "b" }),
      song({ title: "Roobaroo" }),
      song({ title: "Orphan", family_id: "deleted" }),
    ]
    const groups = groupByFamily(fams, songs)
    expect(groups.map((g) => g.family?.name ?? "Unassigned")).toEqual(["Em-D-C", "Am-G-F", "Unassigned"])
    expect(groups[0].songs.map((s) => s.title)).toEqual(["Enna Sona", "Woh Lamhe"])
    expect(groups[2].songs.map((s) => s.title)).toEqual(["Orphan", "Roobaroo"])
  })
})

describe("sortSongs", () => {
  const fams = [family("g", "G-Em-C-D")]
  const songs = [
    song({ title: "Yellow", family_id: "g", key_capo: "Capo 4", chords: "G, D, C", difficulty: "easy", last_practised: "2026-10-18" }),
    song({ title: "Perfect", family_id: "g", chords: "G, Em, C, D", difficulty: "easy", last_practised: "2026-09-01" }),
    song({ title: "Roobaroo", chords: "A, D, E", difficulty: "medium" }),
    song({ title: "Labon Ko", chords: "Am, G, F, G", difficulty: null, my_transpose: 2 }),
    song({ title: "Stay", chords: null }),
  ]

  it("sorts A to Z", () => {
    expect(sortSongs(songs, fams, "az")[0].songs.map((s) => s.title)).toEqual([
      "Labon Ko", "Perfect", "Roobaroo", "Stay", "Yellow",
    ])
  })

  it("puts never-played songs first, then the oldest", () => {
    expect(sortSongs(songs, fams, "recent")[0].songs.map((s) => s.title)).toEqual([
      "Labon Ko", "Roobaroo", "Stay", "Perfect", "Yellow",
    ])
  })

  it("groups by the key you actually play it in", () => {
    const groups = sortSongs(songs, fams, "key").map((g) => [g.label, g.songs.map((s) => s.title)])
    expect(groups).toEqual([
      ["Key of D", ["Labon Ko"]], // Am-G-F guessed as C, moved up 2 by your version
      ["Key of G", ["Perfect"]],
      ["Key of A", ["Roobaroo"]],
      ["Key of B", ["Yellow"]], // G shapes with capo 4
      ["Key unknown", ["Stay"]],
    ])
  })

  it("groups by difficulty, easy first", () => {
    expect(sortSongs(songs, fams, "difficulty").map((g) => g.label)).toEqual(["Easy", "Medium", "Not set"])
  })

  it("filters songs you know", () => {
    expect(matchesFilters(song({ status: "polished" }), { ...NO_FILTERS, status: "known" })).toBe(true)
    expect(matchesFilters(song({ status: "learning" }), { ...NO_FILTERS, status: "known" })).toBe(false)
  })
})
