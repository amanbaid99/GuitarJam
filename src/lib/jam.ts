import { extractChords } from "@/lib/theory"
import type { SongLanguage } from "@/lib/song-languages"

export type JamMode = SongLanguage | "mixed"
export type JamSong = {
  id: string
  title: string
  chords: string | null
  capo: number
  language: SongLanguage | null
  status: string
}

export function isJamReady(song: { status: string }) {
  return song.status === "can_play" || song.status === "polished"
}

/** Pick a familiar opener, then prefer fewer capo moves and more shared shapes. */
export function jamQueue<T extends JamSong>(songs: T[], mode: JamMode, opener?: string) {
  const remaining = songs.filter((song) => isJamReady(song) && (mode === "mixed" || song.language === mode))
    .map((song) => ({ song, shapes: new Set(extractChords(song.chords ?? "")) }))
  const byReadiness = (a: T, b: T) =>
    Number(b.status === "polished") - Number(a.status === "polished") || a.title.localeCompare(b.title)
  remaining.sort((a, b) => byReadiness(a.song, b.song))
  const pinned = remaining.findIndex(({ song }) => song.id === opener)
  const [first] = remaining.splice(pinned < 0 ? 0 : pinned, 1)
  if (!first) return []

  const queue = [first.song]
  let previous = first
  const overlap = (shapes: Set<string>) => [...shapes].filter((shape) => previous.shapes.has(shape)).length
  while (remaining.length && queue.length < 40) {
    const otherLanguage = mode === "mixed" && queue.length > 1 &&
      queue.at(-2)?.language === previous.song.language && previous.song.language
    remaining.sort((a, b) =>
      Number(b.song.capo === previous.song.capo) - Number(a.song.capo === previous.song.capo) ||
      (otherLanguage ? Number(b.song.language !== null && b.song.language !== otherLanguage) -
        Number(a.song.language !== null && a.song.language !== otherLanguage) : 0) ||
      overlap(b.shapes) - overlap(a.shapes) ||
      Math.abs(a.song.capo - previous.song.capo) - Math.abs(b.song.capo - previous.song.capo) ||
      byReadiness(a.song, b.song),
    )
    previous = remaining.shift()!
    queue.push(previous.song)
  }
  return queue
}
