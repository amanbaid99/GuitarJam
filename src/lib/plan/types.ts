import { z } from "zod"

export const PLAN_MINUTES = [10, 15, 20, 30] as const
export type PlanMinutes = (typeof PLAN_MINUTES)[number]

// Same shape the AI coach will return in step 6, so the UI does not change.
export const planBlockSchema = z.object({
  label: z.string().min(1).max(60),
  minutes: z.number().int().min(1).max(30),
  instruction: z.string().min(1).max(600),
  song_id: z.uuid().optional(),
})

export const planSchema = z.object({
  blocks: z.array(planBlockSchema).min(1).max(6),
  why: z.string().max(600),
})

export type PlanBlock = z.infer<typeof planBlockSchema>
export type Plan = z.infer<typeof planSchema>

/** What a plan is built from. Also the AI coach's input later. */
export type PlanInput = {
  minutes: PlanMinutes
  today: string // YYYY-MM-DD
  focusSkill: string | null
  songs: {
    id: string
    title: string
    status: string
    family_id: string | null
    last_practised: string | null
  }[]
  /** Dates (YYYY-MM-DD) of sessions in the last 14 days. */
  recentSessionDates: string[]
}

export const planTotal = (plan: Plan) => plan.blocks.reduce((sum, b) => sum + b.minutes, 0)
