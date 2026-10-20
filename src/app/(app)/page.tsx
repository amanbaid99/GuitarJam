import Link from "next/link"
import { Suspense } from "react"
import { signOut } from "@/app/login/actions"
import { requireUser } from "@/lib/auth"
import { addDays, startOfWeekISO, todayISO } from "@/lib/dates"
import { WEEKLY_SESSION_TARGET } from "@/lib/domain"
import { createClient } from "@/lib/supabase/server"
import { MetronomePanel } from "./_today/metronome-panel"
import { Planner } from "./_today/planner"
import { SeedButton } from "./seed-button"

export const metadata = { title: "Today" }

// Free AI models can be slow: give planning up to 2 minutes.
export const maxDuration = 120

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
        <TodayContent />
      </Suspense>
      <MetronomePanel />
    </main>
  )
}

const FEEL: Record<string, string> = { rough: "Rough", ok: "OK", good: "Good", great: "Great" }

async function TodayContent() {
  const user = await requireUser()
  const supabase = await createClient()
  const today = todayISO()

  const [songs, families, skills, week, recent] = await Promise.all([
    supabase.from("songs").select("id, title, status, chords").order("title"),
    supabase.from("families").select("id", { count: "exact", head: true }),
    supabase.from("skills").select("name").eq("is_focus", true).limit(1),
    supabase.from("sessions").select("minutes").gte("date", startOfWeekISO()),
    supabase
      .from("sessions")
      .select("id, date, minutes, focus, how_it_went, session_songs(count)")
      .gte("date", addDays(today, -30))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const error = songs.error ?? families.error ?? skills.error ?? week.error ?? recent.error
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
  const focusSkill = skills.data?.[0]?.name ?? null
  const chordsById = Object.fromEntries(songRows.map((s) => [s.id, s.chords]))

  return (
    <>
      <section className="card grid grid-cols-2 gap-4" aria-label="This week">
        <Stat
          label="Sessions this week"
          value={`${sessionsThisWeek} / ${WEEKLY_SESSION_TARGET}`}
          done={sessionsThisWeek >= WEEKLY_SESSION_TARGET}
        />
        <Stat label="Minutes this week" value={String(minutesThisWeek)} />
        {focusSkill && <p className="col-span-2 text-sm text-muted">Focus: {focusSkill}</p>}
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
        <Planner
          today={today}
          focusSkill={focusSkill}
          songs={songRows.map((s) => ({ id: s.id, title: s.title }))}
          chordsById={chordsById}
        />
      )}

      {(recent.data?.length ?? 0) > 0 && (
        <section className="card flex flex-col gap-2" aria-label="Recent sessions">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <ul className="flex flex-col divide-y divide-border">
            {recent.data!.map((s) => {
              const count = (s.session_songs as unknown as { count: number }[])[0]?.count ?? 0
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {formatDay(s.date, today)}
                    {s.focus ? <span className="text-muted"> · {s.focus}</span> : null}
                  </span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {s.minutes} min{count ? ` · ${count} song${count === 1 ? "" : "s"}` : ""}
                    {s.how_it_went ? ` · ${FEEL[s.how_it_went]}` : ""}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {songRows.length > 0 && (
        <p className="px-1 text-sm text-muted">
          Library: {songRows.length} songs in {families.count ?? 0} families, {canPlay} ready to play.
        </p>
      )}

      <form action={signOut} className="order-last flex items-center justify-between gap-3 px-1">
        <span className="truncate text-sm text-muted">Signed in as {user.email}</span>
        <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
          Sign out
        </button>
      </form>
    </>
  )
}

function formatDay(dateISO: string, todayIso: string) {
  if (dateISO === todayIso) return "Today"
  if (dateISO === addDays(todayIso, -1)) return "Yesterday"
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

function Stat({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div>
      <div className={`text-3xl font-bold tabular-nums ${done ? "text-ok" : ""}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  )
}
