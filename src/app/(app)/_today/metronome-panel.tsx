"use client"

import { useEffect, useRef, useState } from "react"
import { createLocalStore } from "@/lib/local-store"
import { MAX_BPM, MIN_BPM, Metronome, bpmFromTaps, clampBpm } from "@/lib/metronome"
import { useWakeLock } from "@/lib/use-wake-lock"

type Settings = { bpm: number; beatsPerBar: number; accent: boolean }
const BEATS = [2, 3, 4, 6]
const DEFAULTS: Settings = { bpm: 70, beatsPerBar: 4, accent: true }

// Last BPM and time signature, remembered on this device.
const settingsStore = createLocalStore<Settings>(
  "myjamm-metronome",
  (raw) => {
    const r = raw as Settings
    return typeof r?.bpm === "number" && BEATS.includes(r.beatsPerBar)
      ? { bpm: clampBpm(r.bpm), beatsPerBar: r.beatsPerBar, accent: r.accent !== false }
      : null
  },
  DEFAULTS,
)

export function MetronomePanel() {
  const settings = settingsStore.useValue()
  const { bpm, beatsPerBar, accent } = settings
  const engine = useRef<Metronome | null>(null)
  const taps = useRef<number[]>([])
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const wake = useWakeLock(running)

  const update = (next: Partial<Settings>) => settingsStore.set({ ...settings, ...next })

  // Live changes apply on the next click.
  useEffect(() => {
    if (!engine.current) return
    engine.current.bpm = bpm
    engine.current.beatsPerBar = beatsPerBar
    engine.current.accent = accent
  }, [bpm, beatsPerBar, accent])

  // Stop and release audio when leaving the screen.
  useEffect(() => () => void engine.current?.close(), [])

  async function toggle() {
    if (running) {
      engine.current?.stop()
      setRunning(false)
      setBeat(-1)
      return
    }
    engine.current ??= new Metronome()
    const m = engine.current
    m.bpm = bpm
    m.beatsPerBar = beatsPerBar
    m.accent = accent
    m.onBeat = setBeat
    await m.start()
    setRunning(true)
  }

  function tap() {
    const t = performance.now()
    taps.current = [...taps.current.slice(-5), t]
    const next = bpmFromTaps(taps.current)
    if (next) update({ bpm: next })
  }

  return (
    <section className="card flex flex-col gap-4" aria-label="Metronome">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Metronome</h2>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition-colors duration-75 ${
                i === beat ? (i === 0 && accent ? "bg-accent" : "bg-fg") : "bg-surface-2"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <StepButton label="Slower by 5" onClick={() => update({ bpm: clampBpm(bpm - 5) })}>
          −5
        </StepButton>
        <StepButton label="Slower by 1" onClick={() => update({ bpm: clampBpm(bpm - 1) })}>
          −1
        </StepButton>
        <div className="flex min-w-20 flex-col items-center">
          <span className="text-5xl font-bold tabular-nums">{bpm}</span>
          <span className="text-xs text-muted">BPM</span>
        </div>
        <StepButton label="Faster by 1" onClick={() => update({ bpm: clampBpm(bpm + 1) })}>
          +1
        </StepButton>
        <StepButton label="Faster by 5" onClick={() => update({ bpm: clampBpm(bpm + 5) })}>
          +5
        </StepButton>
      </div>

      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => update({ bpm: Number(e.target.value) })}
        aria-label="Tempo"
        className="h-8 w-full accent-[var(--accent)]"
      />

      <div className="flex items-center gap-2">
        <div role="group" aria-label="Beats per bar" className="flex flex-1 gap-1 rounded-2xl bg-bg p-1">
          {BEATS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={b === beatsPerBar}
              onClick={() => update({ beatsPerBar: b })}
              className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${
                b === beatsPerBar ? "bg-accent text-accent-fg" : "text-muted"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={accent}
          onClick={() => update({ accent: !accent })}
          className={`min-h-12 rounded-2xl border px-3 text-sm font-medium ${
            accent ? "border-accent text-accent" : "border-border text-muted"
          }`}
        >
          Accent 1
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={tap} className="btn-ghost min-h-14">
          Tap tempo
        </button>
        <button type="button" onClick={toggle} className="btn-primary">
          {running ? "Stop" : "Start"}
        </button>
      </div>

      {running && wake !== "on" && (
        <p className="text-xs text-muted">
          Keep the screen on: some phones pause sound when the screen locks.
        </p>
      )}
    </section>
  )
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-sm font-semibold"
    >
      {children}
    </button>
  )
}
