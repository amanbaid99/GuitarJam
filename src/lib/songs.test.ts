import { describe, expect, it } from "vitest"
import {
  NO_FILTERS,
  daysBetween,
  groupByFamily,
  lastPractisedLabel,
  matchesFilters,
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
