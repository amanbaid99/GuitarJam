"use client"

import { useMemo, useState, useTransition } from "react"
import { SESSION_FEELS, type SessionFeel } from "@/lib/domain"
import { logSession } from "./actions"

export type LogSong = { id: string; title: string }

const FEEL_LABEL: Record<SessionFeel, string> = {
  rough: "Rough",
  ok: "OK",
  good: "Good",
  great: "Great",
}

const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60]

type Props = {
  songs: LogSong[]
  defaults: { minutes: number; focus: string; songIds: string[] }
  onDone: (saved: boolean) => void
}

/** Prefilled from the plan: one tap on Save is enough. Everything else is optional. */
export function LogSession({ songs, defaults, onDone }: Props) {
  const [minutes, setMinutes] = useState(defaults.minutes)
  const [focus, setFocus] = useState(defaults.focus)
  const [songIds, setSongIds] = useState<string[]>(defaults.songIds)
  const [feel, setFeel] = useState<SessionFeel | undefined>()
  const [notes, setNotes] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const title = useMemo(() => new Map(songs.map((s) => [s.id, s.title])), [songs])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return songs.filter((s) => !songIds.includes(s.id) && s.title.toLowerCase().includes(q)).slice(0, 6)
  }, [query, songs, songIds])

  const minuteOptions = MINUTE_CHOICES.includes(minutes)
    ? MINUTE_CHOICES
    : [...MINUTE_CHOICES, minutes].sort((a, b) => a - b)

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await logSession({
        minutes,
        focus: focus || undefined,
        how_it_went: feel,
        notes: notes || undefined,
        song_ids: songIds,
      })
      if (res.ok) onDone(true)
      else setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <h3 className="text-lg font-semibold">Log session</h3>

      <div role="group" aria-label="Minutes played" className="flex flex-wrap gap-2">
        {minuteOptions.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === minutes}
            onClick={() => setMinutes(m)}
            className={`min-h-11 min-w-14 rounded-full border px-3 text-sm font-semibold ${
              m === minutes ? "border-accent bg-accent text-accent-fg" : "border-border"
            }`}
          >
            {m} min
          </button>
        ))}
      </div>

      <div role="group" aria-label="How it went" className="grid grid-cols-4 gap-2">
        {SESSION_FEELS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={f === feel}
            onClick={() => setFeel(f === feel ? undefined : f)}
            className={`min-h-11 rounded-xl border text-sm font-medium ${
              f === feel ? "border-accent bg-accent text-accent-fg" : "border-border"
            }`}
          >
            {FEEL_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">Songs played</span>
        {songIds.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {songIds.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSongIds((ids) => ids.filter((x) => x !== id))}
                  className="flex min-h-10 items-center gap-2 rounded-full bg-surface-2 px-3 text-sm"
                  aria-label={`Remove ${title.get(id) ?? "song"}`}
                >
                  {title.get(id) ?? "Song"} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a song"
          aria-label="Add a song"
          className="field min-h-12 text-base"
        />
        {matches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSongIds((ids) => [...ids, s.id])
                    setQuery("")
                  }}
                  className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-surface-2"
                >
                  + {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Focus</span>
        <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={100} className="field min-h-12 text-base" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Note (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          className="field min-h-20 py-3 text-base"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => onDone(false)} disabled={pending} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  )
}
