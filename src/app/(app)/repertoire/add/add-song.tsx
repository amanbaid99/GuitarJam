"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { DIFFICULTIES, SONG_STATUSES, STYLES, type SongStatus } from "@/lib/domain"
import { downscaleImage } from "@/lib/image"
import type { ImportedSong } from "@/lib/import/clean"
import { DIFFICULTY_LABEL, HINT_MAX, STATUS_LABEL, STYLE_LABEL, type Family } from "@/lib/songs"
import { createClient } from "@/lib/supabase/client"
import { suggestFamily } from "@/lib/theory"
import { addSongs, importScreenshot } from "./actions"

type Props = { userId: string; families: Family[] }
type Tab = "manual" | "screenshot"

export function AddSong({ userId, families }: Props) {
  const [tab, setTab] = useState<Tab>("screenshot")
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="How to add" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        {(
          [
            ["screenshot", "From a screenshot"],
            ["manual", "Type it in"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-12 rounded-xl text-sm font-semibold ${
              tab === id ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "manual" ? <ManualForm families={families} /> : <ScreenshotImport userId={userId} families={families} />}
    </div>
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

/** Shows the theory engine's family suggestion for some chords, with one tap to apply. */
function FamilyPicker({
  families,
  chords,
  value,
  onChange,
}: {
  families: Family[]
  chords: string
  value: string
  onChange: (id: string) => void
}) {
  const suggestion = useMemo(() => (chords ? suggestFamily(chords, families) : null), [chords, families])
  const suggested = families.find((f) => f.id === suggestion?.familyId)
  return (
    <Field label="Family">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
        <option value="">Unassigned</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.id === suggestion?.familyId ? " (suggested)" : ""}
          </option>
        ))}
      </select>
      {suggested && value !== suggested.id && (
        <button
          type="button"
          onClick={() => onChange(suggested.id)}
          className="self-start rounded-full bg-accent/15 px-3 py-2 text-sm font-medium text-accent"
        >
          Use suggested: {suggested.name}
        </button>
      )}
    </Field>
  )
}

function ManualForm({ families }: { families: Family[] }) {
  const router = useRouter()
  const [chords, setChords] = useState("")
  const [familyId, setFamilyId] = useState("")
  const [hint, setHint] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "")
    setError(null)
    startTransition(async () => {
      const res = await addSongs([
        {
          title: v("title"),
          artist: v("artist"),
          status: v("status") as SongStatus,
          difficulty: v("difficulty") as never,
          style: v("style") as never,
          family_id: familyId,
          key_capo: v("key_capo"),
          chords,
          first_line_hint: hint,
          tab_link: v("tab_link"),
          notes: v("notes"),
          needs_verify: false,
        },
      ])
      if (res.ok) router.push("/repertoire")
      else setError(res.error)
    })
  }

  return (
    <form action={submit} className="card flex flex-col gap-4">
      <Field label="Title">
        <input name="title" required maxLength={200} className="field" />
      </Field>
      <Field label="Artist">
        <input name="artist" maxLength={200} className="field" />
      </Field>
      <Field label="Chords (sections welcome: Verse: Em D C)">
        <textarea
          value={chords}
          onChange={(e) => setChords(e.target.value)}
          rows={4}
          maxLength={4000}
          className="field min-h-28 py-3 font-mono text-base"
        />
      </Field>
      <FamilyPicker families={families} chords={chords} value={familyId} onChange={setFamilyId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select name="status" defaultValue="learning" className="field">
            {SONG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Key / capo">
          <input name="key_capo" maxLength={100} placeholder="Capo 3" className="field" />
        </Field>
        <Field label="Difficulty">
          <select name="difficulty" defaultValue="" className="field">
            <option value="">Not set</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Style">
          <select name="style" defaultValue="strumming" className="field">
            <option value="">Not set</option>
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={`First line hint (${hint.length}/${HINT_MAX}, a few words, never full lyrics)`}>
        <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={HINT_MAX} className="field" />
      </Field>
      <Field label="Tab link">
        <input name="tab_link" type="url" inputMode="url" placeholder="https://" className="field" />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={2} maxLength={2000} className="field min-h-20 py-3" />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving..." : "Add song"}
      </button>
    </form>
  )
}

type Stage =
  | { kind: "pick" }
  | { kind: "working"; step: string }
  | { kind: "review"; songs: ReviewSong[] }
  | { kind: "done"; count: number }

type ReviewSong = ImportedSong & { include: boolean; status: SongStatus }

function ScreenshotImport({ userId, families }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "pick" })
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    try {
      setStage({ kind: "working", step: "Preparing image..." })
      const blob = await downscaleImage(file)

      setStage({ kind: "working", step: "Uploading..." })
      const path = `${userId}/${Date.now()}.jpg`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from("screenshots")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false })
      if (upErr) throw new Error("Upload failed. Check your connection and try again.")

      setStage({ kind: "working", step: "Reading the chords (this can take up to a minute)..." })
      const res = await importScreenshot(path)
      if (!res.ok) {
        setError(res.error)
        setStage({ kind: "pick" })
        return
      }
      setStage({
        kind: "review",
        songs: res.songs.map((s) => ({ ...s, include: !s.duplicate, status: "learning" })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setStage({ kind: "pick" })
    } finally {
      if (input.current) input.current.value = ""
    }
  }

  function update(i: number, patch: Partial<ReviewSong>) {
    setStage((s) =>
      s.kind === "review" ? { kind: "review", songs: s.songs.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : s,
    )
  }

  function save(songs: ReviewSong[]) {
    const chosen = songs.filter((s) => s.include)
    setError(null)
    startTransition(async () => {
      const res = await addSongs(
        chosen.map((s) => ({
          title: s.title,
          artist: s.artist ?? "",
          status: s.status,
          difficulty: "",
          style: "",
          family_id: s.family_id ?? "",
          key_capo: s.key_capo ?? "",
          chords: s.chords ?? "",
          first_line_hint: "",
          tab_link: "",
          notes: "",
          needs_verify: true, // AI-read: shows "Check chords" until you confirm
        })),
      )
      if (res.ok) setStage({ kind: "done", count: res.count })
      else setError(res.error)
    })
  }

  if (stage.kind === "done") {
    return (
      <div className="card flex flex-col gap-3 text-center">
        <p className="text-2xl font-bold">
          Added {stage.count} song{stage.count === 1 ? "" : "s"}.
        </p>
        <p className="text-muted">They show a Check chords badge until you confirm them on the Songs tab.</p>
        <Link href="/repertoire" className="btn-primary">
          Go to Songs
        </Link>
        <button type="button" onClick={() => setStage({ kind: "pick" })} className="btn-ghost">
          Import another
        </button>
      </div>
    )
  }

  if (stage.kind === "review") {
    const count = stage.songs.filter((s) => s.include).length
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Found {stage.songs.length} song{stage.songs.length === 1 ? "" : "s"}. Check each one before saving. The family
          is suggested from the chords by the app, not the AI.
        </p>
        {stage.songs.map((s, i) => (
          <article key={i} className={`card flex flex-col gap-3 ${s.include ? "" : "opacity-60"}`}>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={s.include}
                onChange={(e) => update(i, { include: e.target.checked })}
                className="h-6 w-6 accent-[var(--accent)]"
              />
              <span className="font-medium">{s.include ? "Add this song" : "Skip this song"}</span>
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {s.duplicate && <span className="rounded-full bg-danger/15 px-2 py-1 text-danger">Already in your library</span>}
              {s.lyricsRemoved && <span className="rounded-full bg-surface-2 px-2 py-1 text-muted">Lyrics left out</span>}
            </div>
            <Field label="Title">
              <input value={s.title} onChange={(e) => update(i, { title: e.target.value })} className="field" />
            </Field>
            <Field label="Artist">
              <input value={s.artist ?? ""} onChange={(e) => update(i, { artist: e.target.value })} className="field" />
            </Field>
            <Field label="Chords">
              <textarea
                value={s.chords ?? ""}
                onChange={(e) => update(i, { chords: e.target.value })}
                rows={4}
                className="field min-h-28 py-3 font-mono text-base"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Key / capo">
                <input value={s.key_capo ?? ""} onChange={(e) => update(i, { key_capo: e.target.value })} className="field" />
              </Field>
              <Field label="Status">
                <select
                  value={s.status}
                  onChange={(e) => update(i, { status: e.target.value as SongStatus })}
                  className="field"
                >
                  {SONG_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <FamilyPicker
              families={families}
              chords={s.chords ?? ""}
              value={s.family_id ?? ""}
              onChange={(id) => update(i, { family_id: id || null })}
            />
          </article>
        ))}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStage({ kind: "pick" })} disabled={pending} className="btn-ghost flex-1">
            Start over
          </button>
          <button
            type="button"
            onClick={() => save(stage.songs)}
            disabled={pending || count === 0}
            className="btn-primary flex-1"
          >
            {pending ? "Saving..." : `Save ${count} song${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    )
  }

  const working = stage.kind === "working"
  return (
    <div className="card flex flex-col gap-4">
      <p className="text-muted">
        A photo or screenshot of a chord chart. Tables with many songs work too. Only chords are kept, never lyrics.
      </p>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
        <img src={preview} alt="Chosen screenshot" className="max-h-64 w-full rounded-2xl object-contain" />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        id="screenshot-input"
        onChange={(e) => onFile(e.target.files?.[0])}
        disabled={working}
      />
      <label
        htmlFor="screenshot-input"
        aria-disabled={working}
        className={`btn-primary cursor-pointer ${working ? "pointer-events-none opacity-60" : ""}`}
      >
        {working ? stage.step : preview ? "Choose another image" : "Choose screenshot"}
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
