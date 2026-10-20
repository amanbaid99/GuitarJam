import Link from "next/link"
import type { SongStatus } from "@/lib/domain"
import { DIFFICULTY_LABEL, STATUS_LABEL, STYLE_LABEL, lastPractisedLabel, type Song } from "@/lib/songs"

export const STATUS_TONE: Record<SongStatus, string> = {
  want_to_learn: "bg-surface-2 text-muted",
  learning: "bg-accent/15 text-accent",
  can_play: "bg-ok/15 text-ok",
  polished: "bg-ok text-bg",
}

type Props = {
  song: Song
  today: string
  /** Extra line under the title, e.g. the key when sorting by key. */
  detail?: string | null
}

/** One song in the list. Tap to open its page. */
export function SongCard({ song, today, detail }: Props) {
  const status = song.status as SongStatus
  const meta = [
    song.difficulty && DIFFICULTY_LABEL[song.difficulty as keyof typeof DIFFICULTY_LABEL],
    song.style && STYLE_LABEL[song.style as keyof typeof STYLE_LABEL],
    song.key_capo,
  ].filter(Boolean)

  return (
    <Link href={`/repertoire/${song.id}`} className="card flex items-start gap-3 p-4 active:scale-[0.99]">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-snug font-semibold">{song.title}</h3>
        {song.artist && <p className="truncate text-sm text-muted">{song.artist}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {detail ?? meta.join(" · ")}
          {song.lyrics && <span>· Lyrics</span>}
          {song.needs_verify && (
            <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">Check chords</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">Played: {lastPractisedLabel(song.last_practised, today)}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
        {STATUS_LABEL[status]}
      </span>
    </Link>
  )
}
