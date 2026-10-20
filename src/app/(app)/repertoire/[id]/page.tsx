import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import { SongDetail, type Played } from "./song-detail"

export const metadata = { title: "Song" }

export default function SongPage({ params }: PageProps<"/repertoire/[id]">) {
  return (
    <main className="flex flex-col gap-4">
      <Link
        href="/repertoire"
        className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-muted"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Songs
      </Link>
      <Suspense fallback={<div className="card h-72 animate-pulse" />}>
        <Song params={params} />
      </Suspense>
    </main>
  )
}

async function Song({ params }: { params: PageProps<"/repertoire/[id]">["params"] }) {
  const { id } = await params
  await requireUser()
  const supabase = await createClient()
  const [song, families, history] = await Promise.all([
    supabase.from("songs").select("*").eq("id", id).maybeSingle(),
    supabase.from("families").select("*").order("created_at").order("name"),
    supabase.from("session_songs").select("sessions(date, minutes, how_it_went)").eq("song_id", id),
  ])
  if (song.error || !song.data) notFound()

  const played: Played[] = (history.data ?? [])
    .flatMap((row) => (row.sessions ? [row.sessions as unknown as Played] : []))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return <SongDetail song={song.data} families={families.data ?? []} history={played} today={todayISO()} />
}
