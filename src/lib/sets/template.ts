// Set building without AI: the fallback builder and the default "Go-to set".

export const LANGUAGE_MIXES = ["hindi", "mixed", "english"] as const
export type LanguageMix = (typeof LANGUAGE_MIXES)[number]

export const SET_MINUTES = [10, 20, 30, 45, 60] as const

/** Rough length of one song in a casual set, in minutes. */
export const MINUTES_PER_SONG = 4

export type SetSong = {
  id: string
  title: string
  artist: string | null
  status: string
  difficulty: string | null
  style: string | null
  family_id: string | null
  family_name: string | null
  family_vibe: string | null
}

export type SetRequest = { room: string; mix: LanguageMix; minutes: number }
export type SetProposal = { name: string; song_ids: string[]; notes: string }

export const songCountFor = (minutes: number) =>
  Math.min(15, Math.max(3, Math.round(minutes / MINUTES_PER_SONG)))

/** Only songs you can actually play go into a set. */
export const playable = (songs: SetSong[]) =>
  songs.filter((s) => s.status === "can_play" || s.status === "polished")

// Singers whose songs in this library are Hindi / Urdu / Punjabi.
const HINDI_ARTISTS =
  /\b(arijit|kk|atif|ayushmann|lucky ali|kishore|rafi|asha|sonu nigam|mustafa zahid|ankit tiwari|javed ali|harshit|kunal ganjawala|rahat|bombay jayashri|rahman|shaan|kailash|lehmber|vishal mishra|palak)\b/i

// Common Hindi words in romanised titles.
const HINDI_TITLE_WORDS =
  /\b(hai|hain|tera|tere|teri|mera|meri|mere|mann|dil|ki|ke|ka|naa?|main|tu|tum|ho|se|ko|ek|pal|kuch|toh|phir|aao|abhi|jao|chhod|aankhen|gali|rang|lamhe|sona|khuda|zara|haal|bhula|saajana|sanam|yaaron|laree|chhoote|mahi|labon|gulabi|chura|liya|khairiyat|phirta|rahoon|bheege|honth|lagan|roobaroo|sifarish|chand|haseena|ajnabee|rishta|shab|haqeeqat|beete|pehle|bhi|jaunga|din|paas|kar)\b/i

/**
 * A song's language: from the singer, then Hindi words in the title, then the
 * family vibe. (A family's vibe is not enough: Mera Mann sits in an English family.)
 */
export function songLanguage(song: SetSong): "hindi" | "english" | null {
  if (song.artist && HINDI_ARTISTS.test(song.artist)) return "hindi"
  if (HINDI_TITLE_WORDS.test(song.title)) return "hindi"
  if (song.artist) return "english"
  const v = song.family_vibe ?? ""
  if (/hindi|bollywood/i.test(v)) return "hindi"
  if (/english|pop|folk|rock/i.test(v)) return "english"
  return null
}

const isSingAlong = (s: SetSong) => /sing-along/i.test(s.family_vibe ?? "")
const DIFF_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 }
const diff = (s: SetSong) => DIFF_RANK[s.difficulty ?? "medium"] ?? 1

function langScore(song: SetSong, mix: LanguageMix): number {
  if (mix === "mixed") return 1
  const lang = songLanguage(song)
  if (lang === null) return 1
  return lang === mix ? 2 : 0
}

/**
 * A sensible set without AI:
 * opener (easy sing-along in the right language), family medleys,
 * at most one hard song near the end, and a sing-along to close.
 */
export function templateSet(songs: SetSong[], req: SetRequest): SetProposal {
  const count = songCountFor(req.minutes)
  const pool = playable(songs)
  const used = new Set<string>()
  const order: SetSong[] = []
  const take = (s: SetSong | undefined) => {
    if (s && !used.has(s.id)) {
      used.add(s.id)
      order.push(s)
    }
  }

  const byFit = (a: SetSong, b: SetSong) =>
    langScore(b, req.mix) - langScore(a, req.mix) ||
    Number(isSingAlong(b)) - Number(isSingAlong(a)) ||
    diff(a) - diff(b) ||
    a.title.localeCompare(b.title)

  // 1. Opener
  take([...pool].filter((s) => diff(s) < 2).sort(byFit)[0])

  // 2. Closer, chosen now so the medleys do not use it up.
  const closer = [...pool]
    .filter((s) => !used.has(s.id) && diff(s) < 2 && isSingAlong(s))
    .sort(byFit)[0]
  if (closer) used.add(closer.id)

  // 3. Family medleys, best-matching families first, easier songs first.
  const families = new Map<string, SetSong[]>()
  for (const s of pool) {
    if (!s.family_id || used.has(s.id)) continue
    families.set(s.family_id, [...(families.get(s.family_id) ?? []), s])
  }
  // Families with the most songs in the requested language go first.
  const fit = (list: SetSong[]) => list.filter((s) => langScore(s, req.mix) === 2).length
  const familyOrder = [...families.values()].sort((a, b) => fit(b) - fit(a) || b.length - a.length)

  let hardUsed = false
  const middleSlots = count - (closer ? 2 : 1)
  for (const list of familyOrder) {
    const medley = list
      .filter((s) => diff(s) < 2 && langScore(s, req.mix) > 0)
      .sort((a, b) => diff(a) - diff(b) || a.title.localeCompare(b.title))
      .slice(0, 4)
    for (const s of medley) {
      if (order.length - 1 >= middleSlots) break
      take(s)
    }
    if (order.length - 1 >= middleSlots) break
  }

  // 4. Fill any gap with other fitting songs (unassigned ones too).
  for (const s of [...pool].sort(byFit)) {
    if (order.length - 1 >= middleSlots) break
    if (used.has(s.id) || langScore(s, req.mix) === 0) continue
    if (diff(s) === 2) {
      if (hardUsed) continue
      hardUsed = true
    }
    take(s)
  }

  if (closer) order.push(closer)

  const label = req.mix === "hindi" ? "Hindi" : req.mix === "english" ? "English" : "Mixed"
  return {
    name: `${label} set, ${req.minutes} min`,
    song_ids: order.map((s) => s.id),
    notes: closer
      ? `Opens with ${order[0]?.title}, runs family medleys so the changes stay easy, and ends on ${closer.title} so everyone sings.`
      : `Opens with ${order[0]?.title} and runs family medleys so the changes stay easy.`,
  }
}

/**
 * The default "Go-to set" from the handoff: opener Stand by Me (or Pani Da Rang),
 * an Em-D-C family medley, a switch to English, an optional showpiece
 * (Wonderful Tonight), and a sing-along closer (Yaaron or Ek Ajnabee Haseena Se).
 * Uses only songs you can play; anything missing is skipped.
 */
export function goToSet(songs: SetSong[]): SetProposal {
  const pool = playable(songs)
  const find = (title: string) => pool.find((s) => s.title.toLowerCase() === title.toLowerCase())
  const firstOf = (...titles: string[]) => titles.map(find).find(Boolean)

  const opener = firstOf("Stand by Me", "Pani Da Rang")
  const closer = firstOf("Yaaron", "Ek Ajnabee Haseena Se")
  const medley = pool
    .filter((s) => s.family_name === "Em-D-C" && s.id !== opener?.id && diff(s) === 0)
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 3)
  const switchSong = firstOf("Perfect", "Photograph", "Hero")
  const showpiece = find("Wonderful Tonight")

  const ids = [opener, ...medley, switchSong, showpiece, closer]
    .filter((s): s is SetSong => Boolean(s))
    .map((s) => s.id)

  return {
    name: "Go-to set",
    song_ids: [...new Set(ids)],
    notes: "Well-known opener, an Em-D-C medley, a switch to English, one showpiece, and a sing-along to finish.",
  }
}
