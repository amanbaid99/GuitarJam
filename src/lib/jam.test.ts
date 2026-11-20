import { expect, test } from "vitest"
import { jamQueue, type JamSong } from "./jam"

const makeSong = (id: string, fields: Partial<JamSong> = {}): JamSong => ({
  id, title: id, language: "hindi", capo: 0, chords: "G D C", status: "can_play", ...fields,
})

test("language jams restrict the queue to songs you know and respect eligible pinned openers", () => {
  const songs = [
    makeSong("A", { status: "learning" }),
    makeSong("B", { language: "english" }),
    makeSong("C"),
    makeSong("D", { status: "polished" }),
  ]
  expect(jamQueue(songs, "hindi", "C").map((song) => song.id)).toEqual(["C", "D"])
  expect(jamQueue(songs, "hindi", "B").map((song) => song.id)).toEqual(["D", "C"])
})

test("mixed jams include untagged songs and prefer a shared capo before chord overlap", () => {
  const songs = [
    makeSong("A", { status: "polished" }),
    makeSong("B", { capo: 2 }),
    makeSong("C", { language: null, chords: "A D E" }),
  ]
  expect(jamQueue(songs, "mixed").map((song) => song.id)).toEqual(["A", "C", "B"])
})
