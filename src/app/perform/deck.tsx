"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { LyricsView } from "@/components/lyrics-view"
import { useWakeLock } from "@/lib/use-wake-lock"

export type DeckSong = {
  id: string
  title: string
  family: string | null
  /** How to play it: "Capo 4 · G shapes · sounds in B". */
  play: string | null
  chords: string | null
  /** Your lyrics, chords inline, already in your key. */
  lyrics: string | null
  hint: string | null
}

/** Each sentence on its own line, so "Verse: ..." and "Chorus: ..." start fresh. */
function forStage(chart: string): string {
  return chart.replace(/\.\s+(?=\S)/g, ".\n")
}

export function Deck({ title, songs, backHref }: { title: string; songs: DeckSong[]; backHref: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const wake = useWakeLock()

  const goTo = useCallback(
    (i: number) => {
      const el = scroller.current
      if (!el) return
      const next = Math.max(0, Math.min(songs.length - 1, i))
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" })
    },
    [songs.length],
  )

  // Track the current card from the scroll position (works for swipes and buttons).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // Arrow keys and page turner pedals (which usually send arrows or Page Up/Down).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault()
        goTo(index + 1)
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault()
        goTo(index - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goTo, index])

  if (songs.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xl">No playable songs here yet.</p>
        <p className="text-muted">Songs marked Learning, Can play or Polished show up in Performance mode.</p>
        <Link href={backHref} className="btn-ghost">
          Back
        </Link>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-bg text-fg">
      <header
        className="flex items-center gap-3 px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <Link
          href={backHref}
          aria-label="Exit performance mode"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1 truncate text-sm text-muted">{title}</div>
        <div className="shrink-0 text-sm tabular-nums text-muted" aria-live="polite">
          {index + 1} / {songs.length}
        </div>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${wake === "on" ? "bg-ok" : "bg-border"}`}
          title={
            wake === "on"
              ? "Screen will stay on"
              : wake === "unsupported"
                ? "This browser cannot keep the screen on"
                : "Screen may sleep"
          }
          aria-label={wake === "on" ? "Screen will stay on" : "Screen may sleep"}
        />
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {songs.map((song, i) => (
          <section
            key={song.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${songs.length}: ${song.title}`}
            className="flex h-full w-full shrink-0 snap-center flex-col gap-5 overflow-y-auto px-6 pt-4 pb-8"
          >
            <div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">{song.title}</h1>
              <p className="mt-2 text-xl text-muted">
                {[song.family, song.play].filter(Boolean).join(" · ")}
              </p>
            </div>
            {song.hint && <p className="text-2xl italic text-accent">&ldquo;{song.hint}&rdquo;</p>}
            {song.chords && (
              <p
                className={`font-mono leading-snug font-semibold whitespace-pre-wrap ${
                  song.lyrics ? "text-xl text-muted sm:text-2xl" : song.chords.length > 120 ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl"
                }`}
              >
                {forStage(song.chords)}
              </p>
            )}
            {song.lyrics && <LyricsView text={song.lyrics} size="stage" />}
            {!song.chords && !song.lyrics && <p className="text-2xl text-muted">No chords saved.</p>}
          </section>
        ))}
      </div>

      <nav
        className="grid grid-cols-2 gap-3 px-3 pt-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        aria-label="Song navigation"
      >
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="btn-ghost min-h-16 text-lg disabled:opacity-30"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === songs.length - 1}
          className="btn-primary min-h-16 disabled:opacity-30"
        >
          {index < songs.length - 1 ? (
            <span className="flex min-w-0 flex-col items-center leading-tight">
              <span>Next</span>
              <span className="w-full truncate text-sm font-medium opacity-80">{songs[index + 1].title}</span>
            </span>
          ) : (
            "Last song"
          )}
        </button>
      </nav>
    </main>
  )
}
