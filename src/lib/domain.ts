// Allowed values for text columns that have a check constraint in the database.
// Keep in sync with supabase/migrations.

export const SONG_STATUSES = ["want_to_learn", "learning", "can_play", "polished"] as const
export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export const STYLES = ["strumming", "fingerstyle", "riff_lead", "mixed"] as const
export const SESSION_FEELS = ["rough", "ok", "good", "great"] as const
export const SKILL_LEVELS = ["not_started", "to_check", "learning", "comfortable"] as const
export const SKILL_AREAS = ["basics", "rhythm", "chords", "lead", "fingerstyle", "theory"] as const

export type SongStatus = (typeof SONG_STATUSES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type Style = (typeof STYLES)[number]
export type SessionFeel = (typeof SESSION_FEELS)[number]
export type SkillLevel = (typeof SKILL_LEVELS)[number]
export type SkillArea = (typeof SKILL_AREAS)[number]

/** Target from the handoff: 2 sessions a week, 20 minutes each. */
export const WEEKLY_SESSION_TARGET = 2
