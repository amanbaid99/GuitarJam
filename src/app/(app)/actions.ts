"use server"

import { refresh } from "next/cache"
import { requireUser } from "@/lib/auth"
import { seedUser } from "@/lib/seed"
import { createClient } from "@/lib/supabase/server"

export type SeedState = { message?: string; error?: string }

/** Loads the starter repertoire and skills into your account. Safe to tap twice. */
export async function loadStarterData(): Promise<SeedState> {
  const user = await requireUser()
  const supabase = await createClient()
  try {
    const result = await seedUser(supabase, user.id)
    refresh()
    return {
      message: `Added ${result.families} families, ${result.songs} songs and ${result.skills} skills.`,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong loading your songs." }
  }
}
