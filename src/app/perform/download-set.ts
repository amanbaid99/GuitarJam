import type { DeckSong } from "./deck"

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}

/** An offline copy opens in any browser and needs no cached account or app assets. */
export function downloadSet(title: string, songs: DeckSong[]) {
  const headings = songs.map((song, index) =>
    `<li><a href="#song-${index + 1}">${escapeHtml(song.title)}</a></li>`,
  ).join("")
  const charts = songs.map((song, index) => {
    const chart = [song.chords, song.lyrics].filter(Boolean).join("\n\n") || "No chart saved."
    return `<section id="song-${index + 1}"><h2>${escapeHtml(song.title)}</h2><p>${escapeHtml(song.play ?? "")}</p>${song.hint ? `<p>${escapeHtml(song.hint)}</p>` : ""}<pre>${escapeHtml(chart)}</pre><a href="#songs">Back to song list</a></section>`
  }).join("")
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
  html{color-scheme:light dark}body{font:1.125rem system-ui;max-width:42rem;padding:1rem;margin:auto}a{display:inline-block;padding:.5rem 0}section{border-top:1px solid gray;margin:2rem 0;padding-top:1rem}pre{font-size:1.1rem;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
  </style><h1 id="songs">${escapeHtml(title)}</h1><ol>${headings}</ol>${charts}</html>`
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `${title.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "my-jamm-set"}.html`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
