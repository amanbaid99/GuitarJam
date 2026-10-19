import type { SkillArea, SkillLevel } from "@/lib/domain"

export type SeedSkill = {
  area: SkillArea
  name: string
  level: SkillLevel
  is_focus?: boolean
}

/** Starting skills ladder, from HANDOFF.md. */
export const SEED_SKILLS: SeedSkill[] = [
  { area: "basics", name: "Open chords", level: "comfortable" },
  { area: "basics", name: "Clean changes", level: "comfortable" },
  { area: "basics", name: "Basic strumming", level: "comfortable" },

  { area: "rhythm", name: "Strumming with a metronome", level: "learning", is_focus: true },
  { area: "rhythm", name: "Palm muting", level: "to_check" },
  { area: "rhythm", name: "Syncopation", level: "to_check" },

  { area: "chords", name: "Barre chords", level: "comfortable" },
  { area: "chords", name: "Slash chords", level: "comfortable" },
  { area: "chords", name: "7th, add9 and sus chords", level: "learning" },
  { area: "chords", name: "Power chords", level: "to_check" },

  { area: "lead", name: "Minor pentatonic box 1", level: "to_check" },
  { area: "lead", name: "Bends", level: "to_check" },
  { area: "lead", name: "Hammer-ons and pull-offs", level: "to_check" },
  { area: "lead", name: "Slides", level: "to_check" },

  { area: "fingerstyle", name: "Basic arpeggios", level: "to_check" },
  { area: "fingerstyle", name: "Travis picking", level: "not_started" },

  { area: "theory", name: "Chord families", level: "learning" },
  { area: "theory", name: "Number system", level: "not_started" },
  { area: "theory", name: "Fretboard notes", level: "to_check" },
  { area: "theory", name: "Major scale", level: "to_check" },
  { area: "theory", name: "CAGED", level: "to_check" },
  { area: "theory", name: "Playing by ear", level: "not_started" },
]
