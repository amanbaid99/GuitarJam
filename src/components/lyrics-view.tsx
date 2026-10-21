import { parseLyrics, type LyricSegment } from "@/lib/theory"

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
            {wrapGroups(line.segments).map((group, g) => (
              // A group is one word (maybe split by a chord): it never breaks across lines.
              <span key={g} className="inline-flex items-end">
                {group.map((piece, j) => (
                  <span key={j} className="inline-flex flex-col">
                    {line.hasChords && (
                      <span className={`min-h-[1.3em] pr-1 font-mono font-bold text-accent ${chord}`}>
                        {piece.chord ?? " "}
                      </span>
                    )}
                    <span className="whitespace-pre">{piece.text || " "}</span>
                  </span>
                ))}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Splits a line into pieces that may wrap only at spaces. A chord in the
 * middle of a word ("she pu[C]ts") keeps the word together on one line.
 */
export function wrapGroups(segments: LyricSegment[]): LyricSegment[][] {
  const groups: LyricSegment[][] = []
  let current: LyricSegment[] = []
  for (const seg of segments) {
    const chunks = seg.text.match(/\S*\s+|\S+/g) ?? [""]
    chunks.forEach((chunk, k) => {
      current.push({ chord: k === 0 ? seg.chord : null, text: chunk })
      if (/\s$/.test(chunk)) {
        groups.push(current)
        current = []
      }
    })
  }
  if (current.length) groups.push(current)
  return groups
}
