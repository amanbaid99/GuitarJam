"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { DIFFICULTIES, SONG_STATUSES, STYLES } from "@/lib/domain"
import { createLocalStore } from "@/lib/local-store"
import {
  DIFFICULTY_LABEL,
  NO_FILTERS,
  SORT_LABEL,
  SORT_MODES,
  STATUS_LABEL,
  STYLE_LABEL,
  groupByFamily,
  matchesFilters,
  sortSongs,
  type Family,
  type Song,
  type SongFilters,
  type SortMode,
} from "@/lib/songs"
import { SongCard } from "./song-card"

type Props = { families: Family[]; songs: Song[]; today: string }

// Your last sort, remembered on this device.
const sortStore = createLocalStore<SortMode>(
  "myjamm-song-sort",
  (raw) => (SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : null),
  "family",
)

export function RepertoireView({ families, songs, today }: Props) {
  const [filters, setFilters] = useState<SongFilters>(NO_FILTERS)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [moreFilters, setMoreFilters] = useState(false)
  const sort = sortStore.useValue()

  const filtering =
    filters.status !== "all" ||
    filters.difficulty !== "all" ||
    filters.style !== "all" ||
    filters.query.trim() !== ""

  const visible = useMemo(() => songs.filter((s) => matchesFilters(s, filters)), [songs, filters])
  const groups = useMemo(
    () => groupByFamily(families, visible).filter((g) => g.songs.length > 0 || (!filtering && g.family)),
    [families, visible, filtering],
  )
  const sortedGroups = useMemo(
    () => (sort === "family" ? [] : sortSongs(visible, families, sort)),
    [sort, visible, families],
  )

  // Songs per family that appear in Performance mode (everything but "want to learn").
  const playable = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) {
      if (s.family_id && s.status !== "want_to_learn") {
        counts.set(s.family_id, (counts.get(s.family_id) ?? 0) + 1)
      }
    }
    return counts
  }, [songs])

  if (songs.length === 0) {
    return (
      <p className="card text-muted">
        No songs yet. Tap Add song to type one in or import a screenshot.
      </p>
    )
  }

  const set = <K extends keyof SongFilters>(key: K, value: SongFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search title or artist"
          aria-label="Search songs"
          className="field"
        />
        <ChipRow
          label="Status"
          value={filters.status}
          options={[["known", "Songs I know"], ...SONG_STATUSES.map((s) => [s, STATUS_LABEL[s]] as [typeof s, string])]}
          onChange={(v) => set("status", v)}
        />
        <div role="group" aria-label="Sort" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
          <span className="shrink-0 text-sm text-muted">Sort</span>
          {SORT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === sort}
              onClick={() => sortStore.set(m)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${
                m === sort ? "border-fg bg-fg text-bg" : "border-border"
              }`}
            >
              {SORT_LABEL[m]}
            </button>
          ))}
        </div>
        {moreFilters && (
          <>
            <ChipRow
              label="Difficulty"
              value={filters.difficulty}
              options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]])}
              onChange={(v) => set("difficulty", v)}
            />
            <ChipRow
              label="Style"
              value={filters.style}
              options={STYLES.map((s) => [s, STYLE_LABEL[s]])}
              onChange={(v) => set("style", v)}
            />
          </>
        )}
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {filtering ? `${visible.length} of ${songs.length} songs` : `${songs.length} songs`}
          </span>
          <span className="flex items-center">
            <button type="button" onClick={() => setMoreFilters((m) => !m)} className="min-h-11 px-2 text-muted">
              {moreFilters ? "Fewer filters" : "More filters"}
            </button>
            {filtering && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className="min-h-11 px-2 text-accent">
                Clear
              </button>
            )}
          </span>
        </div>
      </div>

      {visible.length === 0 && <p className="card text-muted">No songs match these filters.</p>}

      {sort !== "family" &&
        sortedGroups.map((group, i) => (
          <section key={group.label ?? i} className="flex flex-col gap-2">
            {group.label && (
              <h2 className="flex items-center justify-between px-1 pt-2 text-sm font-semibold text-muted">
                <span>{group.label}</span>
                <span className="tabular-nums">{group.songs.length}</span>
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {group.songs.map((song) => (
                <li key={song.id}>
                  <SongCard song={song} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {sort === "family" && groups.map((group) => {
        const key = group.family?.id ?? "unassigned"
        // While filtering, show every matching group open so results are visible.
        const isOpen = filtering || (open[key] ?? false)
        return (
          <section key={key} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex min-h-16 w-full items-center gap-3 rounded-3xl border border-border bg-surface-2 px-5 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{group.family?.name ?? "Unassigned"}</div>
                {group.family ? (
                  <div className="truncate text-sm text-muted">
                    Key of {group.family.key} · {group.family.numbers}
                    {group.family.vibe ? ` · ${group.family.vibe}` : ""}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Songs without a family</div>
                )}
              </div>
              <span className="rounded-full bg-bg px-3 py-1 text-sm tabular-nums text-muted">
                {group.songs.length}
              </span>
              <Chevron open={isOpen} />
            </button>
            {isOpen && group.family && (playable.get(group.family.id) ?? 0) > 0 && (
              <Link
                href={`/perform/family/${group.family.id}`}
                className="btn-primary min-h-12 text-base"
              >
                Play medley ({playable.get(group.family.id)} songs)
              </Link>
            )}
            {isOpen && (
              <ul className="flex flex-col gap-2">
                {group.songs.map((song) => (
                  <li key={song.id}>
                    <SongCard song={song} today={today} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | "all"
  options: [T, string][]
  onChange: (v: T | "all") => void
}) {
  const all: [T | "all", string][] = [["all", "All"], ...options]
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {all.map(([v, text]) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              active ? "border-accent bg-accent text-accent-fg" : "border-border text-fg"
            }`}
          >
            {v === "all" ? `${label}: All` : text}
          </button>
        )
      })}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
