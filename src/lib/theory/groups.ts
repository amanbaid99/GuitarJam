import { findChords, triadKey } from "./chords"
import { parseKey } from "./keys"
import { mod12 } from "./notes"

/**
 * Groups are songs you can play with the same chord shapes, so they flow as
 * one set. A group is defined by its key (the shapes, capo not counted):
 * "G" holds G, Am, Bm, C, D, Em (and the Em-D-C minor songs).
 *
 * A song fits a group when most of its chords belong to that key. A few
 * common outside chords count for part: II major (A in G), III major
 * (B in G, the E in Am songs) and bVII major (F in G, C in D).
 */
export type GroupLike = { id: string; key: string }

export type GroupSuggestion = {
  groupId: string
  /** 0..1: how well the song's chords fit the group's key. */
  fit: number
  /** Distinct chords in the song. */
  total: number
  /** Chord names from the song that are outside the key. */
  outside: string[]
}

const IN_KEY: [number, string][] = [
  [0, ""], [2, "m"], [4, "m"], [5, ""], [7, ""], [9, "m"], [11, "dim"],
]
const NEAR_KEY: [number, string][] = [
  [2, ""], [4, ""], [10, ""],
]
const NEAR_WEIGHT = 0.75
export const MIN_FIT = 0.8

function majorTonic(key: string): number | null {
  const k = parseKey(key)
  if (!k) return null
  return k.minor ? mod12(k.tonic + 3) : k.tonic
}

/** How well a set of chords fits a key. Pure, so it can be tested. */
export function keyFit(chart: string, key: string): { fit: number; strict: number; total: number; outside: string[] } | null {
  const tonic = majorTonic(key)
  if (tonic === null) return null
  const seen = new Map<string, string>() // triad -> first name as written
  for (const f of findChords(chart)) {
    const t = triadKey(f.chord)
    if (!seen.has(t)) seen.set(t, f.text)
  }
  if (seen.size === 0) return null
  const inKey = new Set(IN_KEY.map(([s, q]) => `${mod12(tonic + s)}${q}`))
  const nearKey = new Set(NEAR_KEY.map(([s, q]) => `${mod12(tonic + s)}${q}`))
  let score = 0
  let strict = 0
  const outside: string[] = []
  for (const [t, name] of seen) {
    if (inKey.has(t)) {
      score += 1
      strict += 1
    } else if (nearKey.has(t)) {
      score += NEAR_WEIGHT
      outside.push(name)
    } else outside.push(name)
  }
  return { fit: score / seen.size, strict, total: seen.size, outside }
}

/**
 * The group a song belongs in, or null for "Other". Needs at least two
 * chords and a fit of MIN_FIT. Ties go to more chords strictly in key, then
 * to the group whose home chord (G or Em for "G") the song starts on.
 */
export function suggestGroup(chart: string, groups: GroupLike[]): GroupSuggestion | null {
  const first = findChords(chart)[0]
  let best: (GroupSuggestion & { strict: number; startsHome: boolean }) | null = null
  for (const g of groups) {
    const r = keyFit(chart, g.key)
    const tonic = majorTonic(g.key)
    if (!r || tonic === null || r.total < 2 || r.fit < MIN_FIT) continue
    const home = new Set([`${tonic}`, `${mod12(tonic + 9)}m`])
    const startsHome = first ? home.has(triadKey(first.chord)) : false
    const better =
      !best ||
      r.fit > best.fit ||
      (r.fit === best.fit && r.strict > best.strict) ||
      (r.fit === best.fit && r.strict === best.strict && startsHome && !best.startsHome)
    if (better) best = { groupId: g.id, fit: r.fit, total: r.total, outside: r.outside, strict: r.strict, startsHome }
  }
  if (!best) return null
  return { groupId: best.groupId, fit: best.fit, total: best.total, outside: best.outside }
}

/** "All 4 chords fit" / "5 of 6 chords fit (A is outside)". For the confirm step. */
export function fitReason(s: GroupSuggestion): string {
  const fitting = s.total - s.outside.length
  if (s.outside.length === 0) return `All ${s.total} chords fit`
  const out = s.outside.join(", ")
  return `${fitting} of ${s.total} chords fit (${out} ${s.outside.length === 1 ? "is" : "are"} outside)`
}
