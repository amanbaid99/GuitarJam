"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { DIFFICULTIES, SONG_STATUSES, STYLES, type SongStatus } from "@/lib/domain"
import { prepareScreenshot } from "@/lib/image"
import { GroupPicker, suggestedGroupId } from "@/components/group-picker"
import { LyricsView } from "@/components/lyrics-view"
import type { ImportedSong } from "@/lib/import/clean"
import { parsePastedSheet, type PastedSong } from "@/lib/import/paste"
import { DIFFICULTY_LABEL, HINT_MAX, STATUS_LABEL, STYLE_LABEL, type Family } from "@/lib/songs"
import { createClient } from "@/lib/supabase/client"
import { addSongs, importScreenshot } from "./actions"

type Props = { userId: string; families: Family[] }
type Tab = "paste" | "screenshot" | "manual"

export function AddSong({ userId, families }: Props) {
  const [tab, setTab] = useState<Tab>("paste")
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="How to add" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
        {(
          [
            ["paste", "Paste chords"],
            ["screenshot", "Screenshot"],
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
      {tab === "paste" ? (
        <PasteImport families={families} />
      ) : tab === "manual" ? (
        <ManualForm families={families} />
      ) : (
        <ScreenshotImport userId={userId} families={families} />
      )}
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

function ManualForm({ families }: { families: Family[] }) {
  const router = useRouter()
  const [chords, setChords] = useState("")
  // null = follow the suggestion from the chords; a value = you picked one.
  const [picked, setPicked] = useState<string | null>(null)
  const familyId = picked ?? suggestedGroupId(chords, families)
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
      <GroupPicker groups={families} chords={chords} value={familyId} onChange={setPicked} />
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
      const pieces = await prepareScreenshot(file)

      const supabase = createClient()
      const stamp = Date.now()
      const paths: string[] = []
      for (const [i, blob] of pieces.entries()) {
        setStage({
          kind: "working",
          step: pieces.length > 1 ? `Uploading ${i + 1} of ${pieces.length}...` : "Uploading...",
        })
        const path = `${userId}/${stamp}-${i}.jpg`
        const { error: upErr } = await supabase.storage
          .from("screenshots")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false })
        if (upErr) {
          if (paths.length) await supabase.storage.from("screenshots").remove(paths)
          throw new Error("Upload failed. Check your connection and try again.")
        }
        paths.push(path)
      }

      setStage({ kind: "working", step: "Reading the chords (this can take up to a minute)..." })
      const res = await importScreenshot(paths)
      if (!res.ok) {
        setError(res.error)
        setStage({ kind: "pick" })
        return
      }
      setStage({
        kind: "review",
        songs: res.songs.map((s) => ({ ...s, include: !s.duplicate && !s.warning, status: "learning" })),
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
            {s.warning && (
              <p className="rounded-2xl bg-danger/15 px-3 py-2 text-sm text-danger" role="alert">
                {s.warning}
              </p>
            )}
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
            <GroupPicker
              groups={families}
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
        Best for a list of songs, like a screenshot of your notes app. The AI reads it, so check what it finds. For a
        full chord sheet from a website, use Paste chords instead: it is exact.
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

/**
 * Paste a chord sheet copied from a chord site. Read by the app itself (no AI),
 * so chords come out exactly as written, lined up over the words.
 */
function PasteImport({ families }: { families: Family[] }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [song, setSong] = useState<PastedSong | null>(null)
  const [status, setStatus] = useState<SongStatus>("learning")
  const [picked, setPicked] = useState<string | null>(null)
  const familyId = picked ?? (song ? suggestedGroupId(song.chords ?? "", families) : "")
  const [keepLyrics, setKeepLyrics] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function read() {
    setError(null)
    const parsed = parsePastedSheet(text)
    if (parsed.chordNames.length === 0) {
      setError("No chords found. Copy the lines with the chords on them too, not just the words.")
      return
    }
    setSong(parsed)
    setPicked(null)
    setKeepLyrics(parsed.lyricLines > 0)
  }

  function edit(patch: Partial<PastedSong>) {
    setSong((s) => (s ? { ...s, ...patch } : s))
  }

  function save(s: PastedSong) {
    setError(null)
    startTransition(async () => {
      const res = await addSongs([
        {
          title: s.title,
          artist: s.artist ?? "",
          status,
          difficulty: "",
          style: "",
          family_id: familyId,
          key_capo: s.key_capo ?? "",
          chords: s.chords ?? "",
          first_line_hint: "",
          tab_link: "",
          notes: "",
          lyrics: keepLyrics ? (s.lyrics ?? "") : "",
          needs_verify: false, // read by the app, not the AI
        },
      ])
      if (!res.ok) setError(res.error)
      else router.push(res.ids[0] ? `/repertoire/${res.ids[0]}` : "/repertoire")
    })
  }

  if (!song) {
    return (
      <div className="card flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-sm text-muted">
          <p>On Ultimate Guitar or any chord site, select the song from the title down to the last chord, copy, and paste it here.</p>
          <p>The app reads it itself (no AI), so the chords come out exactly as written, above the right words.</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"[Verse 1]\nG                Cadd9\nI know a girl..."}
          aria-label="Pasted chord sheet"
          className="field min-h-56 py-3 font-mono text-sm"
        />
        <button type="button" onClick={read} disabled={!text.trim()} className="btn-primary">
          Read it
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Found {song.chordNames.length} chord{song.chordNames.length === 1 ? "" : "s"}: {song.chordNames.join(", ")}
        {song.lyricLines > 0 ? `. ${song.lyricLines} lines of words.` : "."}
      </p>
      <section className="card flex flex-col gap-3">
        <Field label="Title">
          <input value={song.title} onChange={(e) => edit({ title: e.target.value })} required maxLength={200} className="field" />
        </Field>
        <Field label="Artist">
          <input value={song.artist ?? ""} onChange={(e) => edit({ artist: e.target.value })} maxLength={200} className="field" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key / capo">
            <input
              value={song.key_capo ?? ""}
              onChange={(e) => edit({ key_capo: e.target.value })}
              placeholder="Capo 3"
              maxLength={100}
              className="field"
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as SongStatus)} className="field">
              {SONG_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <GroupPicker groups={families} chords={song.chords ?? ""} value={familyId} onChange={setPicked} />
        <Field label="Chords by section">
          <textarea
            value={song.chords ?? ""}
            onChange={(e) => edit({ chords: e.target.value })}
            rows={4}
            maxLength={4000}
            className="field min-h-28 py-3 font-mono text-base"
          />
        </Field>
      </section>

      {song.lyrics && (
        <section className="card flex flex-col gap-3" aria-label="Lyrics preview">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={keepLyrics}
              onChange={(e) => setKeepLyrics(e.target.checked)}
              className="h-6 w-6 accent-[var(--accent)]"
            />
            <span className="font-medium">Keep the words with chords above them</span>
          </label>
          {keepLyrics && (
            <>
              <p className="text-xs text-muted">Private to your account. You can edit them later on the song page.</p>
              <div className="max-h-96 overflow-y-auto rounded-2xl bg-surface-2 p-3">
                <LyricsView text={song.lyrics} />
              </div>
            </>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSong(null)} disabled={pending} className="btn-ghost">
          Back to the text
        </button>
        <button type="button" onClick={() => save(song)} disabled={pending || !song.title.trim()} className="btn-primary">
          {pending ? "Saving..." : "Save song"}
        </button>
      </div>
    </div>
  )
}
