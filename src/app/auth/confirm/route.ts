import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Where the magic link lands. Handles both link styles Supabase can send:
 *   ?token_hash=...&type=email   (our email template, works in any browser)
 *   ?code=...                    (default PKCE link, same browser only)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = (searchParams.get("type") ?? "email") as EmailOtpType
  const code = searchParams.get("code")

  const home = request.nextUrl.clone()
  home.pathname = "/"
  home.search = ""
  const failed = request.nextUrl.clone()
  failed.pathname = "/login"
  failed.search = "?error=link"

  const supabase = await createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    return NextResponse.redirect(error ? failed : home)
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(error ? failed : home)
  }
  return NextResponse.redirect(failed)
}
