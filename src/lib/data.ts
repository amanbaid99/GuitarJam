import "server-only"
import { cacheLife } from "next/cache"
import { requireUser } from "@/lib/auth"
import { withoutLeftoverGroups } from "@/lib/groups-server"
import { loadSetSongs } from "@/lib/sets/load"
import { createClient } from "@/lib/supabase/server"

/**
 * Data for the main tabs, cached in your browser only ("use cache: private":
 * never stored on the server, never shared between people).
 *
 * Why: a stale time of 5 minutes or more lets Next.js load each tab's content
 * in the background while the tab bar is on screen, so switching tabs shows
 * your songs at once instead of waiting on the server.
 *
 * Any change you save calls refresh(), which clears this cache straight away,
 * so you never see old data after an edit.
 */
const TAB_CACHE = { stale: 600, revalidate: 600, expire: 3600 }

export async function getLibrary() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  const user = await requireUser()
  const supabase = await createClient()
  const [families, songs] = await Promise.all([
    supabase.from("families").select("*").order("position").order("created_at"),
    supabase.from("songs").select("*").order("title"),
  ])
  const error = families.error ?? songs.error
  if (error) return { ok: false, error: error.message } as const
  const groups = await withoutLeftoverGroups(supabase, families.data ?? [], songs.data ?? [])
  return { ok: true, role: user.role, families: groups, songs: songs.data ?? [] } as const
}

export type GroupSong = {
  id: string
  title: string
  artist: string | null
  status: string
  key_capo: string | null
  chords: string | null
  family_id: string | null
  group_position: number | null
}

export async function getSetsData() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  await requireUser()
  const supabase = await createClient()
  const [sets, songs, groups, rows] = await Promise.all([
    supabase.from("sets").select("id, name, room, notes, song_ids").order("created_at", { ascending: false }),
    loadSetSongs().then(
      (data) => ({ data, error: null }),
      (e: unknown) => ({ data: null, error: e instanceof Error ? e.message : "Could not load songs" }),
    ),
    supabase.from("families").select("id, name, key, vibe, position").order("position").order("created_at"),
    supabase
      .from("songs")
      .select("id, title, artist, status, key_capo, chords, family_id, group_position")
      .order("group_position", { nullsFirst: false })
      .order("title"),
  ])
  const error = sets.error?.message ?? songs.error ?? groups.error?.message ?? rows.error?.message
  if (error) return { ok: false, error } as const

  const all: GroupSong[] = rows.data ?? []
  const groupList = await withoutLeftoverGroups(supabase, groups.data ?? [], all)

  return {
    ok: true,
    sets: sets.data ?? [],
    songs: songs.data ?? [],
    groups: groupList.map((g) => ({ ...g, songs: all.filter((s) => s.family_id === g.id) })),
    other: all.filter((s) => !s.family_id && s.chords?.trim()),
    waiting: all.filter((s) => !s.family_id && !s.chords?.trim()),
  } as const
}

export async function getPracticeSongs() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("songs").select("id, title, chords").order("title")
  if (error) return { ok: false, error: error.message } as const
  return { ok: true, songs: data ?? [] } as const
}

export async function getAddSongData() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from("families").select("*").order("position").order("created_at")
  return { userId: user.id, families: data ?? [] }
}

export async function getAccount() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  const user = await requireUser()
  if (user.role !== "owner") return { email: user.email, role: user.role, members: null }
  const supabase = await createClient()
  const [requests, members] = await Promise.all([supabase.rpc("owner_requests"), supabase.rpc("owner_members")])
  return {
    email: user.email,
    role: user.role,
    members: {
      ready: !requests.error && !members.error,
      requests: requests.data ?? [],
      members: members.data ?? [],
    },
  }
}
