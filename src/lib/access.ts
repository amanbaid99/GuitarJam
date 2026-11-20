import "server-only"
import type { DataClient } from "@/lib/neon/server"
import { allowedEmail } from "@/lib/env"

export type Role = "owner" | "member"

/** Check the invitation list before requesting a sign-in code. */
export async function canSignIn(supabase: DataClient, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase()
  if (e && e === allowedEmail()) return true
  const { data, error } = await supabase.rpc("can_sign_in", { p_email: e })
  if (error) return false
  return data === true
}
