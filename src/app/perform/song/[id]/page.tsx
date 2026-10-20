import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Deck } from "../../deck"
import { loadSongDeck } from "../../load"

export const metadata = { title: "Performance" }

export default function PerformSongPage({ params }: PageProps<"/perform/song/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <SongDeck params={params} />
    </Suspense>
  )
}

async function SongDeck({ params }: { params: PageProps<"/perform/song/[id]">["params"] }) {
  const { id } = await params
  const deck = await loadSongDeck(id)
  if (!deck) notFound()
  return <Deck title={deck.title} songs={deck.songs} backHref={`/repertoire/${id}`} />
}
