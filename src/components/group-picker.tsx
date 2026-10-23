"use client"

import { useMemo } from "react"
import { fitReason, suggestGroup } from "@/lib/theory"

export type PickerGroup = { id: string; name: string; key: string }

/**
 * "Which group?" A group is songs that share chord shapes, played as one set.
 * The app suggests one from the chords (its own chord logic, not AI) and you
 * confirm it with one tap or pick another. "Other" means no group.
 * Without chords there is nothing to match, so the song waits outside.
 */
export function GroupPicker({
  groups,
  chords,
  value,
  onChange,
}: {
  groups: PickerGroup[]
  chords: string
  /** Group id, or "" for Other. */
  value: string
  onChange: (id: string) => void
}) {
  const hasChords = chords.trim().length > 0
  const suggestion = useMemo(() => (hasChords ? suggestGroup(chords, groups) : null), [chords, groups, hasChords])
  const suggested = groups.find((g) => g.id === suggestion?.groupId)

  if (!hasChords) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">Group</span>
        <p className="rounded-2xl bg-surface-2 px-3 py-3 text-sm text-muted">
          Joins a group once you add its chords.
        </p>
      </div>
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-muted">Which group?</legend>
      <p className="text-sm">
        {suggested && suggestion ? (
          <>
            Looks like <span className="font-semibold">{suggested.name}</span> (key of {suggested.key}).{" "}
            <span className="text-muted">{fitReason(suggestion)}.</span>
          </>
        ) : (
          <span className="text-muted">These chords do not fit any group well, so Other is suggested.</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {[...groups.map((g) => ({ id: g.id, label: g.name })), { id: "", label: "Other" }].map((g) => {
          const selected = g.id === value
          const isSuggested = g.id === (suggested?.id ?? "")
          return (
            <button
              key={g.id || "other"}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(g.id)}
              className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold ${
                selected ? "border-accent bg-accent text-accent-fg" : "border-border"
              }`}
            >
              {g.label}
              {isSuggested && <span className="ml-1 text-xs font-medium opacity-80">(suggested)</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** The group to pre-select for some chords: the suggestion, else Other. */
export function suggestedGroupId(chords: string, groups: PickerGroup[]): string {
  return chords.trim() ? (suggestGroup(chords, groups)?.groupId ?? "") : ""
}
