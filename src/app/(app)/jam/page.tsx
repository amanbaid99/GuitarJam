import { Suspense } from "react"
import { getLibrary } from "@/lib/data"
import { isJamReady } from "@/lib/jam"
import { toDeckSong } from "../../perform/load"
import { Jam } from "./jam"

export const metadata = { title: "Start a jam" }

export default function JamPage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Start a jam</h1>
      <Suspense fallback={<p className="card text-muted">Loading your songs…</p>}>
        <JamLibrary />
      </Suspense>
    </main>
  )
}

async function JamLibrary() {
  const library = await getLibrary()
  if (!library.ok) return <p className="card text-danger" role="alert">Could not load your songs. Try again.</p>
  const families = new Map(library.families.map((family) => [family.id, family]))
  const songs = library.songs.filter(isJamReady).map((song) => ({
    ...toDeckSong(song, families.get(song.family_id ?? "") ?? null),
    language: song.language,
    status: song.status,
  }))
  return <Jam songs={songs} accountId={library.userId} />
}
