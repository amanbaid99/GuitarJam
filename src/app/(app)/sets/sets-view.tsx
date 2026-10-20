"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { LANGUAGE_MIXES, MINUTES_PER_SONG, SET_MINUTES, type LanguageMix } from "@/lib/sets/template"
import { buildSet, createGoToSet, deleteSet } from "./actions"
import { SetEditor, type EditorDraft, type EditorSong } from "./set-editor"

export type SavedSet = {
  id: string
  name: string | null
  room: string | null
  notes: string | null
  song_ids: string[]
}

const MIX_LABEL: Record<LanguageMix, string> = {
  hindi: "Mostly Hindi",
  mixed: "Mix",
  english: "Mostly English",
}

type Editing = { draft: EditorDraft; sourceNote?: string } | null

export function SetsView({ sets, songs }: { sets: SavedSet[]; songs: EditorSong[] }) {
  const [room, setRoom] = useState("")
  const [mix, setMix] = useState<LanguageMix>("mixed")
  const [minutes, setMinutes] = useState<(typeof SET_MINUTES)[number]>(20)
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [justSaved, setJustSaved] = useState<string | null>(null)

  const title = new Map(songs.map((s) => [s.id, s.title]))
  const hasGoTo = sets.some((s) => s.name === "Go-to set")

  function build() {
    setError(null)
    setJustSaved(null)
    startTransition(async () => {
      const res = await buildSet({ room, mix, minutes })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing({
        draft: { name: res.proposal.name, room, notes: res.proposal.notes, song_ids: res.proposal.song_ids },
        sourceNote: res.source === "ai" ? "Built by your AI coach. Reorder or swap anything." : res.note,
      })
    })
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
          sourceNote={editing.sourceNote}
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
      <section className="card flex flex-col gap-4" aria-label="Build a set">
        <div>
          <h2 className="text-xl font-semibold">Build a set</h2>
          <p className="text-sm text-muted">Who is in the room? Only songs you can play are used.</p>
        </div>
        <textarea
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Friends at home, chilled, a few want old Hindi songs"
          aria-label="Describe the room"
          maxLength={300}
          rows={2}
          className="field min-h-20 py-3 text-base"
        />
        <div role="group" aria-label="Language" className="grid grid-cols-3 gap-2">
          {LANGUAGE_MIXES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === mix}
              onClick={() => setMix(m)}
              className={`min-h-12 rounded-2xl border px-2 text-sm font-semibold ${
                m === mix ? "border-accent bg-accent text-accent-fg" : "border-border"
              }`}
            >
              {MIX_LABEL[m]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Minutes" className="grid grid-cols-5 gap-2">
          {SET_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === minutes}
              onClick={() => setMinutes(m)}
              className={`min-h-12 rounded-2xl border text-sm font-semibold ${
                m === minutes ? "border-accent bg-accent text-accent-fg" : "border-border"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
        <button type="button" onClick={build} disabled={pending} className="btn-primary">
          {pending ? "Building..." : "Build my set"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Saved sets">
        <h2 className="text-lg font-semibold">Saved sets</h2>
        {sets.length === 0 && <p className="card text-muted">No sets yet. Build one above.</p>}
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
        {!hasGoTo && (
          <button type="button" onClick={addGoTo} disabled={pending} className="btn-ghost">
            Add my Go-to set
          </button>
        )}
      </section>
    </div>
  )
}
