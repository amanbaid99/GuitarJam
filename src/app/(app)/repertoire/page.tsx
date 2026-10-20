import Link from "next/link"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import { SeedButton } from "../seed-button"
import { RepertoireView } from "./repertoire-view"

export const metadata = { title: "Songs" }

export default function RepertoirePage() {
  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
        <div className="flex items-center gap-1">
          <Link href="/repertoire/add" className="btn-primary min-h-11 px-4 text-base">
            + Add song
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <Repertoire />
      </Suspense>
    </main>
  )
}

async function Repertoire() {
  const user = await requireUser()
  const supabase = await createClient()
  const [families, songs] = await Promise.all([
    supabase.from("families").select("*").order("created_at").order("name"),
    supabase.from("songs").select("*").order("title"),
  ])

  const error = families.error ?? songs.error
  if (error) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your songs: {error.message}
      </p>
    )
  }

  if ((songs.data ?? []).length === 0) {
    return <Starter isOwner={user.role === "owner"} hasFamilies={(families.data ?? []).length > 0} />
  }

  return <RepertoireView families={families.data ?? []} songs={songs.data ?? []} today={todayISO()} />
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-14 animate-pulse rounded-2xl bg-surface" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface" />
      ))}
    </div>
  )
}

/** First visit: an empty library. */
function Starter({ isOwner, hasFamilies }: { isOwner: boolean; hasFamilies: boolean }) {
  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Welcome to My Jamm</h2>
        <p className="mt-1 text-muted">
          Keep your version of every song in one place: chords, key, capo and your own lyrics. Then
          build a set for any room.
        </p>
      </div>
      {isOwner ? (
        <SeedButton label="Load my repertoire" />
      ) : (
        !hasFamilies && <SeedButton label="Set up the 5 chord families" />
      )}
      <Link href="/repertoire/add" className={hasFamilies || isOwner ? "btn-ghost" : "btn-primary"}>
        Add your first song
      </Link>
      <p className="text-xs text-muted">Tip: screenshot your notes app list and import it in one go.</p>
    </section>
  )
}
