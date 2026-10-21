import { beforeEach, describe, expect, it, vi } from "vitest"
import { checkAgainstLegend, cleanImported, stripLyrics } from "./clean"
import { extractSongs } from "./extract"

const families = [
  { id: "f-emdc", name: "Em-D-C" },
  { id: "f-amgf", name: "Am-G-F" },
  { id: "f-gemcd", name: "G-Em-C-D" },
]

describe("stripLyrics", () => {
  it("keeps chord lines, labels and short notes", () => {
    const chart = "Intro: Am, F, G, Am\nChorus:\nAm G F Em\nBarre F\nCapo 3"
    expect(stripLyrics(chart)).toEqual({ text: chart, removed: false })
  })

  it("drops lines that are lyrics", () => {
    const res = stripLyrics("Verse: Em D C\nthis is a line of words that someone might sing\nChorus: C G Am F")
    expect(res.text).toBe("Verse: Em D C\nChorus: C G Am F")
    expect(res.removed).toBe(true)
  })

  it("keeps only chords when chords and many words share a line", () => {
    const res = stripLyrics("Verse: Em when the night is long and the road goes D on and on and on C")
    expect(res.text).toBe("Verse: Em D C")
    expect(res.removed).toBe(true)
  })
})

describe("cleanImported", () => {
  it("suggests a family from the chords and flags duplicates", () => {
    const songs = cleanImported(
      [
        { title: "Tum Se Hi", artist: "Mohit Chauhan", chords: "Am, G, F, G", key_capo: null },
        { title: "Yellow", artist: "Coldplay", chords: "G, Dsus4, Cadd9", key_capo: "Capo 4" },
      ],
      families,
      ["yellow"],
    )
    expect(songs[0]).toMatchObject({ family_id: "f-amgf", duplicate: false })
    expect(songs[1]).toMatchObject({ duplicate: true, key_capo: "Capo 4" })
  })

  it("removes repeats within one image, empty titles and dashes", () => {
    const songs = cleanImported(
      [
        { title: "Song \u2014 live", artist: null, chords: null, key_capo: null },
        { title: "song, live", artist: null, chords: null, key_capo: null },
        { title: "  ", artist: null, chords: null, key_capo: null },
      ],
      families,
      [],
    )
    expect(songs.map((s) => s.title)).toEqual(["Song, live"])
    expect(songs[0].family_id).toBeNull()
  })
})

describe("extractSongs", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key"
  })

  const reply = (content: string, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }))

  it("sends the image to the vision model and cleans the result", async () => {
    const fetchImpl = reply(
      JSON.stringify({
        songs: [
          { title: "Kun Faya Kun", artist: "A.R. Rahman", chords: "Em, D, C\nsome lyric words that go on and on", key_capo: null },
        ],
      }),
    )
    const res = await extractSongs("data:image/jpeg;base64,AAAA", families, [], fetchImpl)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.songs[0]).toMatchObject({ title: "Kun Faya Kun", chords: "Em, D, C", family_id: "f-emdc", lyricsRemoved: true })

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.model).toMatch(/nemotron.*vl.*:free/)
    expect(body.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } })
  })

  it("explains when nothing could be read", async () => {
    const res = await extractSongs("data:image/jpeg;base64,AAAA", families, [], reply(JSON.stringify({ songs: [] })))
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/No songs found/) })
  })

  it("explains when the AI is down", async () => {
    const res = await extractSongs("data:image/jpeg;base64,AAAA", families, [], reply("busy", 503))
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/unavailable/) })
  })

  it("explains when the key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY
    const res = await extractSongs("data:image/jpeg;base64,AAAA", families, [])
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/OPENROUTER_API_KEY/) })
  })
})

describe("chord box check", () => {
  const legend = ["Bm7", "Em7", "A7sus4", "D", "E7", "Gm11", "D/F#"]

  it("warns when the chords do not match the chord box (the Daughters mix-up)", () => {
    const wrong = "Intro: Cmaj7 G/B Am7 D7sus4\nChorus: Fmaj7 Cmaj7 G/B Am7"
    expect(checkAgainstLegend(wrong, legend)).toMatch(/do not match the chord list/)
  })

  it("stays quiet when the chords match", () => {
    expect(checkAgainstLegend("[Intro]\nBm7 Em7 A7sus4 D x2\nChorus:\nBm7 E7 A7sus4 D", legend)).toBeNull()
  })

  it("stays quiet when there is no chord box", () => {
    expect(checkAgainstLegend("Cmaj7 G/B Am7", [])).toBeNull()
  })

  it("flags it on the imported song", () => {
    const [song] = cleanImported(
      [{ title: "Daughters", artist: "John Mayer", chords: "Cmaj7 G/B Am7 D7sus4", key_capo: null, chord_legend: legend }],
      [],
      [],
    )
    expect(song.warning).toMatch(/misread/)
  })
})

describe("extractSongs with slices", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key"
  })

  it("sends every slice, in order, and says they are one screenshot", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ songs: [{ title: "Daughters", artist: "John Mayer", chords: "Bm7 Em7 A7sus4 D", key_capo: null, chord_legend: ["Bm7", "Em7", "A7sus4", "D"] }] }) } }] })),
    )
    const res = await extractSongs(["data:image/jpeg;base64,A", "data:image/jpeg;base64,B", "data:image/jpeg;base64,C"], [], [], fetchImpl)
    expect(res.ok && res.songs[0].warning).toBe(null)
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    const parts = body.messages[1].content
    expect(parts[0].text).toMatch(/3 images.*one long screenshot/)
    expect(parts.slice(1).map((p: { image_url: { url: string } }) => p.image_url.url.slice(-1))).toEqual(["A", "B", "C"])
    expect(body.temperature).toBe(0)
  })
})
