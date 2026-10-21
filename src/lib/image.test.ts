import { describe, expect, it } from "vitest"
import { MAX_SLICES, SLICE_HEIGHT, SLICE_OVERLAP, chooseScale, sliceBounds } from "./image"

describe("screenshot slicing", () => {
  it("keeps a normal photo as one piece", () => {
    expect(sliceBounds(1200)).toEqual([[0, 1200]])
  })

  it("cuts a tall screenshot into overlapping pieces that cover everything", () => {
    const pieces = sliceBounds(5000)
    expect(pieces[0]).toEqual([0, SLICE_HEIGHT])
    expect(pieces.at(-1)![1]).toBe(5000)
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i][0]).toBe(pieces[i - 1][1] - SLICE_OVERLAP) // overlap, no gaps
      expect(pieces[i][1] - pieces[i][0]).toBeLessThanOrEqual(SLICE_HEIGHT)
    }
  })

  it("keeps a full-page phone screenshot readable instead of squashing it", () => {
    // An iPhone full-page capture of an Ultimate Guitar song: 1170 x 9000.
    const scale = chooseScale(1170, 9000)
    expect(Math.round(1170 * scale)).toBeGreaterThanOrEqual(900) // the old code made this ~234 px wide
    expect(sliceBounds(Math.round(9000 * scale)).length).toBeLessThanOrEqual(MAX_SLICES)
  })

  it("never enlarges a small image", () => {
    expect(chooseScale(600, 800)).toBe(1)
  })

  it("shrinks extremely long captures just enough to stay within the piece limit", () => {
    const scale = chooseScale(1170, 40000)
    expect(sliceBounds(Math.round(40000 * scale)).length).toBeLessThanOrEqual(MAX_SLICES)
  })
})
