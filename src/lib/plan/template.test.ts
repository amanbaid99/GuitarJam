import { describe, expect, it } from "vitest"
import { pickFocusSong, pickRotationSong, templatePlan } from "./template"
import { PLAN_MINUTES, planSchema, planTotal, type PlanInput } from "./types"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const base: PlanInput = {
  minutes: 20,
  today: "2026-10-20",
  focusSkill: "Strumming with a metronome",
  songs: [
    { id: id(1), title: "Yellow", status: "learning", family_id: "f1", last_practised: null },
    { id: id(2), title: "Stand by Me", status: "can_play", family_id: "f1", last_practised: "2026-10-18" },
    { id: id(3), title: "Perfect", status: "can_play", family_id: "f1", last_practised: "2026-09-01" },
    { id: id(4), title: "Roobaroo", status: "can_play", family_id: null, last_practised: null },
    { id: id(5), title: "Pehle Bhi Main", status: "want_to_learn", family_id: null, last_practised: null },
  ],
  recentSessionDates: ["2026-10-14", "2026-10-18"],
}

describe("templatePlan", () => {
  it.each(PLAN_MINUTES)("adds up to exactly %i minutes and matches the plan schema", (minutes) => {
    const plan = templatePlan({ ...base, minutes })
    expect(planTotal(plan)).toBe(minutes)
    expect(planSchema.safeParse(plan).success).toBe(true)
  })

  it("follows warm-up, skill, song, free play", () => {
    const plan = templatePlan(base)
    expect(plan.blocks.map((b) => b.label)).toEqual([
      "Warm-up",
      "Strumming with a metronome",
      "Yellow",
      "Free play: Perfect",
    ])
  })

  it("merges skill and song for 10 minutes", () => {
    const plan = templatePlan({ ...base, minutes: 10 })
    expect(plan.blocks).toHaveLength(3)
    expect(plan.blocks[1].song_id).toBe(id(1))
  })

  it("is gentle when there were fewer than 2 sessions in 14 days", () => {
    const plan = templatePlan({ ...base, recentSessionDates: ["2026-10-10"] })
    expect(plan.why).toMatch(/Getting back into it/)
  })

  it("never uses em dashes", () => {
    for (const minutes of PLAN_MINUTES) {
      const plan = templatePlan({ ...base, minutes })
      expect(JSON.stringify(plan)).not.toMatch(/\u2014/)
    }
  })

  it("writes chord shapes as fret numbers and strums as D DU UDU", () => {
    const text = JSON.stringify(templatePlan(base))
    expect(text).toContain("320003")
    expect(text).toContain("D DU UDU")
  })
})

describe("song picks", () => {
  it("prefers the song being learned", () => {
    expect(pickFocusSong(base)?.title).toBe("Yellow")
  })

  it("falls back to the least recently played can-play song", () => {
    const songs = base.songs.filter((s) => s.status !== "learning")
    expect(pickFocusSong({ ...base, songs })?.title).toBe("Roobaroo")
  })

  it("rotates in a family song not played for 21+ days", () => {
    // Stand by Me was 2 days ago; Perfect was 49 days ago; Roobaroo has no family.
    expect(pickRotationSong(base)?.title).toBe("Perfect")
  })

  it("returns null when every family song is fresh", () => {
    const songs = base.songs.map((s) => ({ ...s, last_practised: "2026-10-19" }))
    expect(pickRotationSong({ ...base, songs })).toBeNull()
  })
})
