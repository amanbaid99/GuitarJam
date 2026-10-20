import { describe, expect, it } from "vitest"
import { bpmFromTaps, clampBpm } from "./metronome"

describe("bpmFromTaps", () => {
  it("needs at least two taps", () => {
    expect(bpmFromTaps([])).toBeNull()
    expect(bpmFromTaps([1000])).toBeNull()
  })

  it("averages steady taps", () => {
    // 500 ms apart = 120 BPM
    expect(bpmFromTaps([0, 500, 1000, 1500, 2000])).toBe(120)
  })

  it("uses only the last 4 gaps", () => {
    // Slow taps first, then four at 600 ms = 100 BPM
    expect(bpmFromTaps([0, 1500, 3000, 3600, 4200, 4800, 5400])).toBe(100)
  })

  it("starts over after a pause of more than 2 seconds", () => {
    expect(bpmFromTaps([0, 500, 1000, 5000, 5750])).toBe(80)
  })

  it("keeps BPM in range", () => {
    expect(bpmFromTaps([0, 100, 200])).toBe(220)
    expect(clampBpm(10)).toBe(40)
  })
})
