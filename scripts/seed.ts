/**
 * Seeds families, songs and skills for the app's one user.
 *
 *   npm run seed
 *
 * Needs in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (Supabase > Project Settings > API keys, secret key. Never commit it.)
 *   ALLOWED_EMAIL               (whose data to seed; that user must have signed in once)
 *
 * Safe to re-run: it only adds what is missing.
 * You can also do this from the app: the Today screen shows a
 * "Load my repertoire" button while the library is empty.
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../src/lib/database.types"
import { seedUser } from "../src/lib/seed"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = (process.env.SEED_USER_EMAIL ?? process.env.ALLOWED_EMAIL ?? "").toLowerCase()

  if (!url || !serviceKey || !email) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ALLOWED_EMAIL in .env.local",
    )
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Single user app, so the first page of users is plenty.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 100 })
  if (error) throw error
  const user = data.users.find((u) => u.email?.toLowerCase() === email)
  if (!user) {
    throw new Error(`No user with email ${email}. Sign in to the app once, then re-run.`)
  }

  const result = await seedUser(supabase, user.id)
  console.log(
    `Seeded for ${email}: ${result.families} families, ${result.songs} songs, ${result.skills} skills added.`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
