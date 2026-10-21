import { MetronomePanel } from "../_today/metronome-panel"

export const metadata = { title: "Metronome" }

export default function MetronomePage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Metronome</h1>
      <MetronomePanel />
    </main>
  )
}
