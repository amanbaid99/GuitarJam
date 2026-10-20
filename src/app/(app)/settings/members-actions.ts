"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type MemberResult = { ok: true } | { ok: false; error: string }

/** Approve (adds the email to members) or decline a pending request. Owner only. */
export async function decideAccess(requestId: string, approve: boolean): Promise<MemberResult> {
  await requireOwner()
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Unknown request." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("decide_access", { p_request_id: requestId, p_approve: approve })
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** Removes someone's access. Their data stays but they can no longer sign in. Owner only. */
export async function removeMember(email: string): Promise<MemberResult> {
  await requireOwner()
  if (!z.email().safeParse(email).success) return { ok: false, error: "Unknown member." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("remove_member", { p_email: email })
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}
