import { parseChord } from "@/lib/theory"

/**
 * Reads a chord sheet you copied from a chord site (Ultimate Guitar and the
 * like) and pasted in. No AI: chords are taken exactly as written.
 *
 * Handles the usual "chords on one line, words on the next" layout and turns
 * it into the app's inline format ("[G]I know a [Cadd9]girl"), so the chords
 * stay above the right words at any screen size.
 */

export type PastedSong = {
  title: string
  artist: string | null
  /** "Capo 3", or null for no capo. */
  key_capo: string | null
  /** Short chord summary by section, for the song card and the set builder. */
  chords: string | null
  /** Inline ChordPro lyrics, or null if there were no words. */
  lyrics: string | null
  /** Every distinct chord found, in order. */
  chordNames: string[]
  /** Lines with words (so the screen can say "lyrics found"). */
  lyricLines: number
}

const SECTION_WORDS =
  "intro|verse|pre[- ]?chorus|chorus|post[- ]?chorus|bridge|outro|solo|interlude|instrumental|hook|refrain|coda|ending|break|riff|tag|middle 8"
const SECTION_LINE = new RegExp(`^\\[?\\s*((?:${SECTION_WORDS})(?:[ \\-]*\\d{0,2})?(?:\\s*\\(?x?\\d\\)?)?)\\s*\\]?\\s*:?\\s*(.*)$`, "i")
const BRACKET_HEADING = /^\[([^\]]{1,30})\]\s*(.*)$/

// Tokens allowed on a chord line besides chords: bar lines, repeats, "N.C.".
const FILLER = /^(\||\|\||-+|\/|%|\*|x\d{1,2}|\d{1,2}x|\(x?\d{1,2}x?\)|n\.?c\.?|\(|\)|\.\.\.?|→|>)$/i

// Page clutter that comes along when you copy a whole page.
const JUNK = [
  /^(tuning|difficulty|author|strumming|rating|views?|favorites?|tabbed by|transcribed by|chords? used)\b/i,
  /^\d[\d,.]*\s+(views|favorites|ratings?)/i,
  /^(print|report bad tab|edit|add to playlist|autoscroll|font|transpose|simplify|share|download pdf)\b/i,
  /^[eBGDAE]\s*\|[-\d|hpbrx/\\~^ ().]+$/, // tab staves (not supported in the inline format)
]
// Copying past the song picks up the page footer: stop there.
const STOP = /^(last update|please rate|rate this tab|welcome offer|x\s*$|related tabs|comments?\b|\d+\s+comments)/i

type Token = { text: string; col: number }

function tokens(line: string): Token[] {
  return [...line.matchAll(/\S+/g)].map((m) => ({ text: m[0], col: m.index ?? 0 }))
}

/** The chord name in a token, without wrapping punctuation: "(G)" -> "G", "[Am]" -> "Am". */
function chordOf(token: string): string | null {
  const bare = token.replace(/^[([{|]+|[)\]}|,.]+$/g, "")
  return bare && parseChord(bare) ? bare : null
}

/** A line made only of chords (plus bar lines and repeat marks). */
function chordLine(line: string): Token[] | null {
  const toks = tokens(line)
  const chords: Token[] = []
  for (const t of toks) {
    const c = chordOf(t.text)
    if (c) chords.push({ text: c, col: t.col + t.text.indexOf(c) })
    else if (!FILLER.test(t.text)) return null
  }
  return chords.length ? chords : null
}

/** "[Verse 1]", "Chorus:", "Intro: G D Em C" -> heading (and any chords after it). */
function heading(line: string): { name: string; rest: string } | null {
  const t = line.trim()
  const b = BRACKET_HEADING.exec(t)
  if (b && !parseChord(b[1].trim())) return { name: tidyName(b[1]), rest: b[2] }
  const s = SECTION_LINE.exec(t)
  if (s && (s[2] === "" || chordLine(s[2]))) return { name: tidyName(s[1]), rest: s[2] }
  return null
}

function tidyName(name: string): string {
  const n = name.replace(/[[\]:]/g, "").replace(/\s+/g, " ").trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** Puts each chord into the words at its column: "[G]I know a [Cadd9]girl". */
export function mergeChordsIntoWords(chords: Token[], words: string): string {
  // Drop indentation shared by both lines, so columns still match.
  const lead = Math.min(words.length - words.trimStart().length, ...chords.map((c) => c.col))
  const text = words.slice(lead).trimEnd()
  // A chord over a gap belongs to the next word.
  const snap = (col: number) => {
    while (col < text.length && text[col] === " ") col++
    return col
  }
  const placed = chords.map((c) => ({ ...c, col: snap(c.col - lead) }))
  const inside = placed.filter((c) => c.col < text.length).sort((x, y) => y.col - x.col)
  const after = placed.filter((c) => c.col >= text.length).sort((x, y) => x.col - y.col)
  let out = text
  // Right to left, so earlier columns stay valid while inserting.
  for (const c of inside) out = `${out.slice(0, c.col)}[${c.text}]${out.slice(c.col)}`
  for (const c of after) out += ` [${c.text}]`
  return out
}

function readMeta(line: string, meta: { title?: string; artist?: string; capo?: number }) {
  const t = line.trim()
  const byLine = /^(.+?)\s+(?:chords?|tabs?|ukulele chords|chords?\s*(?:&|and)\s*lyrics)\s+(?:by|-)\s+(.+)$/i.exec(t)
  if (byLine && !meta.title) {
    meta.title = byLine[1].trim()
    meta.artist = byLine[2].trim()
    return true
  }
  const capo = /^capo\s*(?:on|at)?\s*[:\-]?\s*(?:(\d{1,2})(?:st|nd|rd|th)?(?:\s*fret)?|(no capo|none|0))\b/i.exec(t)
  if (capo) {
    meta.capo = capo[1] ? Number(capo[1]) : 0
    return true
  }
  if (/^key\s*[:\-]/i.test(t)) return true
  return false
}

const ARTIST_DASH_TITLE = /^(.{1,80}?)\s+[-–]\s+(.{1,120})$/

export function parsePastedSheet(input: string): PastedSong {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))

  const meta: { title?: string; artist?: string; capo?: number } = {}
  let firstPlain: string | null = null

  // The song starts at the first section heading or chord line; above it are title and details.
  const found = [lines.findIndex((l) => heading(l)), lines.findIndex((l) => chordLine(l))].filter((i) => i >= 0)
  const start = found.length ? Math.min(...found) : lines.length

  for (const l of lines.slice(0, start)) {
    if (!l.trim() || readMeta(l, meta) || JUNK.some((j) => j.test(l.trim()))) continue
    firstPlain ??= l.trim()
  }

  const out: string[] = []
  const summary: { name: string; lines: string[] }[] = []
  const names: string[] = []
  const seen = new Set<string>()
  let lyricLines = 0
  let section: { name: string; lines: string[] } | null = null

  const note = (chords: Token[]) => {
    for (const c of chords) {
      if (!seen.has(c.text)) {
        seen.add(c.text)
        names.push(c.text)
      }
    }
    const row = chords.map((c) => c.text).join(" ")
    if (!section) {
      section = { name: "", lines: [] }
      summary.push(section)
    }
    if (section.lines.at(-1) !== row) section.lines.push(row)
  }

  const body = lines.slice(start)
  for (let i = 0; i < body.length; i++) {
    const line = body[i]
    const t = line.trim()
    if (!t) {
      if (out.length && out.at(-1) !== "") out.push("")
      continue
    }
    if (STOP.test(t)) break
    if (readMeta(line, meta) || JUNK.some((j) => j.test(t))) continue

    const h = heading(line)
    if (h) {
      if (out.length && out.at(-1) !== "") out.push("")
      out.push(`[${h.name}]`)
      section = { name: h.name, lines: [] }
      summary.push(section)
      const rest = h.rest ? chordLine(h.rest) : null
      if (rest) {
        out.push(rest.map((c) => `[${c.text}]`).join(" "))
        note(rest)
      }
      continue
    }

    const chords = chordLine(line)
    if (chords) {
      note(chords)
      const next = body[i + 1]
      const nextIsWords = next !== undefined && next.trim() !== "" && !chordLine(next) && !heading(next) && !STOP.test(next.trim()) && !JUNK.some((j) => j.test(next.trim()))
      if (nextIsWords) {
        out.push(mergeChordsIntoWords(chords, next))
        lyricLines++
        i++
      } else {
        out.push(chords.map((c) => `[${c.text}]`).join(" "))
      }
      continue
    }

    // Words with no chords above them (or chords already inline: "[G]word").
    out.push(t)
    if (/[a-z]{2}/i.test(t.replace(/\[[^\]]*\]/g, ""))) lyricLines++
    const inline = [...t.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter((c) => parseChord(c))
    if (inline.length) note(inline.map((c) => ({ text: c, col: 0 })))
  }
  while (out.at(-1) === "") out.pop()

  // Title: "Song chords by Artist", else "Artist - Song", else the first plain line.
  let title = meta.title ?? ""
  let artist = meta.artist ?? null
  if (!title && firstPlain) {
    const dash = ARTIST_DASH_TITLE.exec(firstPlain)
    if (dash) {
      artist = dash[1].trim()
      title = dash[2].trim()
    } else title = firstPlain
  }

  const chordsSummary = summary
    .filter((s) => s.lines.length)
    // A repeated chorus with the same chords only needs listing once.
    .filter((s, i, all) => all.findIndex((o) => o.name === s.name && o.lines.join("|") === s.lines.join("|")) === i)
    .map((s) => (s.name ? `${s.name}: ${s.lines.join(" | ")}` : s.lines.join(" | ")))
    .join("\n")

  const capo = meta.capo ?? 0
  return {
    title: title.slice(0, 200),
    artist: artist ? artist.slice(0, 200) : null,
    key_capo: capo > 0 && capo <= 12 ? `Capo ${capo}` : null,
    chords: chordsSummary ? chordsSummary.slice(0, 4000) : null,
    lyrics: out.length ? out.join("\n").slice(0, 20000) : null,
    chordNames: names,
    lyricLines,
  }
}
