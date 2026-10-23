import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type Client = SupabaseClient<Database>

/** Highest play position in each group, so new songs go to the end. */
export async function lastPositions(supabase: Client, groupIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(groupIds.map((id) => [id, 0]))
  if (groupIds.length === 0) return out
  const { data } = await supabase.from("songs").select("family_id, group_position").in("family_id", groupIds)
  for (const r of data ?? []) {
    if (r.family_id && (r.group_position ?? 0) > (out.get(r.family_id) ?? 0)) out.set(r.family_id, r.group_position ?? 0)
  }
  return out
}

/** Only songs with chords can be in a group (the group is about chord shapes). */
export function groupFor(familyId: string | null | undefined, chords: string | null | undefined): string | null {
  return chords && chords.trim() && familyId ? familyId : null
}

/**
 * After groups were merged, an empty group whose key another (non-empty)
 * group already covers is a leftover: delete it and return the rest.
 */
export async function withoutLeftoverGroups<G extends { id: string; key: string }>(
  supabase: Client,
  groups: G[],
  songs: { family_id: string | null }[],
): Promise<G[]> {
  const used = new Set(songs.flatMap((s) => (s.family_id ? [s.family_id] : [])))
  const leftovers = groups.filter(
    (g) => !used.has(g.id) && groups.some((o) => o.id !== g.id && o.key === g.key && used.has(o.id)),
  )
  if (leftovers.length === 0) return groups
  await supabase.from("families").delete().in("id", leftovers.map((g) => g.id))
  return groups.filter((g) => !leftovers.includes(g))
}
