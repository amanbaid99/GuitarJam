import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"
import { canSignIn, type Role } from "@/lib/access"
import { createClient, getAuthSession } from "@/lib/neon/server"

export type CurrentUser = { id: string; email: string; role: Role }

/**
 * The signed-in member, verified from the session token.
 * Signed out: redirects to /login. Signed in but not invited (or removed):
 * redirects to /login?error=access. Call it in every page and action that
 * touches data; proxy.ts is only a first check, and RLS guards the data.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const { data: session, error } = await getAuthSession()
  if (error && Number(error.status) >= 500) redirect("/login?error=service")
  const user = session?.user
  if (!user) redirect("/login")
  if (!user.emailVerified) redirect("/login?error=access")

  const db = await createClient().catch(() => null)
  if (!db) redirect("/login?error=service")
  const [membership, ownership] = await Promise.all([db.rpc("my_role"), db.rpc("app_user_id")])
  if (membership.error || ownership.error) {
    console.error("Could not verify app membership", {
      membershipCode: membership.error?.code,
      ownershipCode: ownership.error?.code,
    })
    redirect("/login?error=service")
  }
  const role = membership.data
  if (role !== "owner" && role !== "member") {
    if (await canSignIn(db, user.email)) {
      console.error("Approved sign-in has no database membership identity")
      redirect("/login?error=service")
    }
    redirect("/login?error=access")
  }
  if (!ownership.data) redirect("/login?error=service")
  return { id: ownership.data, email: user.email, role }
})
// cache(): one check per request, however many parts of the page ask.

/** Like requireUser, but only for the app's owner. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== "owner") redirect("/")
  return user
}
