// The server runs in UTC, but "today" and "this week" should follow the player's clock.
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Kolkata"

/** Today's date in the app time zone, as YYYY-MM-DD. */
export function todayISO(now = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** Monday of the week containing `dateISO`, as YYYY-MM-DD. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d.toISOString().slice(0, 10)
}

/** Monday of the current week in the app time zone. */
export function startOfWeekISO(now = new Date(), timeZone = APP_TIME_ZONE): string {
  return mondayOf(todayISO(now, timeZone))
}

/** `dateISO` plus `days` (can be negative), as YYYY-MM-DD. */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
