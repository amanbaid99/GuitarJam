import "server-only"
import { cacheLife } from "next/cache"
import { requireUser } from "@/lib/auth"
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
    supabase.from("families").select("*").order("created_at").order("name"),
    supabase.from("songs").select("*").order("title"),
  ])
  const error = families.error ?? songs.error
  if (error) return { ok: false, error: error.message } as const
  return { ok: true, role: user.role, families: families.data ?? [], songs: songs.data ?? [] } as const
}

export async function getSetsData() {
  "use cache: private"
  cacheLife(TAB_CACHE)
  await requireUser()
  const supabase = await createClient()
  const [sets, songs] = await Promise.all([
    supabase.from("sets").select("id, name, room, notes, song_ids").order("created_at", { ascending: false }),
    loadSetSongs().then(
      (data) => ({ data, error: null }),
      (e: unknown) => ({ data: null, error: e instanceof Error ? e.message : "Could not load songs" }),
    ),
  ])
  if (sets.error || songs.error) return { ok: false, error: sets.error?.message ?? songs.error ?? "" } as const
  return { ok: true, sets: sets.data ?? [], songs: songs.data ?? [] } as const
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
  const { data } = await supabase.from("families").select("*").order("created_at").order("name")
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
