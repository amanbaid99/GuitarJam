import { parseLyrics } from "@/lib/theory"

/**
 * Your lyrics with each chord sitting above the word it lands on.
 * Works on the server and the client (no hooks).
 */
export function LyricsView({ text, size = "md" }: { text: string; size?: "md" | "stage" }) {
  const lines = parseLyrics(text)
  const word = size === "stage" ? "text-2xl sm:text-3xl" : "text-base"
  const chord = size === "stage" ? "text-xl sm:text-2xl" : "text-sm"
  const heading = size === "stage" ? "text-lg" : "text-xs"

  return (
    <div className="flex flex-col">
      {lines.map((line, i) => {
        if (line.kind === "blank") return <div key={i} className="h-4" aria-hidden="true" />
        if (line.kind === "heading") {
          return (
            <p key={i} className={`mt-2 mb-1 font-semibold tracking-wide text-muted uppercase ${heading}`}>
              {line.text}
            </p>
          )
        }
        return (
          <p key={i} className={`flex flex-wrap items-end leading-tight ${word}`}>
            {line.segments.map((seg, j) => (
              <span key={j} className="inline-flex flex-col">
                {line.hasChords && (
                  <span className={`min-h-[1.3em] pr-1 font-mono font-bold text-accent ${chord}`}>
                    {seg.chord ?? " "}
                  </span>
                )}
                <span className="whitespace-pre-wrap">{seg.text || " "}</span>
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
