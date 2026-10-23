import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { SongDetail } from "./song-detail"

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
  const [song, families] = await Promise.all([
    supabase.from("songs").select("*").eq("id", id).maybeSingle(),
    supabase.from("families").select("*").order("position").order("created_at"),
  ])
  if (song.error || !song.data) notFound()

  return <SongDetail song={song.data} families={families.data ?? []} />
}
