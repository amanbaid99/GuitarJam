"use client"

import { useState, useTransition } from "react"
import { LANGUAGE_LABEL, SONG_LANGUAGES, type SongLanguage } from "@/lib/song-languages"
import { isJamReady } from "@/lib/jam"
import { matchesFilters, NO_FILTERS, sortSongs, type Family, type Song } from "@/lib/songs"
import { tagSongs } from "./actions"
import { SongCard } from "./song-card"

type Filter = "all" | SongLanguage | "untagged"
const FILTERS = [["all", "All"], ["hindi", "Hindi"], ["english", "English"]] as const

export function RepertoireView({ families, songs, initiallyTagging = false }: { families: Family[]; songs: Song[]; initiallyTagging?: boolean }) {
  const [language, setLanguage] = useState<Filter>("all")
  const [known, setKnown] = useState(false)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"az" | "recent" | "key">("az")
  const [tagging, setTagging] = useState(initiallyTagging)
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()

  const visible = songs.filter((song) =>
    (language === "all" || (language === "untagged" ? !song.language : song.language === language)) &&
    matchesFilters(song, { ...NO_FILTERS, query }) &&
    (!known || isJamReady(song)),
  )
  const groups = sortSongs(visible, families, sort)
  const untagged = songs.filter((song) => !song.language).length

  function apply(next: SongLanguage | null) {
    setMessage("")
    startTransition(async () => {
      const result = await tagSongs(selected, next)
      if (!result.ok) { setMessage(result.error); return }
      setMessage(`Updated ${selected.length} song${selected.length === 1 ? "" : "s"}.`)
      setSelected([])
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title or artist" aria-label="Search songs" className="field" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Song language">
        {FILTERS.map(([value, label]) => (
          <button type="button" key={value} onClick={() => setLanguage(value)} aria-pressed={language === value}
            className="btn-ghost min-h-11 px-4 text-sm aria-pressed:border-accent aria-pressed:text-accent">{label}</button>
        ))}
        {tagging && <button type="button" onClick={() => setLanguage("untagged")} aria-pressed={language === "untagged"}
          className="btn-ghost min-h-11 px-4 text-sm aria-pressed:border-accent aria-pressed:text-accent">Untagged ({untagged})</button>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm">
        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={known} onChange={(event) => setKnown(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Songs I know
        </label>
        <button type="button" disabled={pending} onClick={() => {
          setTagging(!tagging)
          setSelected([])
          setMessage("")
          if (tagging && language === "untagged") setLanguage("all")
        }} className="min-h-11 text-accent">{tagging ? "Done tagging" : "Tag songs"}</button>
      </div>
      {tagging ? (
        <section className="sticky top-2 z-10 card flex flex-col gap-2 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>{selected.length ? `${selected.length} selected` : "Select songs to tag"}</p>
            <button type="button" className="min-h-11 text-accent" disabled={pending || !visible.length}
              onClick={() => setSelected(visible.map((song) => song.id))}>Select shown ({visible.length})</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SONG_LANGUAGES.map((item) => <button key={item} type="button" disabled={pending || !selected.length}
              onClick={() => apply(item)} className="btn-ghost min-h-11 px-3 text-sm">{LANGUAGE_LABEL[item]}</button>)}
            <button type="button" disabled={pending || !selected.length} onClick={() => apply(null)}
              className="btn-ghost min-h-11 px-3 text-sm">Clear tag</button>
          </div>
          <p role="status" className="text-sm text-muted">{pending ? "Saving tags…" : message}</p>
        </section>
      ) : (
        <div className="flex items-center justify-between gap-2 text-sm text-muted">
          <span>{visible.length} {visible.length === 1 ? "song" : "songs"}</span>
          <select aria-label="Sort songs" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}
            className="min-h-11 rounded-xl border border-border bg-surface px-2 text-fg">
            <option value="az">A to Z</option><option value="recent">Least played</option><option value="key">Playing key</option>
          </select>
        </div>
      )}
      {!visible.length && <p className="card text-muted">No songs match. Try All or clear your search.</p>}
      {groups.map((group) => (
        <section key={group.label ?? "songs"} className="flex flex-col gap-2">
          {group.label && <h2 className="px-1 text-sm font-semibold text-muted">{group.label}</h2>}
          <ul className="flex flex-col gap-2">
            {group.songs.map((song) => (
              <li key={song.id}>
                {tagging ? (
                  <label className="card flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                    <input type="checkbox" checked={selected.includes(song.id)} disabled={pending}
                      onChange={() => setSelected((current) => current.includes(song.id)
                        ? current.filter((id) => id !== song.id) : [...current, song.id])}
                      className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1">{song.title}{song.artist && <small className="block text-muted">{song.artist}</small>}</span>
                    <small className="text-muted">{song.language ? LANGUAGE_LABEL[song.language] : "Untagged"}</small>
                  </label>
                ) : <SongCard song={song} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
