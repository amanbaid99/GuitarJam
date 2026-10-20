"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { MINUTES_PER_SONG } from "@/lib/sets/template"
import { saveSet } from "./actions"

export type EditorSong = {
  id: string
  title: string
  artist: string | null
  family_name: string | null
  difficulty: string | null
  status: string
}

export type EditorDraft = {
  id?: string
  name: string
  room: string
  notes: string
  song_ids: string[]
}

type Props = {
  draft: EditorDraft
  songs: EditorSong[]
  /** Shown above the list, e.g. "Built by your AI coach". */
  sourceNote?: string
  onSaved: (id: string) => void
  onCancel: () => void
}

/** Edit a set: name, order (drag or arrows), remove, add songs, notes. */
export function SetEditor({ draft, songs, sourceNote, onSaved, onCancel }: Props) {
  const [name, setName] = useState(draft.name)
  const [notes, setNotes] = useState(draft.notes)
  const [ids, setIds] = useState(draft.song_ids)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState<number | null>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return songs
      .filter((s) => !ids.includes(s.id) && (s.status === "can_play" || s.status === "polished"))
      .filter((s) => `${s.title} ${s.artist ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, songs, ids])

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return
    setIds((list) => {
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  // Drag by the handle: find the row under the finger and move there.
  function onHandleDown(e: React.PointerEvent, index: number) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(index)
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragging === null) return
    const y = e.clientY
    let target = dragging
    rows.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      if (y > r.top && y < r.bottom) target = i
    })
    if (target !== dragging) {
      move(dragging, target)
      setDragging(target)
    }
  }
  function onHandleUp() {
    setDragging(null)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await saveSet({ id: draft.id, name, room: draft.room, notes, song_ids: ids })
      if (res.ok) onSaved(res.id)
      else setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!draft.id && (
        <p className="rounded-2xl bg-accent/15 px-4 py-3 text-sm font-medium text-accent" role="status">
          Not saved yet. Check the order, then tap Save set.
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Set name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="field" />
      </label>

      {sourceNote && <p className="text-xs text-muted">{sourceNote}</p>}
      {draft.room && <p className="text-sm text-muted">For: {draft.room}</p>}

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {ids.length} songs, about {ids.length * MINUTES_PER_SONG} min
        </span>
        <span>Drag ⠿ or use arrows</span>
      </div>

      <ol className="flex flex-col gap-2">
        {ids.map((id, i) => {
          const s = byId.get(id)
          return (
            <li
              key={id}
              ref={(el) => {
                rows.current[i] = el
              }}
              className={`flex items-center gap-2 rounded-2xl border bg-surface-2 py-1 pr-1 pl-1 ${
                dragging === i ? "border-accent" : "border-transparent"
              }`}
            >
              <button
                type="button"
                aria-label={`Drag ${s?.title ?? "song"}`}
                onPointerDown={(e) => onHandleDown(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                className="flex h-12 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-xl text-muted"
              >
                ⠿
              </button>
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s?.title ?? "Removed song"}</div>
                <div className="truncate text-xs text-muted">
                  {[s?.family_name, s?.difficulty === "hard" ? "showpiece" : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                type="button"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className="flex h-11 w-9 items-center justify-center rounded-lg text-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={i === ids.length - 1}
                onClick={() => move(i, i + 1)}
                className="flex h-11 w-9 items-center justify-center rounded-lg text-muted disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${s?.title ?? "song"}`}
                onClick={() => setIds((list) => list.filter((x) => x !== id))}
                className="flex h-11 w-9 items-center justify-center rounded-lg text-muted"
              >
                ×
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a song"
          aria-label="Add a song to the set"
          className="field min-h-12 text-base"
        />
        {matches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setIds((list) => [...list, s.id])
                    setQuery("")
                  }}
                  className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-surface-2"
                >
                  + {s.title}
                  {s.family_name ? <span className="text-muted"> · {s.family_name}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Notes</span>
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

      {/* Stays visible above the tab bar while scrolling a long set. */}
      <div
        className="sticky z-10 -mx-2 flex gap-2 rounded-2xl border border-border bg-surface/95 p-2 backdrop-blur"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <button type="button" onClick={onCancel} disabled={pending} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending || ids.length === 0} className="btn-primary flex-1">
          {pending ? "Saving..." : "Save set"}
        </button>
      </div>
    </div>
  )
}
