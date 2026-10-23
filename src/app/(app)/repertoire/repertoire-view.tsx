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

type Props = { families: Family[]; songs: Song[] }

// Your last sort, remembered on this device. A to Z unless you pick another.
const sortStore = createLocalStore<SortMode>(
  "myjamm-song-sort-v2",
  (raw) => (SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : null),
  "az",
)

export function RepertoireView({ families, songs }: Props) {
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

  // Songs per group (all of them play, in your order).
  const playable = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) {
      if (s.family_id) {
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
        <div className="grid grid-cols-2 gap-2">
          <Dropdown
            label="Show"
            value={filters.status}
            onChange={(v) => set("status", v as SongFilters["status"])}
            options={[
              ["all", "All songs"],
              ["known", "Songs I know"],
              ...SONG_STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string]),
            ]}
          />
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(v) => sortStore.set(v as SortMode)}
            options={SORT_MODES.map((m) => [m, SORT_LABEL[m]] as [string, string])}
          />
        </div>
        {moreFilters && (
          <div className="grid grid-cols-2 gap-2">
            <Dropdown
              label="Difficulty"
              value={filters.difficulty}
              onChange={(v) => set("difficulty", v as SongFilters["difficulty"])}
              options={[["all", "Any"], ...DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]] as [string, string])]}
            />
            <Dropdown
              label="Style"
              value={filters.style}
              onChange={(v) => set("style", v as SongFilters["style"])}
              options={[["all", "Any"], ...STYLES.map((st) => [st, STYLE_LABEL[st]] as [string, string])]}
            />
          </div>
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
                  <SongCard song={song} />
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
                <div className="text-lg font-semibold">{group.family?.name ?? "Other"}</div>
                {group.family ? (
                  <div className="truncate text-sm text-muted">
                    Key of {group.family.key}
                    {group.family.vibe ? ` · ${group.family.vibe}` : ""}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Songs without a group</div>
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
                Play this group ({playable.get(group.family.id)} songs)
              </Link>
            )}
            {isOpen && (
              <ul className="flex flex-col gap-2">
                {group.songs.map((song) => (
                  <li key={song.id}>
                    <SongCard song={song} />
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

/** A labelled native dropdown: big tap target, phone-native picker. */
function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (v: string) => void
}) {
  return (
    <label className="relative flex flex-col">
      <span className="pointer-events-none absolute top-1.5 left-4 text-[11px] font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-14 w-full appearance-none rounded-2xl border border-border bg-surface pt-5 pr-10 pl-4 text-base font-medium text-fg outline-none focus:border-accent"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
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
