import "server-only"
import { PostgrestClient } from "@supabase/postgrest-js"
import { connection } from "next/server"
import { cache } from "react"
import type { Database } from "@/lib/database.types"
import { neonAuth } from "./auth"

export type DataClient = PostgrestClient<Database>

export const getAuthSession = cache(async () => {
  // Neon session and token requests must run after Next.js prerendering.
  await connection()
  return neonAuth().getSession()
})

export const createClient = cache(async (): Promise<DataClient> => {
  const { data: session } = await getAuthSession()
  const { data } = session ? await neonAuth().token() : { data: null }
  if (session && !data?.token) throw new Error("Could not authenticate to the database.")
  return new PostgrestClient<Database>(process.env.NEON_DATA_API_URL!, {
    headers: data?.token ? { Authorization: `Bearer ${data.token}` } : {},
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  })
})
