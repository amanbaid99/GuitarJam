import Link from "next/link"
import { Suspense } from "react"
import { getGoToSet, getLibrary } from "@/lib/data"
import { SeedButton } from "../seed-button"
import { RepertoireView } from "./repertoire-view"

export const metadata = { title: "Songs" }

export default function RepertoirePage({ searchParams }: PageProps<"/repertoire">) {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Repertoire searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Repertoire({ searchParams }: { searchParams: PageProps<"/repertoire">["searchParams"] }) {
  const tag = (await searchParams).tag === "1"
  const lib = await getLibrary()
  if (!lib.ok) {
    return (
      <p className="card text-danger" role="alert">
        Could not load your songs: {lib.error}
      </p>
    )
  }

  if (lib.songs.length === 0) {
    return <Starter isOwner={lib.role === "owner"} hasFamilies={lib.families.length > 0} />
  }

  const goTo = await getGoToSet()
  return (
    <>
      <section aria-label="Quick actions" className="card grid gap-2 sm:grid-cols-2">
        <Link href="/jam" className="btn-primary">Start a jam</Link>
        <Link href={goTo ? `/perform/set/${goTo}` : "/sets#my-sets"} className="btn-ghost">
          {goTo ? "Play my go-to set" : "Choose a set"}
        </Link>
      </section>
      <RepertoireView families={lib.families} songs={lib.songs} initiallyTagging={tag} />
    </>
  )
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
      <Link href="/repertoire/add" className="btn-primary">Add your first song</Link>
      {isOwner ? (
        <SeedButton label="Load my repertoire" />
      ) : (
        !hasFamilies && <SeedButton label="Set up the 4 song groups" />
      )}
      <p className="text-xs text-muted">Tip: screenshot your notes app list and import it in one go.</p>
    </section>
  )
}
