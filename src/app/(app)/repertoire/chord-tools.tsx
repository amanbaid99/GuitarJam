"use client"

import { useMemo, useState, useTransition } from "react"
import { LyricsView } from "@/components/lyrics-view"
import { chartView, playLabel } from "@/lib/song-view"
import { capoOptions, extractChords, keyName, numberOf, transposeText } from "@/lib/theory"

type Props = {
  chords: string | null
  lyrics: string | null
  keyCapo: string | null
  familyKey: string | null
  savedTranspose: number
  savedCapo: number | null
  /** Saves the current transpose and capo as "my version". */
  onSave?: (transpose: number, capo: number | null) => Promise<{ ok: boolean; error?: string }>
}

const MAX_CAPO = 9

/**
 * Chords (and your lyrics) as you play them, with transpose and capo.
 * All maths comes from the tested theory module; nothing here is AI.
 */
export function ChordTools({ chords, lyrics, keyCapo, familyKey, savedTranspose, savedCapo, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [transpose, setTranspose] = useState(savedTranspose)
  const [capo, setCapo] = useState<number | null>(savedCapo)
  const [saved, setSaved] = useState({ transpose: savedTranspose, capo: savedCapo })
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const view = chartView({ chords, lyrics, keyCapo, familyKey, transpose, capo })
  const original = chartView({ chords, lyrics, keyCapo, familyKey, transpose: 0, capo: null })
  const effectiveCapo = capo ?? view.baseCapo
  const isSaved = transpose === saved.transpose && effectiveCapo === (saved.capo ?? view.baseCapo)
  const isOriginal = transpose === 0 && effectiveCapo === view.baseCapo

  const numbers = useMemo(() => {
    const key = original.writtenKey
    if (!key) return []
    const text = [chords, lyrics?.match(/\[[^\]]+\]/g)?.join(" ")].filter(Boolean).join(" ")
    return extractChords(text)
      .map((c) => numberOf(c, key))
      .filter((n): n is string => Boolean(n))
  }, [chords, lyrics, original.writtenKey])

  const suggestion = useMemo(() => {
    const source = [chords, lyrics?.match(/\[[^\]]+\]/g)?.join(" ")].filter(Boolean).join(" ")
    if (!source) return null
    const sounding = transposeText(source, view.baseCapo + transpose)
    const options = capoOptions(sounding, MAX_CAPO)
    const [best] = capoOptions(sounding, 7)
    const current = options.find((o) => o.capo === effectiveCapo)
    return best && current && best.capo !== effectiveCapo && best.openShapes > current.openShapes ? best : null
  }, [chords, lyrics, view.baseCapo, transpose, effectiveCapo])

  function save(nextTranspose: number, nextCapo: number | null) {
    if (!onSave) return
    setMessage(null)
    startTransition(async () => {
      const res = await onSave(nextTranspose, nextCapo)
      if (res.ok) {
        setSaved({ transpose: nextTranspose, capo: nextCapo })
        setMessage("Saved as your version.")
      } else setMessage(res.error ?? "Could not save.")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {view.shapesKey && (
        <p className="text-sm font-medium">
          {playLabel(view)}
          {!isOriginal && isSaved && <span className="ml-2 text-xs text-accent">My version</span>}
        </p>
      )}

      {view.chords && (
        <div className="rounded-2xl bg-bg p-4 font-mono text-base leading-relaxed whitespace-pre-wrap">
          {view.chords}
        </div>
      )}

      {view.lyrics && (
        <div className="rounded-2xl bg-bg p-4">
          <LyricsView text={view.lyrics} />
        </div>
      )}

      {numbers.length > 0 && original.writtenKey && (
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">Numbers</span> in {keyName(original.writtenKey)}: {numbers.join(" · ")}
        </p>
      )}

      {view.soundingKey && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="btn-ghost min-h-11 justify-between text-sm"
          >
            <span>Transpose and capo</span>
            <span className="text-muted">{open ? "Hide" : "Change"}</span>
          </button>

          {open && view.shapesKey && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <Stepper
                label="Transpose"
                value={transpose === 0 ? "Original key" : `${transpose > 0 ? "+" : ""}${transpose}`}
                detail={`Sounds in ${keyName(view.soundingKey)}`}
                onMinus={() => setTranspose((t) => Math.max(-11, t - 1))}
                onPlus={() => setTranspose((t) => Math.min(11, t + 1))}
              />
              <Stepper
                label="Capo"
                value={effectiveCapo === 0 ? "None" : `Fret ${effectiveCapo}`}
                detail={`Play ${keyName(view.shapesKey)} shapes`}
                onMinus={() => setCapo(Math.max(0, effectiveCapo - 1))}
                onPlus={() => setCapo(Math.min(MAX_CAPO, effectiveCapo + 1))}
              />
              <div className="flex flex-wrap gap-2">
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => setCapo(suggestion.capo)}
                    className="min-h-11 rounded-full bg-accent/15 px-4 text-sm font-medium text-accent"
                  >
                    {suggestion.capo === 0 ? "Try no capo" : `Try capo ${suggestion.capo}`}: {suggestion.openShapes} of{" "}
                    {suggestion.total} open shapes
                  </button>
                )}
                {!isOriginal && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranspose(0)
                      setCapo(null)
                    }}
                    className="min-h-11 rounded-full border border-border px-4 text-sm"
                  >
                    Original
                  </button>
                )}
              </div>
              {onSave && (
                <button
                  type="button"
                  onClick={() => save(transpose, capo === view.baseCapo ? null : capo)}
                  disabled={pending || isSaved}
                  className="btn-primary min-h-12 text-base"
                >
                  {pending ? "Saving..." : isSaved ? "This is your version" : "Save as my version"}
                </button>
              )}
              {message && (
                <p className="text-sm text-muted" role="status">
                  {message}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stepper({
  label,
  value,
  detail,
  onMinus,
  onPlus,
}: {
  label: string
  value: string
  detail: string
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onMinus}
        aria-label={`${label} down`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-2xl"
      >
        −
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="text-xs text-muted">{label}</div>
        <div className="font-semibold tabular-nums">{value}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
      <button
        type="button"
        onClick={onPlus}
        aria-label={`${label} up`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-2xl"
      >
        +
      </button>
    </div>
  )
}
