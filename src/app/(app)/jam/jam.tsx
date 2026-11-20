"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { jamQueue, type JamMode, type JamSong } from "@/lib/jam"
import { createLocalStore } from "@/lib/local-store"
import { LANGUAGE_LABEL } from "@/lib/song-languages"
import { Deck, type DeckSong } from "../../perform/deck"
import { saveSet } from "../sets/actions"

type ReadySong = JamSong & DeckSong
const MODES = ["mixed", "hindi", "english"] as const
type Openers = Partial<Record<JamMode, string>>

export function Jam({ songs, accountId }: { songs: ReadySong[]; accountId: string }) {
  const store = useMemo(() => createLocalStore<Openers>(`myjamm-openers-${accountId}`, (raw) => {
    if (!raw || typeof raw !== "object") return null
    return Object.fromEntries(Object.entries(raw).filter(([key, value]) =>
      MODES.some((mode) => key === mode) && typeof value === "string"))
  }, {}), [accountId])
  const pinned = store.useValue()
  const [mode, setMode] = useState<JamMode>("mixed")
  const [opener, setOpener] = useState("")
  const [playing, setPlaying] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveResult, setSaveResult] = useState<{ id?: string; error?: string }>({})
  const [saving, startSaving] = useTransition()
  const available = songs.filter((song) => mode === "mixed" || song.language === mode)
  const queue = jamQueue(songs, mode, opener || pinned[mode])
  const active = queue[0]

  function saveJam(form: FormData) {
    const name = String(form.get("name") ?? "").trim()
    if (!name) return
    setSaveResult({})
    startSaving(async () => {
      const result = await saveSet({ name, song_ids: queue.map((song) => song.id) })
      setSaveResult(result.ok ? { id: result.id } : { error: result.error })
    })
  }

  if (playing && active) return (
    <Deck title={`${LANGUAGE_LABEL[mode]} jam`} songs={queue} backHref="/jam" onExit={() => setPlaying(false)} jam />
  )

  return (
    <>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Jam language">
        {MODES.map((item) => (
          <button key={item} type="button" aria-pressed={mode === item} disabled={saving} onClick={() => {
            setMode(item)
            setOpener("")
            setSaveResult({})
          }} className="btn-ghost px-2 aria-pressed:border-accent aria-pressed:text-accent">{LANGUAGE_LABEL[item]}</button>
        ))}
      </div>
      {active ? (
        <section className="card flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-accent">Opener</p>
            <h2 className="text-2xl font-bold">{active.title}</h2>
            <p className="text-sm text-muted">{active.play}</p>
          </div>
          <button type="button" onClick={() => setPlaying(true)} className="btn-primary">Play jam</button>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Change opener
            <select value={active.id} disabled={saving} onChange={(event) => {
              setOpener(event.target.value)
              setSaveResult({})
            }} className="field">
              {available.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
            </select>
          </label>
          <button type="button" aria-pressed={pinned[mode] === active.id} className="btn-ghost"
            onClick={() => store.set({ ...pinned, [mode]: pinned[mode] === active.id ? undefined : active.id })}>
            {pinned[mode] === active.id ? "Unpin opener" : "Pin opener on this device"}
          </button>
          {queue.length > 1 && (
            <div className="border-t border-border pt-3">
              <h3 className="mb-2 text-sm font-semibold text-muted">Up next</h3>
              <ol className="flex flex-col gap-2">
              {queue.slice(1, 4).map((song, i) => (
                <li key={song.id} className="flex justify-between gap-2 text-sm">
                  <span>{song.title}</span>
                  {song.capo !== queue[i].capo && <span className="shrink-0 text-accent">{song.capo ? `Capo ${song.capo}` : "Remove capo"}</span>}
                </li>
              ))}
              </ol>
            </div>
          )}
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-medium">Save this order as a set</summary>
            <form action={saveJam} className="mt-3 flex flex-col gap-2">
              <input name="name" value={saveName} onChange={(event) => setSaveName(event.target.value)} maxLength={60}
                required aria-label="Set name" placeholder={`${LANGUAGE_LABEL[mode]} jam`} className="field" />
              <button type="submit" disabled={saving || !saveName.trim()} className="btn-ghost">Save set</button>
              {saveResult.error && <p role="alert" className="text-sm text-danger">{saveResult.error}</p>}
              {saveResult.id && <Link href={`/perform/set/${saveResult.id}`} className="text-accent">Open saved set</Link>}
            </form>
          </details>
        </section>
      ) : (
        <section className="card flex flex-col gap-3">
          <p>{songs.length ? `No ${LANGUAGE_LABEL[mode]} songs tagged and ready to play.` : "Mark a few songs Can play or Polished to start a jam."}</p>
          <Link href={songs.length ? "/repertoire?tag=1" : "/repertoire"} className="btn-primary">{songs.length ? "Tag songs" : "Go to Songs"}</Link>
          {songs.length > 0 && <button type="button" onClick={() => { setMode("mixed"); setOpener("") }} className="btn-ghost">Play a mixed jam</button>}
        </section>
      )}
    </>
  )
}
