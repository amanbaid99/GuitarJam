import { describe, expect, it } from "vitest"
import { addDays, mondayOf, shortDate, startOfWeekISO, todayISO } from "./dates"

describe("dates", () => {
  it("uses the app time zone for today", () => {
    // 20:00 UTC on Sunday is already Monday 01:30 in India.
    const now = new Date("2026-10-18T20:00:00Z")
    expect(todayISO(now, "UTC")).toBe("2026-10-18")
    expect(todayISO(now, "Asia/Kolkata")).toBe("2026-10-19")
  })

  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-19")).toBe("2026-10-19") // Monday
    expect(mondayOf("2026-10-25")).toBe("2026-10-19") // Sunday
    expect(mondayOf("2026-11-01")).toBe("2026-10-26") // across a month
  })

  it("starts the week in the app time zone", () => {
    const now = new Date("2026-10-18T20:00:00Z")
    expect(startOfWeekISO(now, "UTC")).toBe("2026-10-12")
    expect(startOfWeekISO(now, "Asia/Kolkata")).toBe("2026-10-19")
  })
})

describe("addDays", () => {
  it("moves across months and years", () => {
    expect(addDays("2026-10-20", -13)).toBe("2026-10-07")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })
})

describe("shortDate", () => {
  it("formats the same way everywhere", () => {
    expect(shortDate("2026-10-18")).toBe("Sun 18 Oct")
    expect(shortDate("2027-01-01")).toBe("Fri 1 Jan")
  })
})
