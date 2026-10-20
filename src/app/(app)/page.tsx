import Link from "next/link"
import { Suspense } from "react"
import { signOut } from "@/app/login/actions"
import { requireUser } from "@/lib/auth"
import { startOfWeekISO } from "@/lib/dates"
import { WEEKLY_SESSION_TARGET } from "@/lib/domain"
import { createClient } from "@/lib/supabase/server"
import { SeedButton } from "./seed-button"

export const metadata = { title: "Today" }

export default function TodayPage() {
  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path
              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </header>
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <Summary />
      </Suspense>
    </main>
  )
}

async function Summary() {
  const user = await requireUser()
  const supabase = await createClient()

  const [songs, families, week] = await Promise.all([
    supabase.from("songs").select("status"),
    supabase.from("families").select("id", { count: "exact", head: true }),
    supabase.from("sessions").select("minutes").gte("date", startOfWeekISO()),
  ])

  const error = songs.error ?? families.error ?? week.error
  if (error) {
    return (
      <div className="card text-danger" role="alert">
        Could not load your data: {error.message}
      </div>
    )
  }

  const songRows = songs.data ?? []
  const sessionsThisWeek = week.data?.length ?? 0
  const minutesThisWeek = (week.data ?? []).reduce((sum, s) => sum + s.minutes, 0)
  const canPlay = songRows.filter((s) => s.status === "can_play" || s.status === "polished").length

  return (
    <>
      <section className="card grid grid-cols-2 gap-4">
        <Stat label="Sessions this week" value={`${sessionsThisWeek} / ${WEEKLY_SESSION_TARGET}`} />
        <Stat label="Minutes this week" value={String(minutesThisWeek)} />
      </section>

      {songRows.length === 0 ? (
        <section className="card flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Your library is empty</h2>
            <p className="mt-1 text-muted">
              Load the songs, chord families and skills you brought over from Notion. You only
              need to do this once.
            </p>
          </div>
          <SeedButton />
        </section>
      ) : (
        <section className="card">
          <h2 className="text-xl font-semibold">Library</h2>
          <p className="mt-1 text-muted">
            {songRows.length} songs in {families.count ?? 0} families. {canPlay} ready to play.
          </p>
        </section>
      )}

      <section className="card flex flex-col gap-2 text-muted">
        <p className="text-sm">Practice planner and metronome arrive in step 5.</p>
      </section>

      <form action={signOut} className="flex items-center justify-between gap-3 pt-2">
        <span className="truncate text-sm text-muted">Signed in as {user.email}</span>
        <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
          Sign out
        </button>
      </form>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  )
}
