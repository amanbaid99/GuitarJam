// Theme choices are per device (saved in this browser), applied before first paint.

export const BACKGROUNDS = [
  { id: "black", label: "Black", swatch: "#0d0f12", chrome: "#0d0f12" },
  { id: "white", label: "White", swatch: "#ffffff", chrome: "#ffffff" },
  { id: "beige", label: "Beige", swatch: "#f1e8d6", chrome: "#f1e8d6" },
] as const

// Swatches show the shade used on black; light backgrounds get a deeper shade for contrast.
export const ACCENTS = [
  { id: "amber", label: "Amber", swatch: "#f2a541" },
  { id: "teal", label: "Teal", swatch: "#2dd4bf" },
  { id: "rose", label: "Rose", swatch: "#fb7185" },
  { id: "violet", label: "Violet", swatch: "#a78bfa" },
  { id: "blue", label: "Blue", swatch: "#60a5fa" },
  { id: "green", label: "Green", swatch: "#4ade80" },
] as const

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"]
export type AccentId = (typeof ACCENTS)[number]["id"]

export const DEFAULT_BG: BackgroundId = "black"
export const DEFAULT_ACCENT: AccentId = "amber"

export const THEME_STORAGE_KEY = "myjamm-theme"

export type ThemeChoice = { bg: BackgroundId; accent: AccentId }

const CHROME = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b.chrome]))

/** Applies a theme to <html> and the browser's toolbar colour. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  root.dataset.bg = choice.bg
  root.dataset.accent = choice.accent
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CHROME[choice.bg])
}

/**
 * Inline script for <head>: applies the saved theme before the page paints,
 * so there is no flash of the wrong colours. Must stay dependency free.
 */
export const THEME_INIT_SCRIPT = `(function(){
  var bgs=${JSON.stringify(Object.keys(CHROME))};
  var accents=${JSON.stringify(ACCENTS.map((a) => a.id))};
  var chrome=${JSON.stringify(CHROME)};
  var t={};
  try{t=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"{}")||{}}catch(e){}
  var bg=bgs.indexOf(t.bg)>=0?t.bg:${JSON.stringify(DEFAULT_BG)};
  var ac=accents.indexOf(t.accent)>=0?t.accent:${JSON.stringify(DEFAULT_ACCENT)};
  var r=document.documentElement;r.dataset.bg=bg;r.dataset.accent=ac;
  function meta(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",chrome[bg])}
  meta();document.addEventListener("DOMContentLoaded",meta);
})();`

export function readTheme(): ThemeChoice {
  const root = document.documentElement
  const bg = (BACKGROUNDS.find((b) => b.id === root.dataset.bg)?.id ?? DEFAULT_BG) as BackgroundId
  const accent = (ACCENTS.find((a) => a.id === root.dataset.accent)?.id ?? DEFAULT_ACCENT) as AccentId
  return { bg, accent }
}

export function saveTheme(choice: ThemeChoice) {
  applyTheme(choice)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(choice))
  } catch {
    // Private mode or storage blocked: the theme still applies for this visit.
  }
}
