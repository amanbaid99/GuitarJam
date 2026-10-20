"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { addDays, todayISO } from "@/lib/dates"
import { SESSION_FEELS } from "@/lib/domain"
import { coachPlan, type CoachInput } from "@/lib/plan/coach"
import { PLAN_MINUTES, type Plan, type PlanMinutes } from "@/lib/plan/types"
import { createClient } from "@/lib/supabase/server"

export type PlanResult =
  | { ok: true; plan: Plan; source: "ai" | "template"; note?: string }
  | { ok: false; error: string }

/** Everything a plan is built from: songs, skills ladder, families, last 14 days of sessions. */
async function planInput(minutes: PlanMinutes): Promise<CoachInput> {
  const supabase = await createClient()
  const today = todayISO()
  const [songs, skills, families, sessions] = await Promise.all([
    supabase.from("songs").select("id, title, status, family_id, last_practised"),
    supabase.from("skills").select("area, name, level, is_focus"),
    supabase.from("families").select("id, name"),
    supabase
      .from("sessions")
      .select("date, minutes, focus, how_it_went")
      .gte("date", addDays(today, -13))
      .order("date"),
  ])
  const error = songs.error ?? skills.error ?? families.error ?? sessions.error
  if (error) throw new Error(error.message)

  const recent = sessions.data ?? []
  return {
    minutes,
    today,
    focusSkill: skills.data?.find((s) => s.is_focus)?.name ?? null,
    songs: songs.data ?? [],
    recentSessionDates: recent.map((s) => s.date),
    skills: skills.data ?? [],
    familyNames: Object.fromEntries((families.data ?? []).map((f) => [f.id, f.name])),
    recentSessions: recent,
  }
}

/** Asks the AI coach (OpenRouter, server side). Falls back to the built-in plan on any problem. */
export async function planSession(minutes: number): Promise<PlanResult> {
  await requireUser()
  const parsed = z.union(PLAN_MINUTES.map((m) => z.literal(m))).safeParse(minutes)
  if (!parsed.success) return { ok: false, error: "Pick 10, 15, 20 or 30 minutes." }
  try {
    const input = await planInput(parsed.data as PlanMinutes)
    const { plan, source, note } = await coachPlan(input)
    return { ok: true, plan, source, note }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not plan a session." }
  }
}

const logSchema = z.object({
  minutes: z.number().int().min(1, "At least 1 minute").max(300),
  focus: z.string().trim().max(100).optional(),
  how_it_went: z.enum(SESSION_FEELS).optional(),
  notes: z.string().trim().max(1000).optional(),
  song_ids: z.array(z.uuid()).max(40).default([]),
})

export type LogInput = z.input<typeof logSchema>
export type LogResult = { ok: true } | { ok: false; error: string }

/** Saves a session and its songs together; the database moves each song's last_practised. */
export async function logSession(input: LogInput): Promise<LogResult> {
  await requireUser()
  const parsed = logSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.rpc("log_session", {
    p_minutes: d.minutes,
    p_date: todayISO(),
    p_focus: d.focus || null,
    p_how_it_went: d.how_it_went ?? null,
    p_notes: d.notes || null,
    p_song_ids: d.song_ids,
  })
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
