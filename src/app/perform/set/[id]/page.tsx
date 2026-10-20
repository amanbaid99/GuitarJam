import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Deck } from "../../deck"
import { loadSetDeck } from "../../load"

export const metadata = { title: "Performance" }

export default function PerformSetPage({ params }: PageProps<"/perform/set/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <SetDeck params={params} />
    </Suspense>
  )
}

async function SetDeck({ params }: { params: PageProps<"/perform/set/[id]">["params"] }) {
  const { id } = await params
  const deck = await loadSetDeck(id)
  if (!deck) notFound()
  return <Deck title={deck.title} songs={deck.songs} backHref="/sets" />
}
