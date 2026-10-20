import { beforeEach, describe, expect, it, vi } from "vitest"
import { SEED_REPERTOIRE } from "@/lib/seed/repertoire"
import { buildSetMessage, buildSetProposal, cleanSetProposal } from "./builder"
import { goToSet, songCountFor, songLanguage, templateSet, type SetSong } from "./template"

// The real seed library, shaped like the app's data.
const vibe = Object.fromEntries(SEED_REPERTOIRE.families.map((f) => [f.name, f.vibe]))
const songs: SetSong[] = SEED_REPERTOIRE.songs.map((s, i) => ({
  id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  title: s.title,
  artist: s.artist,
  status: s.status,
  difficulty: s.difficulty,
  style: s.style,
  family_id: s.family,
  family_name: s.family,
  family_vibe: s.family ? vibe[s.family] : null,
}))
const byId = new Map(songs.map((s) => [s.id, s]))
const titles = (ids: string[]) => ids.map((id) => byId.get(id)!.title)

describe("goToSet", () => {
  it("follows the handoff: opener, Em-D-C medley, switch, showpiece, sing-along closer", () => {
    const set = titles(goToSet(songs).song_ids)
    expect(set[0]).toBe("Stand by Me")
    expect(set.at(-1)).toBe("Yaaron")
    expect(set).toContain("Wonderful Tonight")
    expect(set).toContain("Perfect")
    const medley = set.slice(1, 4)
    for (const t of medley) expect(byId.get(goToSet(songs).song_ids[set.indexOf(t)])!.family_name).toBe("Em-D-C")
  })

  it("skips songs you cannot play yet", () => {
    const withoutYaaron = songs.map((s) => (s.title === "Yaaron" ? { ...s, status: "learning" } : s))
    expect(titles(goToSet(withoutYaaron).song_ids).at(-1)).toBe("Ek Ajnabee Haseena Se")
  })
})

describe("templateSet", () => {
  it.each([10, 20, 30, 45, 60])("fits about %i minutes with playable songs only, no repeats", (minutes) => {
    const set = templateSet(songs, { room: "friends", mix: "mixed", minutes })
    expect(set.song_ids.length).toBeLessThanOrEqual(songCountFor(minutes))
    expect(set.song_ids.length).toBeGreaterThanOrEqual(3)
    expect(new Set(set.song_ids).size).toBe(set.song_ids.length)
    for (const id of set.song_ids) expect(["can_play", "polished"]).toContain(byId.get(id)!.status)
  })

  it("keeps a Hindi set Hindi", () => {
    const set = templateSet(songs, { room: "family dinner", mix: "hindi", minutes: 30 })
    for (const id of set.song_ids) expect(songLanguage(byId.get(id)!)).not.toBe("english")
  })

  it("knows the language of each song, not just its family", () => {
    const lang = (t: string) => songLanguage(songs.find((s) => s.title === t)!)
    expect(lang("Mera Mann")).toBe("hindi") // in the English sing-along family
    expect(lang("O Sanam")).toBe("hindi")
    expect(lang("Mahi")).toBe("hindi") // no artist
    expect(lang("Perfect")).toBe("english")
    expect(lang("Stay")).toBe(null)
  })

  it("keeps an English set English", () => {
    const set = templateSet(songs, { room: "office party", mix: "english", minutes: 20 })
    for (const id of set.song_ids) expect(songLanguage(byId.get(id)!)).not.toBe("hindi")
  })

  it("ends on a sing-along and has at most one hard song", () => {
    const set = templateSet(songs, { room: "anyone", mix: "mixed", minutes: 60 })
    expect(byId.get(set.song_ids.at(-1)!)!.family_vibe).toMatch(/sing-along/)
    expect(set.song_ids.filter((id) => byId.get(id)!.difficulty === "hard").length).toBeLessThanOrEqual(1)
  })

  it("keeps family songs next to each other", () => {
    const set = templateSet(songs, { room: "friends", mix: "hindi", minutes: 30 })
    const fams = set.song_ids.slice(1, -1).map((id) => byId.get(id)!.family_name)
    // Once a family ends, it does not come back later.
    const finished = new Set<string | null>()
    for (let i = 0; i < fams.length; i++) {
      if (i > 0 && fams[i] !== fams[i - 1]) finished.add(fams[i - 1])
      expect(finished.has(fams[i])).toBe(false)
    }
  })
})

describe("cleanSetProposal", () => {
  const req = { room: "x", mix: "mixed" as const, minutes: 20 }
  const id = (title: string) => songs.find((s) => s.title === title)!.id

  it("drops unknown, repeated and not-yet-playable songs", () => {
    const raw = {
      name: "Night — one",
      notes: "Fun.",
      song_ids: [id("Stand by Me"), "nope", id("Stand by Me"), id("Yellow"), id("Yaaron"), id("Perfect")],
    }
    const clean = cleanSetProposal(raw, songs, req)!
    expect(titles(clean.song_ids)).toEqual(["Stand by Me", "Yaaron", "Perfect"])
    expect(clean.name).toBe("Night, one")
  })

  it("allows only one hard song", () => {
    const raw = {
      name: "Show",
      notes: "",
      song_ids: [id("Perfect"), id("Slow Dancing in a Burning Room"), id("While My Guitar Gently Weeps"), id("Yaaron")],
    }
    expect(titles(cleanSetProposal(raw, songs, req)!.song_ids)).toEqual([
      "Perfect",
      "Slow Dancing in a Burning Room",
      "Yaaron",
    ])
  })

  it("rejects a set that is mostly made up", () => {
    expect(cleanSetProposal({ name: "x", notes: "", song_ids: ["a", "b", id("Perfect")] }, songs, req)).toBeNull()
  })
})

describe("buildSetProposal", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key"
  })

  it("uses a valid AI set", async () => {
    const pick = songs.filter((s) => s.status === "can_play").slice(0, 5).map((s) => s.id)
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ name: "Chai night", song_ids: pick, notes: "Easy start." }) } }] }),
        ),
    )
    const res = await buildSetProposal(songs, { room: "friends", mix: "mixed", minutes: 20 }, fetchImpl)
    expect(res.source).toBe("ai")
    expect(res.proposal.song_ids).toEqual(pick)
  })

  it("falls back to the built-in builder when the AI fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 503 }))
    const res = await buildSetProposal(songs, { room: "friends", mix: "hindi", minutes: 20 }, fetchImpl)
    expect(res.source).toBe("template")
    expect(res.proposal.song_ids.length).toBeGreaterThanOrEqual(3)
  })

  it("only offers the AI songs you can play", () => {
    const msg = JSON.parse(buildSetMessage(songs, { room: "x", mix: "mixed", minutes: 20 }))
    expect(msg.songs.every((s: { id: string }) => ["can_play", "polished"].includes(byId.get(s.id)!.status))).toBe(true)
    expect(msg.target_song_count).toBe(5)
  })
})
