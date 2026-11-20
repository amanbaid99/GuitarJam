import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Deck } from "../../deck"
import { loadFamilyDeck } from "../../load"

export const metadata = { title: "Performance" }

export default function PerformFamilyPage({ params, searchParams }: PageProps<"/perform/family/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <FamilyDeck params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function FamilyDeck({ params, searchParams }: PageProps<"/perform/family/[id]">) {
  const { id } = await params
  const query = await searchParams
  const knownOnly = query.known === "1"
  const deck = await loadFamilyDeck(id, knownOnly)
  if (!deck) notFound()
  return <Deck title={deck.title} songs={deck.songs} backHref={knownOnly || query.from === "sets" ? "/sets" : "/repertoire"} />
}
