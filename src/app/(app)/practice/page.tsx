import Link from "next/link"
import { Suspense } from "react"
import { getPracticeSongs } from "@/lib/data"
import { Planner } from "../_today/planner"

export const metadata = { title: "Practice" }

// Free AI models can be slow: give planning up to 2 minutes.
export const maxDuration = 120

export default function PracticePage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
      <Suspense fallback={<div className="card h-56 animate-pulse" />}>
        <Content />
      </Suspense>
    </main>
  )
}

async function Content() {
  const res = await getPracticeSongs()
  if (!res.ok) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your songs: {res.error}
      </p>
    )
  }
  const songs = res.songs
  if (!songs.length) {
    return (
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-semibold">No songs yet</h2>
        <p className="text-muted">Add a few songs first, then plan a practice session here.</p>
        <Link href="/repertoire/add" className="btn-primary">
          Add a song
        </Link>
      </section>
    )
  }
  return (
    <Planner
      songs={songs.map((s) => ({ id: s.id, title: s.title }))}
      chordsById={Object.fromEntries(songs.map((s) => [s.id, s.chords]))}
    />
  )
}
