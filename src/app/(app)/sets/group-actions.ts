"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { GROUP_KEYS } from "@/lib/group-keys"
import { parseKey } from "@/lib/theory"

export type GroupResult = { ok: true; id?: string } | { ok: false; error: string }

/** Saves the play order of a group: songIds top to bottom. */
export async function saveGroupOrder(groupId: string, songIds: string[]): Promise<GroupResult> {
  await requireUser()
  const ok = z.object({ groupId: z.uuid(), songIds: z.array(z.uuid()).max(200) }).safeParse({ groupId, songIds })
  if (!ok.success) return { ok: false, error: "Unknown group or songs." }

  const supabase = await createClient()
  const { data: inGroup } = await supabase.from("songs").select("id").eq("family_id", groupId)
  const members = new Set((inGroup ?? []).map((s) => s.id))
  if (songIds.length !== members.size || songIds.some((id) => !members.has(id))) {
    return { ok: false, error: "The group changed while you were editing. Reload and try again." }
  }

  const results = await Promise.all(
    songIds.map((id, i) => supabase.from("songs").update({ group_position: i + 1 }).eq("id", id)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: failed.error.message }

  refresh()
  return { ok: true }
}

/** A new, empty group for songs in a key you do not have a group for yet. */
export async function createGroup(name: string, key: string): Promise<GroupResult> {
  await requireUser()
  const ok = z
    .object({ name: z.string().trim().min(1, "Give the group a name").max(40), key: z.enum(GROUP_KEYS) })
    .safeParse({ name, key })
  if (!ok.success) return { ok: false, error: ok.error.issues[0]?.message ?? "Check the group." }
  if (!parseKey(ok.data.key)) return { ok: false, error: "Unknown key." }

  const supabase = await createClient()
  const { data: last } = await supabase
    .from("families")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabase
    .from("families")
    .insert({ name: ok.data.name, key: ok.data.key, numbers: "", position: (last?.position ?? 0) + 1 })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true, id: data.id }
}

/** Deletes a group that has no songs. */
export async function deleteGroup(groupId: string): Promise<GroupResult> {
  await requireUser()
  if (!z.uuid().safeParse(groupId).success) return { ok: false, error: "Unknown group." }
  const supabase = await createClient()
  const { count } = await supabase.from("songs").select("id", { count: "exact", head: true }).eq("family_id", groupId)
  if (count) return { ok: false, error: "Move its songs to another group first." }
  const { error } = await supabase.from("families").delete().eq("id", groupId)
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
