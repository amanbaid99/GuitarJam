"use client"

import { useSyncExternalStore } from "react"
import {
  ACCENTS,
  BACKGROUNDS,
  DEFAULT_ACCENT,
  DEFAULT_BG,
  readTheme,
  saveTheme,
  type ThemeChoice,
} from "@/lib/theme"

// The current theme lives on <html> (set by the head script and by saveTheme).
// Follow it as an external store so this always shows what is applied.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bg", "data-accent"] })
  return () => observer.disconnect()
}
const snapshot = () => {
  const t = readTheme()
  return `${t.bg}|${t.accent}`
}
const serverSnapshot = () => `${DEFAULT_BG}|${DEFAULT_ACCENT}`

export function ThemePicker() {
  const [bg, accent] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split("|")
  const choice = { bg, accent } as ThemeChoice

  function pick(next: Partial<ThemeChoice>) {
    saveTheme({ ...choice, ...next })
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Background</legend>
        <div className="grid grid-cols-3 gap-3">
          {BACKGROUNDS.map((b) => {
            const active = choice.bg === b.id
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => pick({ bg: b.id })}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition ${
                  active ? "border-accent" : "border-border"
                }`}
              >
                <span
                  className="h-14 w-full rounded-xl border border-border"
                  style={{ background: b.swatch }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{b.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Accent colour</legend>
        <div className="grid grid-cols-3 gap-3">
          {ACCENTS.map((a) => {
            const active = choice.accent === a.id
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => pick({ accent: a.id })}
                data-accent={a.id}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 transition ${
                  active ? "border-accent" : "border-border"
                }`}
              >
                {/* data-accent on the button defines --accent-on-dark/light here, so each swatch
                    shows its own colour in the shade used on the current background. */}
                <span
                  className="h-7 w-7 shrink-0 rounded-full"
                  style={{ background: `var(--accent-on-${choice.bg === "black" ? "dark" : "light"})` }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <section className="card flex flex-col gap-3" aria-label="Preview">
        <p className="text-sm text-muted">Preview</p>
        <p className="text-lg font-semibold">
          Yellow <span className="text-accent">· Capo 4</span>
        </p>
        <button type="button" className="btn-primary">
          Plan my session
        </button>
      </section>

      <p className="text-sm text-muted">Saved on this device.</p>
    </div>
  )
}
