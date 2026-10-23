"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { MINUTES_PER_SONG } from "@/lib/sets/template"
import { createGoToSet, deleteSet } from "./actions"
import { SetEditor, type EditorDraft, type EditorSong } from "./set-editor"

export type SavedSet = {
  id: string
  name: string | null
  room: string | null
  notes: string | null
  song_ids: string[]
}

type Editing = { draft: EditorDraft } | null

// The AI set builder (buildSet, build-progress.tsx) is parked for now: groups
// are the ready-made sets. It can come back as a button here later.

export function SetsView({ sets, songs }: { sets: SavedSet[]; songs: EditorSong[] }) {
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [justSaved, setJustSaved] = useState<string | null>(null)

  const title = new Map(songs.map((s) => [s.id, s.title]))
  const hasGoTo = sets.some((s) => s.name === "Go-to set")

  function startManual() {
    setError(null)
    setJustSaved(null)
    setEditing({ draft: { name: "", room: "", notes: "", song_ids: [] } })
  }

  function addGoTo() {
    setError(null)
    startTransition(async () => {
      const res = await createGoToSet()
      if (res.ok) setJustSaved(res.id)
      else setError(res.error)
    })
  }

  function remove(id: string, name: string | null) {
    if (!window.confirm(`Delete "${name ?? "this set"}"?`)) return
    startTransition(async () => {
      const res = await deleteSet(id)
      if (!res.ok) setError(res.error ?? "Could not delete.")
    })
  }

  if (editing) {
    return (
      <section className="card">
        <SetEditor
          key={editing.draft.id ?? "new"}
          draft={editing.draft}
          songs={songs}
          onCancel={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null)
            setJustSaved(id)
          }}
        />
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <section className="flex flex-col gap-3" aria-label="My sets">
        <div>
          <h2 className="text-lg font-semibold">My sets</h2>
          <p className="text-sm text-muted">Your own lists for a gig or a night, from any group.</p>
        </div>
        {sets.map((set) => (
          <article
            key={set.id}
            className={`card flex flex-col gap-3 ${justSaved === set.id ? "border-accent" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{set.name ?? "Set"}</h3>
                <p className="text-sm text-muted">
                  {set.song_ids.length} songs, about {set.song_ids.length * MINUTES_PER_SONG} min
                  {set.room ? ` · ${set.room}` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm">
              {set.song_ids
                .map((id) => title.get(id))
                .filter(Boolean)
                .join(" · ")}
            </p>
            {set.notes && <p className="text-sm text-muted">{set.notes}</p>}
            <div className="grid grid-cols-3 gap-2">
              <Link href={`/perform/set/${set.id}`} className="btn-primary col-span-1 min-h-12 text-base">
                Play
              </Link>
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    draft: {
                      id: set.id,
                      name: set.name ?? "Set",
                      room: set.room ?? "",
                      notes: set.notes ?? "",
                      song_ids: set.song_ids,
                    },
                  })
                }
                className="btn-ghost min-h-12"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(set.id, set.name)}
                disabled={pending}
                className="btn-ghost min-h-12 text-danger"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        <button type="button" onClick={startManual} className="btn-ghost">
          + Make my own set
        </button>
        {!hasGoTo && (
          <button type="button" onClick={addGoTo} disabled={pending} className="btn-ghost">
            Add my Go-to set
          </button>
        )}
      </section>
    </div>
  )
}
