import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { allowedEmail } from "@/lib/env"

export type Role = "owner" | "member"

/**
 * Invite-only access. The members list lives in the database (public.members).
 * ALLOWED_EMAIL is always treated as the owner, so the owner can never be
 * locked out, and the app keeps working before the members migration is applied.
 */
export async function canSignIn(supabase: SupabaseClient<Database>, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase()
  if (e && e === allowedEmail()) return true
  const { data, error } = await supabase.rpc("can_sign_in", { p_email: e })
  if (error) return false // members table not there yet: only the owner
  return data === true
}

export async function roleOf(supabase: SupabaseClient<Database>, email: string): Promise<Role | null> {
  if (email && email.toLowerCase() === allowedEmail()) return "owner"
  const { data, error } = await supabase.rpc("my_role")
  if (error) return null
  return data === "owner" || data === "member" ? data : null
}
