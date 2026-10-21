import { Suspense } from "react"
import { signOut } from "@/app/login/actions"
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
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <ThemePicker />
      <Suspense fallback={null}>
        <MembersSection />
      </Suspense>
      <AiCheck />
      <UpdateCheck />
      <Suspense fallback={null}>
        <Account />
      </Suspense>
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

async function Account() {
  const user = await requireUser()
  return (
    <section className="flex flex-col gap-3" aria-label="Account">
      <h2 className="text-lg font-semibold">Account</h2>
      <form action={signOut} className="card flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-muted">Signed in as {user.email}</span>
        <button type="submit" className="btn-ghost min-h-11 shrink-0 px-4 text-sm">
          Sign out
        </button>
      </form>
    </section>
  )
}
