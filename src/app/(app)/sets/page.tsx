import { Suspense } from "react"
import { getSetsData } from "@/lib/data"
import { SetsView } from "./sets-view"

export const metadata = { title: "Sets" }

// Free AI models can be slow: give set building up to 2 minutes.
export const maxDuration = 120

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
  const data = await getSetsData()
  if (!data.ok) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your sets: {data.error}
      </p>
    )
  }
  return <SetsView sets={data.sets} songs={data.songs} />
}
