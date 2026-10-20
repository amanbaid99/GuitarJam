import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Deck } from "../../deck"
import { loadFamilyDeck } from "../../load"

export const metadata = { title: "Performance" }

export default function PerformFamilyPage({ params }: PageProps<"/perform/family/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <FamilyDeck params={params} />
    </Suspense>
  )
}

async function FamilyDeck({ params }: { params: PageProps<"/perform/family/[id]">["params"] }) {
  const { id } = await params
  const deck = await loadFamilyDeck(id)
  if (!deck) notFound()
  return <Deck title={deck.title} songs={deck.songs} backHref="/repertoire" />
}
