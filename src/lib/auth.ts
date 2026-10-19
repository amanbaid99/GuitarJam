import "server-only"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = { id: string; email: string }

/**
 * The signed-in user, verified from the session token.
 * Redirects to /login when signed out. Call it in every page and action
 * that touches data; proxy.ts is only a first check.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) redirect("/login")
  return { id: claims.sub, email: String(claims.email ?? "") }
}
