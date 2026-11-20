import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"
import { roleOf, type Role } from "@/lib/access"
import { neonAuth } from "@/lib/neon/auth"
import { createClient } from "@/lib/neon/server"

export type CurrentUser = { id: string; email: string; role: Role }

/**
 * The signed-in member, verified from the session token.
 * Signed out: redirects to /login. Signed in but not invited (or removed):
 * redirects to /login?error=access. Call it in every page and action that
 * touches data; proxy.ts is only a first check, and RLS guards the data.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const { data: session } = await neonAuth().getSession()
  const user = session?.user
  if (!user) redirect("/login")
  if (!user.emailVerified) redirect("/login?error=access")

  const db = await createClient()
  const [role, ownership] = await Promise.all([roleOf(db), db.rpc("app_user_id")])
  if (!role || ownership.error || !ownership.data) redirect("/login?error=access")
  return { id: ownership.data, email: user.email, role }
})
// cache(): one check per request, however many parts of the page ask.

/** Like requireUser, but only for the app's owner. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== "owner") redirect("/")
  return user
}
