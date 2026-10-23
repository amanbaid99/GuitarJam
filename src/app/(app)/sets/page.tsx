import { Suspense } from "react"
import { getSetsData } from "@/lib/data"
import { GroupsView } from "./groups-view"
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
  const data = await getSetsData()
  if (!data.ok) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your sets: {data.error}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-8">
      <GroupsView groups={data.groups} other={data.other} waiting={data.waiting} />
      <SetsView sets={data.sets} songs={data.songs} />
    </div>
  )
}
