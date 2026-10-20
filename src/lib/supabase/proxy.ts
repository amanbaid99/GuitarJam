import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/lib/database.types"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"

// Paths you can open while signed out.
const PUBLIC_PATHS = ["/login", "/auth"]

/**
 * Refreshes the Supabase session cookie on every request and sends
 * signed-out visitors to /login. This is a fast first check only: pages and
 * actions check the user again, and RLS guards the data itself.
 */
export async function updateSession(request: NextRequest) {
  // If Supabase sends a sign-in link to any page other than /auth/confirm
  // (for example the Site URL root), pass it on to /auth/confirm.
  const params = request.nextUrl.searchParams
  if (
    request.nextUrl.pathname !== "/auth/confirm" &&
    (params.has("code") || params.has("token_hash"))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/confirm"
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Keep this call directly after createServerClient (Supabase guidance):
  // it refreshes an expired token so the user is not randomly signed out.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    const redirect = NextResponse.redirect(url)
    // Carry over any cookie changes (for example a cleared session).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
