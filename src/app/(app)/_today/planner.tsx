"use client"

import { useEffect, useState, useTransition } from "react"
import { todayISO } from "@/lib/dates"
import { createLocalStore } from "@/lib/local-store"
import { PLAN_MINUTES, planSchema, planTotal, type Plan, type PlanMinutes } from "@/lib/plan/types"
import { useWakeLock } from "@/lib/use-wake-lock"
import { logSession, planSession } from "./actions"

type PlanSong = { id: string; title: string }

type Saved = { date: string; plan: Plan; source?: "ai" | "template"; note?: string }

// Today's plan survives a reload or a trip to another tab.
const planStore = createLocalStore<Saved | null>(
  "myjamm-plan",
  (raw) => {
    const r = raw as Saved
    return typeof r?.date === "string" && planSchema.safeParse(r.plan).success ? r : null
  },
  null,
)

/** Today on this phone's own clock. */
const localToday = () => todayISO(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)

type Props = {
  quickPlan?: Plan
  songs: PlanSong[]
  chordsById: Record<string, string | null>
}

export function Planner({ songs, chordsById, quickPlan }: Props) {
  const saved = planStore.useValue()
  const [useQuickPlan, setUseQuickPlan] = useState(Boolean(quickPlan))
  const plan = useQuickPlan && quickPlan ? quickPlan : saved && saved.date === localToday() ? saved.plan : null
  const [minutes, setMinutes] = useState<PlanMinutes>(20)
  const [error, setError] = useState<string | null>(null)
  const [startImmediately, setStartImmediately] = useState(false)
  const [pending, startTransition] = useTransition()

  function makePlan(useCoach: boolean) {
    setError(null)
    setStartImmediately(!useCoach)
    startTransition(async () => {
      const res = await planSession(minutes, useCoach)
      if (res.ok) planStore.set({ date: localToday(), plan: res.plan, source: res.source, note: res.note })
      else setError(res.error)
    })
  }

  return (
    <section className="card flex flex-col gap-4" aria-label="Practice plan">
      {!plan ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">How long have you got?</h2>
          </div>
          <div role="group" aria-label="Minutes" className="grid grid-cols-4 gap-2">
            {PLAN_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === minutes}
                onClick={() => setMinutes(m)}
                className={`min-h-14 rounded-2xl border text-lg font-semibold ${
                  m === minutes ? "border-accent bg-accent text-accent-fg" : "border-border"
                }`}
              >
                {m}
                <span className="ml-0.5 text-xs font-medium">min</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => makePlan(false)} disabled={pending} className="btn-primary">
            {pending ? "Preparing…" : "Start practice"}
          </button>
          <button type="button" onClick={() => makePlan(true)} disabled={pending} className="btn-ghost">Ask AI coach</button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <PlanRunner
          key={JSON.stringify(plan)}
          plan={plan}
          autoStart={useQuickPlan || startImmediately}
          source={useQuickPlan ? "template" : saved?.source}
          note={saved?.note}
          songs={songs}
          chordsById={chordsById}
          onClear={() => {
            setUseQuickPlan(false)
            setStartImmediately(false)
            planStore.set(null)
          }}
        />
      )}
    </section>
  )
}

type RunState =
  | { status: "idle"; index: number }
  | { status: "running"; index: number; endsAt: number }
  | { status: "paused"; index: number; remainingMs: number }
  | { status: "done"; index: number }

function PlanRunner({
  plan,
  source,
  note,
  songs,
  chordsById,
  onClear,
  autoStart,
}: {
  plan: Plan
  source?: "ai" | "template"
  note?: string
  songs: PlanSong[]
  chordsById: Record<string, string | null>
  onClear: () => void
  autoStart: boolean
}) {
  const [run, setRun] = useState<RunState>({ status: "idle", index: 0 })
  const [now, setNow] = useState(0)
  const [played, setPlayed] = useState<Record<number, number>>({})
  const [rating, setRating] = useState<"rough" | "great">()
  const [saveError, setSaveError] = useState("")
  const [savedSession, setSavedSession] = useState(false)
  const [saving, saveTransition] = useTransition()
  useWakeLock(run.status === "running")

  const firstBlockMs = plan.blocks[0].minutes * 60_000
  useEffect(() => {
    if (!autoStart) return
    const timer = setTimeout(() => {
      const time = Date.now()
      setNow(time)
      setRun((current) => current.status === "idle" && current.index === 0
        ? { status: "running", index: 0, endsAt: time + firstBlockMs }
        : current)
    }, 0)
    return () => clearTimeout(timer)
  }, [autoStart, firstBlockMs])

  const block = plan.blocks[Math.min(run.index, plan.blocks.length - 1)]
  const blockMs = block.minutes * 60_000

  // Tick while running. Time comes from the clock, not from counting ticks,
  // so it stays right even if the phone throttles the page.
  useEffect(() => {
    if (run.status !== "running") return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= run.endsAt) {
        chime()
        setPlayed((previous) => ({ ...previous, [run.index]: plan.blocks[run.index].minutes * 60_000 }))
        const next = run.index + 1
        setRun(
          next < plan.blocks.length
            ? { status: "running", index: next, endsAt: t + plan.blocks[next].minutes * 60_000 }
            : { status: "done", index: run.index },
        )
      }
    }, 250)
    return () => clearInterval(id)
  }, [run, plan.blocks])

  const remainingMs =
    run.status === "running"
      ? Math.max(0, run.endsAt - now)
      : run.status === "paused"
        ? run.remainingMs
        : run.status === "done"
          ? 0
          : blockMs

  function start() {
    const t = Date.now()
    setNow(t)
    setRun((r) =>
      r.status === "paused"
        ? { status: "running", index: r.index, endsAt: t + r.remainingMs }
        : { status: "running", index: r.index, endsAt: t + plan.blocks[r.index].minutes * 60_000 },
    )
  }

  function pause() {
    if (run.status === "running") {
      setRun({ status: "paused", index: run.index, remainingMs: Math.max(0, run.endsAt - Date.now()) })
    }
  }

  function advance(finish = false) {
    const elapsed = blockMs - (run.status === "running" ? Math.max(0, run.endsAt - Date.now()) : remainingMs)
    if (elapsed > 0) setPlayed((previous) => ({ ...previous, [run.index]: elapsed }))
    const next = run.index + 1
    if (finish || next >= plan.blocks.length) {
      setRun({ status: "done", index: run.index })
      return
    }
    const t = Date.now()
    setNow(t)
    setRun(
      run.status === "running"
        ? { status: "running", index: next, endsAt: t + plan.blocks[next].minutes * 60_000 }
        : { status: "idle", index: next },
    )
  }

  const playedMs = Object.values(played).reduce((total, ms) => total + ms, 0)
  const loggedMinutes = Math.max(1, Math.round(playedMs / 60_000))
  const songIds = [...new Set(plan.blocks.flatMap((item, index) => item.song_id && played[index] >= 1000 ? [item.song_id] : []))]

  function save() {
    setSaveError("")
    saveTransition(async () => {
      try {
        const result = await logSession({ minutes: loggedMinutes, song_ids: songIds, how_it_went: rating })
        if (result.ok) setSavedSession(true)
        else setSaveError(result.error)
      } catch {
        setSaveError("Could not save your session. Try again.")
      }
    })
  }

  const songTitle = block.song_id ? songs.find((s) => s.id === block.song_id)?.title : null
  const chords = block.song_id ? chordsById[block.song_id] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Today&apos;s plan</h2>
          <p className="text-sm text-muted">{plan.why}</p>
          {source && (
            <div className="mt-2 flex flex-col items-start gap-1">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  source === "ai" ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {source === "ai" ? "✦ AI coach" : "Built-in plan"}
              </span>
              {source === "template" && note && <span className="text-xs text-muted">{note}</span>}
            </div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm tabular-nums">
          {planTotal(plan)} min
        </span>
      </div>

      {run.status === "done" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4 text-center">
          <p className="text-2xl font-bold">{playedMs >= 1000 ? "Nice work." : "Session ended"}</p>
          {savedSession ? (
            <>
              <p role="status" className="text-muted">Session saved · {loggedMinutes} min</p>
              <button type="button" onClick={onClear} className="btn-primary">Practise again</button>
            </>
          ) : playedMs >= 1000 ? (
            <>
              <p className="text-muted">{loggedMinutes} min · {songIds.length} {songIds.length === 1 ? "song" : "songs"}</p>
              <div className="grid grid-cols-2 gap-2" aria-label="How did it go?">
                <button type="button" aria-pressed={rating === "rough"} onClick={() => setRating(rating === "rough" ? undefined : "rough")} className="btn-ghost px-2 text-sm aria-pressed:border-accent aria-pressed:text-accent">Needs work</button>
                <button type="button" aria-pressed={rating === "great"} onClick={() => setRating(rating === "great" ? undefined : "great")} className="btn-ghost px-2 text-sm aria-pressed:border-accent aria-pressed:text-accent">Ready to play</button>
              </div>
              {saveError && <p role="alert" className="text-danger">{saveError}</p>}
              <button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save session"}</button>
              <button type="button" onClick={onClear} disabled={saving} className="btn-ghost">Skip</button>
            </>
          ) : <button type="button" onClick={onClear} className="btn-primary">Choose a practice plan</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold">{block.label}</h3>
            <span className="text-4xl font-bold tabular-nums" aria-live="off">
              {formatClock(remainingMs)}
            </span>
          </div>
          <p className="text-base">{block.instruction}</p>
          {songTitle && chords && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm text-muted">{songTitle}</p>
              <p className="font-mono text-base whitespace-pre-wrap">{chords}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {run.status === "running" ? (
              <button type="button" onClick={pause} className="btn-primary">
                Pause
              </button>
            ) : (
              <button type="button" onClick={start} className="btn-primary">
                {run.status === "paused" ? "Resume" : "Start"}
              </button>
            )}
            <button type="button" onClick={() => advance()} className="btn-ghost min-h-14">
              {run.index === plan.blocks.length - 1 ? "Finish" : "Next block"}
            </button>
          </div>
        </div>
      )}

      {run.status !== "done" && (
        <>
          <details className="rounded-xl border border-border px-3 py-2">
            <summary className="min-h-8 cursor-pointer font-medium">Session outline</summary>
            <ol className="flex flex-col gap-1">
              {plan.blocks.map((b, i) => {
                const isDone = Boolean(played[i])
                const isNow = i === run.index
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                      isNow ? "bg-accent/15 font-semibold" : isDone ? "text-muted line-through" : ""
                    }`}
                  >
                    <span className="w-10 shrink-0 tabular-nums text-muted">{b.minutes}m</span>
                    <span className="min-w-0 flex-1 truncate">{b.label}</span>
                    {isDone && <span aria-label="done">✓</span>}
                  </li>
                )
              })}
            </ol>
          </details>
          {run.status === "idle" && run.index === 0 ? (
            <button type="button" onClick={onClear} className="btn-ghost text-sm">New plan</button>
          ) : run.index < plan.blocks.length - 1 && (
            <button type="button" onClick={() => advance(true)} className="btn-ghost text-sm">Finish session</button>
          )}
        </>
      )}
    </div>
  )
}

function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/** A short two-note chime and a buzz when a block ends. */
function chime() {
  try {
    navigator.vibrate?.([120, 80, 120])
    const ctx = new AudioContext()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const at = ctx.currentTime + i * 0.18
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.4)
    })
    setTimeout(() => ctx.close().catch(() => {}), 1000)
  } catch {
    // No audio available: the screen still moves to the next block.
  }
}
