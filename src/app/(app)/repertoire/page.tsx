import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import { RepertoireView } from "./repertoire-view"

export const metadata = { title: "Songs" }

export default function RepertoirePage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Repertoire />
      </Suspense>
    </main>
  )
}

async function Repertoire() {
  await requireUser()
  const supabase = await createClient()
  const [families, songs] = await Promise.all([
    supabase.from("families").select("*").order("created_at").order("name"),
    supabase.from("songs").select("*").order("title"),
  ])

  const error = families.error ?? songs.error
  if (error) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your songs: {error.message}
      </p>
    )
  }

  return <RepertoireView families={families.data ?? []} songs={songs.data ?? []} today={todayISO()} />
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-14 animate-pulse rounded-2xl bg-surface" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface" />
      ))}
    </div>
  )
}
