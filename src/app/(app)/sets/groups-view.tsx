"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { GroupPicker, suggestedGroupId, type PickerGroup } from "@/components/group-picker"
import { GROUP_KEYS } from "@/lib/group-keys"
import { STATUS_LABEL } from "@/lib/songs"
import type { SongStatus } from "@/lib/domain"
import { moveToGroup } from "../repertoire/actions"
import { createGroup, deleteGroup, saveGroupOrder } from "./group-actions"

export type ViewSong = {
  id: string
  title: string
  artist: string | null
  status: string
  key_capo: string | null
  chords: string | null
}
export type ViewGroup = PickerGroup & { vibe: string | null; songs: ViewSong[] }

type Props = { groups: ViewGroup[]; other: ViewSong[]; waiting: ViewSong[] }

/** Groups: songs that share chord shapes, each one a ready-made set. */
export function GroupsView({ groups, other, waiting }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const group = groups.find((g) => g.id === editing)

  if (group) {
    return <GroupEditor key={group.id} group={group} groups={groups} onDone={() => setEditing(null)} />
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Groups">
      <div>
        <h2 className="text-lg font-semibold">Groups</h2>
        <p className="text-sm text-muted">Songs that share chord shapes. Each group plays as a set, in your order.</p>
      </div>

      {groups.map((g) => (
        <article key={g.id} className="card flex flex-col gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{g.name}</h3>
            <p className="text-sm text-muted">
              Key of {g.key} · {g.songs.length} song{g.songs.length === 1 ? "" : "s"}
              {g.vibe ? ` · ${g.vibe}` : ""}
            </p>
          </div>
          {g.songs.length > 0 ? (
            <p className="text-sm">
              {g.songs
                .slice(0, 6)
                .map((s) => s.title)
                .join(" · ")}
              {g.songs.length > 6 ? ` · +${g.songs.length - 6} more` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted">No songs yet. Songs join when their chords fit this key.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {g.songs.length > 0 ? (
              <Link href={`/perform/family/${g.id}`} className="btn-primary min-h-12 text-base">
                Play
              </Link>
            ) : (
              <DeleteEmptyGroup id={g.id} />
            )}
            <button type="button" onClick={() => setEditing(g.id)} className="btn-ghost min-h-12">
              {g.songs.length > 1 ? "Order and edit" : "Edit"}
            </button>
          </div>
        </article>
      ))}

      {other.length > 0 && <OtherPile songs={other} groups={groups} />}

      {waiting.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Waiting for chords ({waiting.length})
          </summary>
          <p className="mt-2 text-sm text-muted">Add chords to these and the app will suggest a group.</p>
          <ul className="mt-2 flex flex-col">
            {waiting.map((s) => (
              <li key={s.id}>
                <Link href={`/repertoire/${s.id}`} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="truncate">{s.title}</span>
                  <span className="shrink-0 text-xs text-muted">Add chords</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <NewGroup />
    </section>
  )
}

function DeleteEmptyGroup({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteGroup(id)))}
      className="btn-ghost min-h-12 text-danger"
    >
      {pending ? "Deleting..." : "Delete group"}
    </button>
  )
}

/** Songs with chords that are in no group. Each gets a suggestion to confirm. */
function OtherPile({ songs, groups }: { songs: ViewSong[]; groups: PickerGroup[] }) {
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Other ({songs.length})</summary>
      <p className="mt-2 text-sm text-muted">
        Songs that do not fit a group. They stay here unless you move them.
      </p>
      <ul className="mt-3 flex flex-col gap-4">
        {songs.map((s) => (
          <OtherSong key={s.id} song={s} groups={groups} />
        ))}
      </ul>
    </details>
  )
}

function OtherSong({ song, groups }: { song: ViewSong; groups: PickerGroup[] }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const chords = song.chords ?? ""
  const suggestion = suggestedGroupId(chords, groups)

  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
      <Link href={`/repertoire/${song.id}`} className="font-medium">
        {song.title}
      </Link>
      <p className="truncate font-mono text-xs text-muted">{chords}</p>
      <GroupPicker groups={groups} chords={chords} value={value} onChange={setValue} />
      {value !== "" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await moveToGroup(song.id, value)
              if (!res.ok) setError(res.error)
            })
          }
          className="btn-primary"
        >
          {pending ? "Moving..." : `Move to ${groups.find((g) => g.id === value)?.name ?? "group"}`}
        </button>
      )}
      {value === "" && suggestion && (
        <p className="text-xs text-muted">Tap a group above to move it, or leave it in Other.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  )
}

/** Reorder a group's songs, or move one to another group or to Other. */
function GroupEditor({ group, groups, onDone }: { group: ViewGroup; groups: ViewGroup[]; onDone: () => void }) {
  const [songs, setSongs] = useState(group.songs)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function move(from: number, to: number) {
    if (to < 0 || to >= songs.length) return
    setSongs((list) => {
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setDirty(true)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await saveGroupOrder(group.id, songs.map((s) => s.id))
      if (res.ok) onDone()
      else setError(res.error)
    })
  }

  function moveOut(songId: string, target: string) {
    setError(null)
    startTransition(async () => {
      // Save the new order first so it is not lost, then move the song.
      if (dirty) {
        const saved = await saveGroupOrder(group.id, songs.map((s) => s.id))
        if (!saved.ok) return setError(saved.error)
        setDirty(false)
      }
      const res = await moveToGroup(songId, target || null)
      if (res.ok) setSongs((list) => list.filter((s) => s.id !== songId))
      else setError(res.error)
    })
  }

  return (
    <section className="card flex flex-col gap-4" aria-label={`Edit ${group.name}`}>
      <div>
        <h2 className="text-xl font-semibold">{group.name}</h2>
        <p className="text-sm text-muted">Key of {group.key}. Top to bottom is the order you play them.</p>
      </div>

      <ol className="flex flex-col">
        {songs.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 border-t border-border py-2 first:border-0">
            <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.title}</p>
              <p className="truncate text-xs text-muted">
                {[s.status !== "can_play" ? STATUS_LABEL[s.status as SongStatus] : null, s.key_capo]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Move ${s.title} up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, i - 1)}
                className="h-11 w-11 rounded-xl border border-border text-lg disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${s.title} down`}
                disabled={i === songs.length - 1 || pending}
                onClick={() => move(i, i + 1)}
                className="h-11 w-11 rounded-xl border border-border text-lg disabled:opacity-30"
              >
                ↓
              </button>
              <select
                aria-label={`Move ${s.title} to another group`}
                value={group.id}
                disabled={pending}
                onChange={(e) => moveOut(s.id, e.target.value)}
                className="h-11 w-11 rounded-xl border border-border bg-transparent text-center text-xs"
              >
                <option value={group.id}>⋯</option>
                {groups
                  .filter((g) => g.id !== group.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      Move to {g.name}
                    </option>
                  ))}
                <option value="">Move to Other</option>
              </select>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="sticky bottom-24 grid grid-cols-2 gap-2 bg-surface pt-2">
        <button type="button" onClick={onDone} disabled={pending} className="btn-ghost">
          {dirty ? "Cancel" : "Done"}
        </button>
        <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary">
          {pending ? "Saving..." : "Save order"}
        </button>
      </div>
    </section>
  )
}

function NewGroup() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [key, setKey] = useState<string>("E")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        + New group
      </button>
    )
  }

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await createGroup(name, key)
          if (res.ok) {
            setOpen(false)
            setName("")
          } else setError(res.error)
        })
      }}
    >
      <h3 className="font-semibold">New group</h3>
      <p className="text-sm text-muted">
        For songs in a key you do not have a group for yet. Use the chord shapes you play (capo not counted).
      </p>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E-A-B"
            maxLength={40}
            required
            className="field"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Key</span>
          <select value={key} onChange={(e) => setKey(e.target.value)} className="field">
            {GROUP_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creating..." : "Create group"}
        </button>
      </div>
    </form>
  )
}
