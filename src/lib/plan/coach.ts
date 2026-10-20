import "server-only"
import { z } from "zod"
import { chatJson, noDashes, type ChatJsonOptions } from "@/lib/ai/openrouter"
import { daysBetween } from "@/lib/songs"
import { templatePlan } from "./template"
import { planSchema, type Plan, type PlanInput } from "./types"

export type CoachInput = PlanInput & {
  skills: { area: string; name: string; level: string; is_focus: boolean }[]
  familyNames: Record<string, string>
  recentSessions: { date: string; minutes: number; focus: string | null; how_it_went: string | null }[]
}

export type CoachResult = { plan: Plan; source: "ai" | "template"; note?: string }

const SYSTEM = `You are a guitar practice coach for one player, Aman.
Player: intermediate rhythm player, rusty. Yamaha FX280 acoustic with built-in tuner and a capo.
Knows open, barre, slash and most extended chords. Plays about once a week; target is 2 sessions a week.
Tastes: Bollywood, old Hindi songs, classic rock, John Mayer, Coldplay, James Blunt.
Gaps: lead (pentatonic, bends), fingerstyle, theory, playing by ear.

Plan ONE practice session. Rules:
- Block minutes must add up to exactly the minutes given.
- Shape: warm-up, focus skill, song, free play. For 10 minutes, shrink or merge blocks (3 blocks is fine).
- Prefer the focus song (status "learning"). Rotate in one family song not played in 21+ days (or never).
- Only use song_id values from the songs list. Use null when a block has no song.
- If there were fewer than 2 sessions in the last 14 days, keep it short and easy and say so kindly in "why".
- Write chord shapes as fret numbers, low E to high E, e.g. G (320003), C (x32010). Strumming as D DU UDU.
- Give BPM numbers for metronome work.
- Plain, encouraging, honest, specific. Short instructions (1 to 3 sentences each).
- Never use em dashes or en dashes. Never quote song lyrics.
Reply with JSON only: {"blocks":[{"label","minutes","instruction","song_id"}],"why"}.`

// Strict schema for the model: every key required, song_id may be null.
const PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          minutes: { type: "integer" },
          instruction: { type: "string" },
          song_id: { type: ["string", "null"] },
        },
        required: ["label", "minutes", "instruction", "song_id"],
        additionalProperties: false,
      },
    },
    why: { type: "string" },
  },
  required: ["blocks", "why"],
  additionalProperties: false,
}

const aiPlanSchema = z.object({
  blocks: z
    .array(
      z.object({
        label: z.string().min(1),
        minutes: z.number().int().min(1).max(30),
        instruction: z.string().min(1),
        song_id: z.string().nullable().optional(),
      }),
    )
    .min(2)
    .max(6),
  why: z.string(),
})

export function buildUserMessage(input: CoachInput): string {
  const songs = input.songs
    .filter((s) => s.status !== "want_to_learn")
    .map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      family: s.family_id ? (input.familyNames[s.family_id] ?? null) : null,
      days_since_played: s.last_practised ? daysBetween(s.last_practised, input.today) : null,
    }))
  return JSON.stringify({
    minutes: input.minutes,
    today: input.today,
    focus_skill: input.focusSkill,
    skills: input.skills,
    sessions_last_14_days: input.recentSessions,
    songs,
  })
}

/**
 * Checks and tidies the model's plan. Returns null if it cannot be trusted.
 * - total must match (a small miss is fixed on the longest block)
 * - song_id must be one of the user's songs
 * - no dashes, sensible lengths
 */
export function cleanAiPlan(raw: z.infer<typeof aiPlanSchema>, input: CoachInput): Plan | null {
  const known = new Set(input.songs.map((s) => s.id))
  const blocks = raw.blocks.map((b) => ({
    label: noDashes(b.label).slice(0, 60),
    minutes: b.minutes,
    instruction: noDashes(b.instruction).slice(0, 600),
    ...(b.song_id && known.has(b.song_id) ? { song_id: b.song_id } : {}),
  }))

  const diff = input.minutes - blocks.reduce((s, b) => s + b.minutes, 0)
  if (diff !== 0) {
    if (Math.abs(diff) > 3) return null
    const longest = blocks.reduce((a, b, i) => (b.minutes > blocks[a].minutes ? i : a), 0)
    if (blocks[longest].minutes + diff < 1) return null
    blocks[longest] = { ...blocks[longest], minutes: blocks[longest].minutes + diff }
  }

  const plan = { blocks, why: noDashes(raw.why).slice(0, 600) }
  return planSchema.safeParse(plan).success ? plan : null
}

/** AI plan when available, the built-in template otherwise. Never throws. */
export async function coachPlan(
  input: CoachInput,
  fetchImpl?: ChatJsonOptions<unknown>["fetchImpl"],
): Promise<CoachResult> {
  const result = await chatJson({
    system: SYSTEM,
    user: buildUserMessage(input),
    schema: aiPlanSchema,
    jsonSchema: { name: "practice_plan", schema: PLAN_JSON_SCHEMA },
    fetchImpl,
  })

  if (result.ok) {
    const plan = cleanAiPlan(result.data, input)
    if (plan) return { plan, source: "ai" }
    return { plan: templatePlan(input), source: "template", note: "The coach's plan did not add up, so here is the built-in one." }
  }
  return {
    plan: templatePlan(input),
    source: "template",
    note: /not set/.test(result.error)
      ? "AI coach is not set up yet, so here is the built-in plan."
      : "The AI coach is busy right now, so here is the built-in plan.",
  }
}
