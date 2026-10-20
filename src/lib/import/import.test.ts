import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanImported, stripLyrics } from "./clean"
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
