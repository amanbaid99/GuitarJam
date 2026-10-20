import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { loadSetSongs } from "@/lib/sets/load"
import { createClient } from "@/lib/supabase/server"
import { SetsView } from "./sets-view"

export const metadata = { title: "Sets" }

export default function SetsPage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Sets</h1>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <Sets />
      </Suspense>
    </main>
  )
}

async function Sets() {
  await requireUser()
  const supabase = await createClient()
  const [sets, songs] = await Promise.all([
    supabase.from("sets").select("id, name, room, notes, song_ids").order("created_at", { ascending: false }),
    loadSetSongs(),
  ])
  if (sets.error) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your sets: {sets.error.message}
      </p>
    )
  }
  return <SetsView sets={sets.data ?? []} songs={songs} />
}
