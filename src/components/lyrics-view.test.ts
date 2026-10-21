import { describe, expect, it } from "vitest"
import { parseLyricLine } from "@/lib/theory"
import { wrapGroups } from "./lyrics-view"

const groupsOf = (raw: string) => {
  const line = parseLyricLine(raw)
  if (line.kind !== "line") throw new Error("not a line")
  return wrapGroups(line.segments).map((g) => g.map((p) => (p.chord ? `[${p.chord}]` : "") + p.text).join(""))
}

describe("wrapGroups", () => {
  it("breaks only at spaces and keeps a word split by a chord together", () => {
    expect(groupsOf("[G]I know she pu[Cadd9]ts it")).toEqual(["[G]I ", "know ", "she ", "pu[Cadd9]ts ", "it"])
  })

  it("keeps chord-only lines", () => {
    expect(groupsOf("[G] [D]")).toEqual(["[G] ", "[D]"])
  })
})
