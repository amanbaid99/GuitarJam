import { daysBetween } from "@/lib/songs"
import type { Plan, PlanBlock, PlanInput, PlanMinutes } from "./types"

/** Minutes for warm-up, skill, song, free play. 10 min merges skill and song. */
const SPLITS: Record<PlanMinutes, number[]> = {
  10: [2, 5, 3],
  15: [3, 4, 5, 3],
  20: [3, 6, 7, 4],
  30: [5, 8, 10, 7],
}

const ROTATE_AFTER_DAYS = 21
const START_BPM = 70

const WARM_UP =
  "Tune with the built-in tuner. Then change G (320003) to C (x32010) to D (xx0232), " +
  "4 beats each, slow and clean."

function skillInstruction(skill: string | null): string {
  if (!skill) return "Pick one thing that feels shaky and repeat it slowly until it is clean."
  if (/metronome/i.test(skill)) {
    return (
      `Metronome at ${START_BPM} BPM. Strum D DU UDU on G, then Em. ` +
      "When 4 bars in a row feel steady, go up 5 BPM."
    )
  }
  return `Work on ${skill.toLowerCase()}. Go slow and stay relaxed; clean beats fast.`
}

/** The song you are learning, else the "can play" song you have not touched for longest. */
export function pickFocusSong(input: PlanInput) {
  const learning = input.songs.filter((s) => s.status === "learning")
  if (learning.length) return learning.sort(byLeastRecent)[0]
  return input.songs.filter((s) => s.status === "can_play").sort(byLeastRecent)[0] ?? null
}

/** A family song not played in 21+ days (never played counts), least recent first. */
export function pickRotationSong(input: PlanInput, excludeId?: string) {
  return (
    input.songs
      .filter(
        (s) =>
          s.id !== excludeId &&
          s.family_id !== null &&
          (s.status === "can_play" || s.status === "polished") &&
          (!s.last_practised || daysBetween(s.last_practised, input.today) >= ROTATE_AFTER_DAYS),
      )
      .sort(byLeastRecent)[0] ?? null
  )
}

function byLeastRecent(
  a: { last_practised: string | null; title: string },
  b: { last_practised: string | null; title: string },
) {
  // Never practised first, then oldest date, then title so the order is stable.
  const ad = a.last_practised ?? ""
  const bd = b.last_practised ?? ""
  return ad === bd ? a.title.localeCompare(b.title) : ad < bd ? -1 : 1
}

export function isRestarting(input: PlanInput): boolean {
  return new Set(input.recentSessionDates).size < 2
}

/**
 * A sensible plan without AI: warm-up, focus skill, focus song, free play.
 * Blocks always add up to the minutes asked for.
 */
export function templatePlan(input: PlanInput): Plan {
  const split = SPLITS[input.minutes]
  const focus = pickFocusSong(input)
  const rotation = pickRotationSong(input, focus?.id)
  const restarting = isRestarting(input)

  const blocks: PlanBlock[] = [{ label: "Warm-up", minutes: split[0], instruction: WARM_UP }]

  if (input.minutes === 10) {
    blocks.push({
      label: focus ? `${input.focusSkill ?? "Focus"} on ${focus.title}` : (input.focusSkill ?? "Focus"),
      minutes: split[1],
      instruction:
        skillInstruction(input.focusSkill) + (focus ? ` Use the chords from ${focus.title}.` : ""),
      ...(focus ? { song_id: focus.id } : {}),
    })
  } else {
    blocks.push({
      label: input.focusSkill ?? "Focus skill",
      minutes: split[1],
      instruction: skillInstruction(input.focusSkill),
    })
    blocks.push({
      label: focus ? focus.title : "Song",
      minutes: split[2],
      instruction: focus
        ? `Play ${focus.title} start to finish with the metronome. If a change trips you up, loop just that change 5 times, then go again.`
        : "Play any song you know start to finish with the metronome.",
      ...(focus ? { song_id: focus.id } : {}),
    })
  }

  const last = split[split.length - 1]
  blocks.push({
    label: rotation ? `Free play: ${rotation.title}` : "Free play",
    minutes: last,
    instruction: rotation
      ? `Play ${rotation.title} from memory, no chart unless you get stuck. It has been a while.`
      : "Play whatever you feel like. No metronome, just enjoy it.",
    ...(rotation ? { song_id: rotation.id } : {}),
  })

  const why = restarting
    ? "Getting back into it, so this keeps things light: one skill, one song, and something fun to finish. Showing up is the win today."
    : `Warm up, then ${input.focusSkill ? input.focusSkill.toLowerCase() : "your focus skill"}${
        focus ? `, then ${focus.title}` : ""
      }${rotation ? `, and ${rotation.title} so it does not get rusty` : ""}.`

  return { blocks, why }
}
