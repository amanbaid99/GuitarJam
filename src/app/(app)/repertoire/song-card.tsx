"use client"

import { useOptimistic, useState, useTransition } from "react"
import { DIFFICULTIES, SONG_STATUSES, STYLES, type SongStatus } from "@/lib/domain"
import {
  DIFFICULTY_LABEL,
  HINT_MAX,
  STATUS_LABEL,
  STYLE_LABEL,
  lastPractisedLabel,
  type Family,
  type Song,
} from "@/lib/songs"
import { markVerified, setSongStatus, updateSong, type SongEdit } from "./actions"

type Props = { song: Song; families: Family[]; today: string }

const STATUS_TONE: Record<SongStatus, string> = {
  want_to_learn: "bg-surface-2 text-muted",
  learning: "bg-accent/15 text-accent",
  can_play: "bg-ok/15 text-ok",
  polished: "bg-ok text-bg",
}

export function SongCard({ song, families, today }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [status, setOptimisticStatus] = useOptimistic(song.status as SongStatus)

  const family = families.find((f) => f.id === song.family_id)
  const meta = [
    song.difficulty && DIFFICULTY_LABEL[song.difficulty as keyof typeof DIFFICULTY_LABEL],
    song.style && STYLE_LABEL[song.style as keyof typeof STYLE_LABEL],
    song.key_capo,
  ].filter(Boolean)

  function changeStatus(next: SongStatus) {
    if (next === status) return
    setError(null)
    startTransition(async () => {
      setOptimisticStatus(next)
      const res = await setSongStatus(song.id, next)
      if (!res.ok) setError(res.error)
    })
  }

  function confirmChords() {
    setError(null)
    startTransition(async () => {
      const res = await markVerified(song.id)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <article className="card p-0">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug">{song.title}</h3>
          {song.artist && <p className="truncate text-sm text-muted">{song.artist}</p>}
          {(meta.length > 0 || song.needs_verify) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {meta.join(" · ")}
              {song.needs_verify && (
                <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">
                  Check chords
                </span>
              )}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </button>

      {expanded && !editing && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div role="group" aria-label="Status" className="grid grid-cols-4 gap-1 rounded-2xl bg-bg p-1">
            {SONG_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === status}
                disabled={pending}
                onClick={() => changeStatus(s)}
                className={`min-h-12 rounded-xl px-1 text-xs font-semibold leading-tight transition ${
                  s === status ? "bg-accent text-accent-fg" : "text-muted"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Family</dt>
            <dd>{family ? `${family.name} (key of ${family.key})` : "Unassigned"}</dd>
            {song.key_capo && (
              <>
                <dt className="text-muted">Key / capo</dt>
                <dd>{song.key_capo}</dd>
              </>
            )}
            {song.first_line_hint && (
              <>
                <dt className="text-muted">First line</dt>
                <dd className="italic">{song.first_line_hint}</dd>
              </>
            )}
            <dt className="text-muted">Practised</dt>
            <dd>{lastPractisedLabel(song.last_practised, today)}</dd>
          </dl>

          {song.chords ? (
            <div className="rounded-2xl bg-bg p-4 font-mono text-base leading-relaxed whitespace-pre-wrap">
              {song.chords}
            </div>
          ) : (
            <p className="text-sm text-muted">No chords yet.</p>
          )}

          {song.notes && <p className="text-sm text-muted">{song.notes}</p>}

          {song.tab_link && (
            <a
              href={song.tab_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent underline underline-offset-4"
            >
              Open tab
            </a>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost flex-1">
              Edit
            </button>
            {song.needs_verify && (
              <button type="button" onClick={confirmChords} disabled={pending} className="btn-ghost flex-1">
                Chords look right
              </button>
            )}
          </div>
        </div>
      )}

      {expanded && editing && (
        <SongEditForm
          song={song}
          families={families}
          onDone={() => setEditing(false)}
        />
      )}
    </article>
  )
}

function SongEditForm({
  song,
  families,
  onDone,
}: {
  song: Song
  families: Family[]
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [hint, setHint] = useState(song.first_line_hint ?? "")

  function submit(form: FormData) {
    const value = (name: string) => String(form.get(name) ?? "")
    const edit: SongEdit = {
      title: value("title"),
      artist: value("artist"),
      status: value("status") as SongEdit["status"],
      difficulty: value("difficulty") as SongEdit["difficulty"],
      style: value("style") as SongEdit["style"],
      family_id: value("family_id"),
      key_capo: value("key_capo"),
      chords: value("chords"),
      first_line_hint: value("first_line_hint"),
      tab_link: value("tab_link"),
      notes: value("notes"),
    }
    setError(null)
    startTransition(async () => {
      const res = await updateSong(song.id, edit)
      if (res.ok) onDone()
      else setError(res.error)
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4 border-t border-border p-4">
      <Field label="Title">
        <input name="title" defaultValue={song.title} required className="field" />
      </Field>
      <Field label="Artist">
        <input name="artist" defaultValue={song.artist ?? ""} className="field" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select name="status" defaultValue={song.status} className="field">
            {SONG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select name="difficulty" defaultValue={song.difficulty ?? ""} className="field">
            <option value="">Not set</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Style">
          <select name="style" defaultValue={song.style ?? ""} className="field">
            <option value="">Not set</option>
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Family">
          <select name="family_id" defaultValue={song.family_id ?? ""} className="field">
            <option value="">Unassigned</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Key / capo">
        <input name="key_capo" defaultValue={song.key_capo ?? ""} placeholder="Capo 3" className="field" />
      </Field>
      <Field label="Chords">
        <textarea
          name="chords"
          defaultValue={song.chords ?? ""}
          rows={5}
          className="field min-h-32 py-3 font-mono text-base"
        />
      </Field>
      <Field label={`First line hint (${hint.length}/${HINT_MAX}, a few words, never full lyrics)`}>
        <input
          name="first_line_hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={HINT_MAX}
          className="field"
        />
      </Field>
      <Field label="Tab link">
        <input
          name="tab_link"
          type="url"
          inputMode="url"
          defaultValue={song.tab_link ?? ""}
          placeholder="https://"
          className="field"
        />
      </Field>
      <Field label="Notes">
        <textarea name="notes" defaultValue={song.notes ?? ""} rows={3} className="field min-h-24 py-3" />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onDone} disabled={pending} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  )
}
