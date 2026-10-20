"use client"

import { useMemo, useState } from "react"
import {
  capoOptions,
  extractChords,
  guessKey,
  keyName,
  numberOf,
  parseCapo,
  parseKey,
  prefersFlats,
  stripFretDiagrams,
  transposeKey,
  transposeText,
} from "@/lib/theory"

type Props = {
  chords: string
  keyCapo: string | null
  /** The family's key, when the song has a family. Otherwise the key is guessed. */
  familyKey: string | null
}

const MAX_CAPO = 9

/**
 * The chord chart with transpose and capo controls. All the maths comes from
 * the tested theory module; nothing here is AI.
 *
 * The chart is written as shapes. If key/capo says "Capo 3", those shapes sound
 * 3 semitones higher. Transpose moves the sound; capo picks which shapes to play.
 */
export function ChordTools({ chords, keyCapo, familyKey }: Props) {
  const baseCapo = Math.min(parseCapo(keyCapo), MAX_CAPO)
  const [open, setOpen] = useState(false)
  const [transpose, setTranspose] = useState(0)
  const [capo, setCapo] = useState(baseCapo)

  const writtenKey = useMemo(
    () => (familyKey ? parseKey(familyKey) : null) ?? guessKey(chords),
    [familyKey, chords],
  )

  const numbers = useMemo(() => {
    if (!writtenKey) return []
    return extractChords(chords)
      .map((c) => numberOf(c, writtenKey))
      .filter((n): n is string => Boolean(n))
  }, [chords, writtenKey])

  const soundingKey = writtenKey ? transposeKey(writtenKey, baseCapo + transpose) : null
  const shapesKey = soundingKey ? transposeKey(soundingKey, -capo) : null
  const shift = baseCapo + transpose - capo
  const changed = transpose !== 0 || capo !== baseCapo

  // When the shapes change, the original fret diagrams no longer apply, so hide them.
  const shapesMoved = shift % 12 !== 0
  const chart = shapesMoved
    ? stripFretDiagrams(transposeText(chords, shift, shapesKey ? prefersFlats(shapesKey) : false))
    : chords

  const suggestion = useMemo(() => {
    const sounding = transposeText(chords, baseCapo + transpose)
    const [best] = capoOptions(sounding, 7)
    if (!best || best.capo === capo) return null
    const current = capoOptions(sounding, MAX_CAPO).find((o) => o.capo === capo)
    return current && best.openShapes > current.openShapes ? best : null
  }, [chords, baseCapo, transpose, capo])

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-bg p-4 font-mono text-base leading-relaxed whitespace-pre-wrap">
        {chart}
      </div>

      {numbers.length > 0 && writtenKey && (
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">Numbers</span> in {keyName(writtenKey)}:{" "}
          {numbers.join(" · ")}
        </p>
      )}

      {writtenKey && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="btn-ghost min-h-11 justify-between text-sm"
          >
            <span>Transpose and capo</span>
            <span className="text-muted">
              {soundingKey && `Sounds in ${keyName(soundingKey)}`}
              {capo > 0 ? ` · capo ${capo}` : ""}
            </span>
          </button>

          {open && soundingKey && shapesKey && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <Stepper
                label="Transpose"
                value={transpose === 0 ? "Original" : `${transpose > 0 ? "+" : ""}${transpose}`}
                detail={`Key of ${keyName(soundingKey)}`}
                onMinus={() => setTranspose((t) => Math.max(-11, t - 1))}
                onPlus={() => setTranspose((t) => Math.min(11, t + 1))}
              />
              <Stepper
                label="Capo"
                value={capo === 0 ? "None" : `Fret ${capo}`}
                detail={`Play ${keyName(shapesKey)} shapes`}
                onMinus={() => setCapo((c) => Math.max(0, c - 1))}
                onPlus={() => setCapo((c) => Math.min(MAX_CAPO, c + 1))}
              />
              <div className="flex flex-wrap gap-2">
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => setCapo(suggestion.capo)}
                    className="min-h-11 rounded-full bg-accent/15 px-4 text-sm font-medium text-accent"
                  >
                    {suggestion.capo === 0 ? "Try no capo" : `Try capo ${suggestion.capo}`}:{" "}
                    {suggestion.openShapes} of {suggestion.total} open shapes
                  </button>
                )}
                {changed && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranspose(0)
                      setCapo(baseCapo)
                    }}
                    className="min-h-11 rounded-full border border-border px-4 text-sm"
                  >
                    Reset
                  </button>
                )}
              </div>
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
