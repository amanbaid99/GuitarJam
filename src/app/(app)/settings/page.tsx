import Link from "next/link"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AiCheck } from "./ai-check"
import { Members } from "./members"
import { ThemePicker } from "./theme-picker"
import { UpdateCheck } from "./update-check"

export const metadata = { title: "Settings" }

// The AI test can wait on a slow free model.
export const maxDuration = 120

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link
          href="/repertoire"
          aria-label="Back to Songs"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </header>
      <ThemePicker />
      <Suspense fallback={null}>
        <MembersSection />
      </Suspense>
      <AiCheck />
      <UpdateCheck />
    </main>
  )
}

/** Only the owner sees this. */
async function MembersSection() {
  const user = await requireUser()
  if (user.role !== "owner") return null
  const supabase = await createClient()
  const [requests, members] = await Promise.all([supabase.rpc("owner_requests"), supabase.rpc("owner_members")])
  const ready = !requests.error && !members.error
  return <Members ready={ready} requests={requests.data ?? []} members={members.data ?? []} />
}
