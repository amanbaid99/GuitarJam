import Link from "next/link"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AddSong } from "./add-song"

export const metadata = { title: "Add song" }

export default function AddSongPage() {
  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link
          href="/repertoire"
          aria-label="Back to Songs"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add song</h1>
      </header>
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <Content />
      </Suspense>
    </main>
  )
}

async function Content() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: families } = await supabase.from("families").select("*").order("created_at").order("name")
  return <AddSong userId={user.id} families={families ?? []} />
}
