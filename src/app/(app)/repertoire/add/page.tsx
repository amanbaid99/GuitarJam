import { Suspense } from "react"
import { getAddSongData } from "@/lib/data"
import { AddSong } from "./add-song"

export const metadata = { title: "Add song" }

// Free AI models can be slow: give screenshot reading up to 2 minutes.
export const maxDuration = 120

export default function AddSongPage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Add song</h1>
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <Content />
      </Suspense>
    </main>
  )
}

async function Content() {
  const { userId, families } = await getAddSongData()
  return <AddSong userId={userId} families={families} />
}
