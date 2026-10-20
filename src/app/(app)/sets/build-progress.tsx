"use client"

import { useEffect, useState } from "react"

export const AI_DISCLAIMER =
  "AI suggestion. It can pick oddly or misjudge a song's mood, so check the order before you play. It only ever uses songs from your library."

const STEPS = [
  { label: "Gathering the songs you know", doneAfterMs: 1200 },
  { label: "Asking the AI to pick and order a set", doneAfterMs: Infinity },
  { label: "Checking every song is in your library", doneAfterMs: Infinity },
]

/** Shown while the AI builds a set. Steps tick along; the last ones finish when the answer arrives. */
export function BuildProgress({
  startedAt,
  onCancel,
  onWithoutAi,
}: {
  startedAt: number
  onCancel: () => void
  onWithoutAi: () => void
}) {
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const elapsed = Math.max(0, now - startedAt)
  const seconds = Math.floor(elapsed / 1000)
  const active = STEPS.findIndex((s) => elapsed < s.doneAfterMs)

  return (
    <section className="card flex flex-col gap-5" aria-live="polite" aria-label="Building your set">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Building your set</h2>
        <span className="text-sm tabular-nums text-muted">{seconds}s</span>
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const done = i < active
          const current = i === active
          return (
            <li key={step.label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-ok text-bg" : current ? "border-2 border-accent" : "border-2 border-border"
                }`}
              >
                {done ? "✓" : current ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" /> : ""}
              </span>
              <span className={current ? "font-medium" : done ? "text-muted" : "text-muted"}>{step.label}</span>
            </li>
          )
        })}
      </ol>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        {/* Indeterminate bar: we cannot know how long the free model will take. */}
        <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>

      {seconds >= 20 && (
        <p className="text-sm text-muted">
          Free AI models can be slow at busy times (up to a minute or two). Hang on, or build it without AI.
        </p>
      )}

      <p className="text-xs text-muted">{AI_DISCLAIMER}</p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="button" onClick={onWithoutAi} className="btn-ghost">
          Build without AI
        </button>
      </div>
    </section>
  )
}

/** The AI did not come through: say why and offer the way forward. */
export function BuildFailed({
  reason,
  hasFallback,
  onRetry,
  onUseBuiltIn,
  onCancel,
}: {
  reason: string
  hasFallback: boolean
  onRetry: () => void
  onUseBuiltIn: () => void
  onCancel: () => void
}) {
  return (
    <section className="card flex flex-col gap-4" role="alert" aria-label="Set building failed">
      <div>
        <h2 className="text-xl font-semibold">The AI could not build this set</h2>
        <p className="mt-1 text-sm text-danger">{reason}</p>
      </div>
      <p className="text-sm text-muted">
        You can try the AI again, or use the built-in builder: it opens with an easy sing-along, keeps
        same-family songs together and ends on a sing-along. No AI involved.
      </p>
      <button type="button" onClick={onRetry} className="btn-primary">
        Try AI again
      </button>
      <button type="button" onClick={onUseBuiltIn} className="btn-ghost">
        {hasFallback ? "Use built-in set" : "Build without AI"}
      </button>
      <button type="button" onClick={onCancel} className="min-h-11 text-sm text-muted">
        Back
      </button>
    </section>
  )
}
