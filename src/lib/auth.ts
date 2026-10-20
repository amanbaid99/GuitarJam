import "server-only"
import { redirect } from "next/navigation"
import { roleOf, type Role } from "@/lib/access"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = { id: string; email: string; role: Role }

/**
 * The signed-in member, verified from the session token.
 * Signed out: redirects to /login. Signed in but not invited (or removed):
 * redirects to /login?error=access. Call it in every page and action that
 * touches data; proxy.ts is only a first check, and RLS guards the data.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) redirect("/login")
  const email = String(claims.email ?? "")
  const role = await roleOf(supabase, email)
  if (!role) redirect("/login?error=access")
  return { id: claims.sub, email, role }
}

/** Like requireUser, but only for the app's owner. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== "owner") redirect("/")
  return user
}
