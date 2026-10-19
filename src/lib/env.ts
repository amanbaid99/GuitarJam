// Public values (safe in the browser). Read with literal process.env.X so Next can inline them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""

/** The one email allowed to sign in. Server only. */
export function allowedEmail(): string {
  return (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase()
}
