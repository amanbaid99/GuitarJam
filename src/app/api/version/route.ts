import { connection } from "next/server"
import { APP_BUILT_AT, APP_VERSION } from "@/lib/version"

/**
 * The version the server is running right now. After a new deploy this
 * differs from the version baked into an open app, which means an update.
 */
export async function GET() {
  await connection() // always answer at request time, never from a cache
  return Response.json(
    { version: APP_VERSION, builtAt: APP_BUILT_AT },
    { headers: { "Cache-Control": "no-store" } },
  )
}
