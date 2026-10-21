"use client"

import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { LyricsView } from "@/components/lyrics-view"
import { SONG_STATUSES, type SongStatus } from "@/lib/domain"
import { STATUS_LABEL, type Family, type Song } from "@/lib/songs"
import { markVerified, saveLyrics, saveMyVersion, setSongStatus } from "../actions"
import { ChordTools } from "../chord-tools"
import { SongEditForm } from "../song-edit-form"

type Props = { song: Song; families: Family[] }

const LYRICS_HELP = `Put each chord in square brackets just before the word it lands on:
[G]Look at the [D]stars, look how they [Cadd9]shine for you
Lines like [Chorus] or Verse 2: become headings.`

export function SongDetail({ song, families }: Props) {
  const family = families.find((f) => f.id === song.family_id) ?? null
  const [status, setOptimisticStatus] = useOptimistic(song.status as SongStatus)
  const [editing, setEditing] = useState<"none" | "details" | "lyrics">("none")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function changeStatus(next: SongStatus) {
    if (next === status) return
    setError(null)
    startTransition(async () => {
      setOptimisticStatus(next)
      const res = await setSongStatus(song.id, next)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl leading-tight font-bold tracking-tight">{song.title}</h1>
        <p className="text-muted">
          {[song.artist, family ? `${family.name} family` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/perform/song/${song.id}`} className="btn-primary min-h-12 text-base">
          Play
        </Link>
        <button type="button" onClick={() => setEditing("details")} className="btn-ghost min-h-12">
          Edit details
        </button>
      </div>

      <div role="group" aria-label="Status" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
        {SONG_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === status}
            disabled={pending}
            onClick={() => changeStatus(s)}
            className={`min-h-12 rounded-xl px-1 text-xs leading-tight font-semibold ${
              s === status ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {song.needs_verify && (
        <div className="card flex items-center justify-between gap-3 border-danger/40">
          <p className="text-sm">These chords were read by AI. Check them against the song.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => void (await markVerified(song.id)))}
            className="btn-ghost min-h-11 shrink-0 px-3 text-sm"
          >
            They&apos;re right
          </button>
        </div>
      )}

      {editing === "details" ? (
        <section className="card p-0">
          <SongEditForm song={song} families={families} onDone={() => setEditing("none")} />
        </section>
      ) : editing === "lyrics" ? (
        <LyricsEditor song={song} onDone={() => setEditing("none")} />
      ) : (
        <section className="card flex flex-col gap-4" aria-label="Chords and lyrics">
          {song.chords || song.lyrics ? (
            <ChordTools
              chords={song.chords}
              lyrics={song.lyrics}
              keyCapo={song.key_capo}
              familyKey={family?.key ?? null}
              savedTranspose={song.my_transpose}
              savedCapo={song.my_capo}
              onSave={(t, c) => saveMyVersion(song.id, t, c)}
            />
          ) : (
            <p className="text-muted">No chords yet. Use Edit details to add them.</p>
          )}
          <button type="button" onClick={() => setEditing("lyrics")} className="btn-ghost">
            {song.lyrics ? "Edit lyrics" : "Add lyrics"}
          </button>
        </section>
      )}

      {(song.first_line_hint || song.notes || song.tab_link) && editing === "none" && (
        <section className="card flex flex-col gap-2 text-sm" aria-label="Notes">
          {song.first_line_hint && (
            <p>
              <span className="text-muted">First line: </span>
              <span className="italic">{song.first_line_hint}</span>
            </p>
          )}
          {song.notes && <p className="whitespace-pre-wrap">{song.notes}</p>}
          {song.tab_link && (
            <a href={song.tab_link} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
              Open tab
            </a>
          )}
        </section>
      )}


      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function LyricsEditor({ song, onDone }: { song: Song; onDone: () => void }) {
  const [text, setText] = useState(song.lyrics ?? "")
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await saveLyrics(song.id, text)
      if (res.ok) onDone()
      else setError(res.error)
    })
  }

  return (
    <section className="card flex flex-col gap-3" aria-label="Edit lyrics">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lyrics</h2>
        <button type="button" onClick={() => setPreview((p) => !p)} className="min-h-11 px-2 text-sm text-accent">
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      <p className="text-xs whitespace-pre-line text-muted">{LYRICS_HELP}</p>
      <p className="text-xs text-muted">Private to you, never sent to the AI. Write chords as in the original chart; your saved key and capo are applied when shown.</p>
      {preview ? (
        <div className="min-h-40 rounded-2xl bg-bg p-4">
          {text.trim() ? <LyricsView text={text} /> : <p className="text-muted">Nothing yet.</p>}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          maxLength={20000}
          spellCheck={false}
          autoCapitalize="sentences"
          aria-label="Lyrics with chords in brackets"
          className="field min-h-72 py-3 font-mono text-base leading-relaxed"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} disabled={pending} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving..." : "Save lyrics"}
        </button>
      </div>
    </section>
  )
}
