"use server"

import { refresh } from "next/cache"
import { requireUser } from "@/lib/auth"
import { seedFamiliesOnly, seedUser } from "@/lib/seed"
import { createClient } from "@/lib/supabase/server"

export type SeedState = { message?: string; error?: string }

/**
 * Starter data. The owner gets their full Notion repertoire; invited members get
 * the 4 song groups and add their own songs. Safe to tap twice.
 */
export async function loadStarterData(): Promise<SeedState> {
  const user = await requireUser()
  const supabase = await createClient()
  try {
    if (user.role !== "owner") {
      const result = await seedFamiliesOnly(supabase, user.id)
      refresh()
      return { message: `Added ${result.families} chord families. Now add your first song.` }
    }
    const result = await seedUser(supabase, user.id)
    refresh()
    return {
      message: `Added ${result.families} families, ${result.songs} songs, ${result.skills} skills${result.sets ? " and your Go-to set" : ""}.`,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong loading your songs." }
  }
}
