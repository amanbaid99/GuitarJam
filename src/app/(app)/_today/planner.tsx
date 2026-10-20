"use client"

import { useEffect, useState, useTransition } from "react"
import { createLocalStore } from "@/lib/local-store"
import { PLAN_MINUTES, planSchema, planTotal, type Plan, type PlanMinutes } from "@/lib/plan/types"
import { useWakeLock } from "@/lib/use-wake-lock"
import { planSession } from "./actions"
import { LogSession, type LogSong } from "./log-session"

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

type Props = {
  today: string
  focusSkill: string | null
  songs: LogSong[]
  chordsById: Record<string, string | null>
}

export function Planner({ today, focusSkill, songs, chordsById }: Props) {
  const saved = planStore.useValue()
  const plan = saved?.date === today ? saved.plan : null
  const [minutes, setMinutes] = useState<PlanMinutes>(20)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [logging, setLogging] = useState(false)

  function makePlan() {
    setError(null)
    startTransition(async () => {
      const res = await planSession(minutes)
      if (res.ok) planStore.set({ date: today, plan: res.plan, source: res.source, note: res.note })
      else setError(res.error)
    })
  }

  const planSongIds = plan ? [...new Set(plan.blocks.flatMap((b) => (b.song_id ? [b.song_id] : [])))] : []

  return (
    <section className="card flex flex-col gap-4" aria-label="Practice plan">
      {!plan ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">Practice</h2>
            <p className="text-sm text-muted">How long have you got?</p>
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
          <button type="button" onClick={makePlan} disabled={pending} className="btn-primary">
            {pending ? "Asking your coach..." : "Plan my session"}
          </button>
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
          source={saved?.source}
          note={saved?.note}
          songs={songs}
          chordsById={chordsById}
          onLog={() => setLogging(true)}
          onClear={() => planStore.set(null)}
        />
      )}

      {logging ? (
        <LogSession
          songs={songs}
          defaults={{
            minutes: plan ? planTotal(plan) : 20,
            focus: focusSkill ?? "",
            songIds: planSongIds,
          }}
          onDone={(saved) => {
            setLogging(false)
            if (saved) planStore.set(null)
          }}
        />
      ) : (
        !plan && (
          <button type="button" onClick={() => setLogging(true)} className="btn-ghost">
            Log a session without a plan
          </button>
        )
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
  onLog,
  onClear,
}: {
  plan: Plan
  source?: "ai" | "template"
  note?: string
  songs: LogSong[]
  chordsById: Record<string, string | null>
  onLog: () => void
  onClear: () => void
}) {
  const [run, setRun] = useState<RunState>({ status: "idle", index: 0 })
  const [now, setNow] = useState(() => Date.now())
  useWakeLock(run.status === "running")

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
    if (run.status === "running") setRun({ status: "paused", index: run.index, remainingMs })
  }

  function skip() {
    const next = run.index + 1
    if (next >= plan.blocks.length) {
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

  const songTitle = block.song_id ? songs.find((s) => s.id === block.song_id)?.title : null
  const chords = block.song_id ? chordsById[block.song_id] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Today&apos;s plan</h2>
          <p className="text-sm text-muted">{plan.why}</p>
          {source && (
            <p className="mt-1 text-xs text-muted">
              {source === "ai" ? "Planned by your AI coach" : (note ?? "Built-in plan")}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm tabular-nums">
          {planTotal(plan)} min
        </span>
      </div>

      <ol className="flex flex-col gap-1">
        {plan.blocks.map((b, i) => {
          const isDone = run.status === "done" || i < run.index
          const isNow = run.status !== "done" && i === run.index
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

      {run.status === "done" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4 text-center">
          <p className="text-2xl font-bold">Nice work.</p>
          <p className="text-muted">Log it so your week adds up.</p>
          <button type="button" onClick={onLog} className="btn-primary">
            Log session
          </button>
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
            <button type="button" onClick={skip} className="btn-ghost min-h-14">
              {run.index === plan.blocks.length - 1 ? "Finish" : "Next block"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {run.status !== "done" && (
          <button type="button" onClick={onLog} className="btn-ghost flex-1 text-sm">
            Log session
          </button>
        )}
        <button type="button" onClick={onClear} className="btn-ghost flex-1 text-sm">
          New plan
        </button>
      </div>
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
