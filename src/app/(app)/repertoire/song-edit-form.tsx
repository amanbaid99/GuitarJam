"use client"

import { useState, useTransition } from "react"
import { DIFFICULTIES, SONG_STATUSES, STYLES } from "@/lib/domain"
import { DIFFICULTY_LABEL, HINT_MAX, STATUS_LABEL, STYLE_LABEL, type Family, type Song } from "@/lib/songs"
import { updateSong, type SongEdit } from "./actions"

/** Edit a song's details (everything except lyrics, which have their own editor). */
export function SongEditForm({
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
