"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { LANGUAGE_MIXES, MINUTES_PER_SONG, SET_MINUTES, type LanguageMix, type SetProposal } from "@/lib/sets/template"
import { buildSet, createGoToSet, deleteSet } from "./actions"
import { AI_DISCLAIMER, BuildFailed, BuildProgress } from "./build-progress"
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

type Flow =
  | { kind: "idle" }
  | { kind: "building"; startedAt: number }
  | { kind: "failed"; reason: string; fallback?: SetProposal }

export function SetsView({ sets, songs }: { sets: SavedSet[]; songs: EditorSong[] }) {
  const [room, setRoom] = useState("")
  const [mix, setMix] = useState<LanguageMix>("mixed")
  const [minutes, setMinutes] = useState<(typeof SET_MINUTES)[number]>(20)
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [justSaved, setJustSaved] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow>({ kind: "idle" })
  // Each build gets an id; a cancelled or replaced build is ignored when it returns.
  const runId = useRef(0)

  const title = new Map(songs.map((s) => [s.id, s.title]))
  const hasGoTo = sets.some((s) => s.name === "Go-to set")

  function openProposal(proposal: SetProposal, sourceNote?: string) {
    setFlow({ kind: "idle" })
    setEditing({
      draft: { name: proposal.name, room, notes: proposal.notes, song_ids: proposal.song_ids },
      sourceNote,
    })
  }

  async function build(useAi: boolean) {
    const id = ++runId.current
    setError(null)
    setJustSaved(null)
    setFlow({ kind: "building", startedAt: Date.now() })
    const res = await buildSet({ room, mix, minutes }, useAi)
    if (id !== runId.current) return // cancelled or replaced

    if (!res.ok) {
      setFlow({ kind: "failed", reason: res.error })
      return
    }
    if (useAi && res.source === "template") {
      // The AI failed; the server already made a built-in set we can offer.
      setFlow({ kind: "failed", reason: res.note ?? "The AI did not answer.", fallback: res.proposal })
      return
    }
    openProposal(
      res.proposal,
      res.source === "ai"
        ? `${AI_DISCLAIMER}${res.model ? ` (Model: ${res.model.replace(/:free$/, "")})` : ""}`
        : "Built without AI: easy sing-along opener, same-family songs together, sing-along to close.",
    )
  }

  function cancelBuild() {
    runId.current++
    setFlow({ kind: "idle" })
  }

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

  if (flow.kind === "building") {
    return <BuildProgress startedAt={flow.startedAt} onCancel={cancelBuild} onWithoutAi={() => build(false)} />
  }

  if (flow.kind === "failed") {
    const fallback = flow.fallback
    return (
      <BuildFailed
        reason={flow.reason}
        hasFallback={Boolean(fallback)}
        onRetry={() => build(true)}
        onUseBuiltIn={() =>
          fallback
            ? openProposal(fallback, "Built without AI: easy sing-along opener, same-family songs together, sing-along to close.")
            : build(false)
        }
        onCancel={() => setFlow({ kind: "idle" })}
      />
    )
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
        <button type="button" onClick={() => build(true)} className="btn-primary">
          Build my set with AI
        </button>
        <button type="button" onClick={() => build(false)} className="min-h-11 text-sm text-muted">
          Or build it instantly without AI
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <button type="button" onClick={startManual} className="btn-ghost">
        + Make my own set
      </button>

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
