import Link from "next/link"
import { ThemePicker } from "./theme-picker"
import { UpdateCheck } from "./update-check"

export const metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Back to Today"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </header>
      <ThemePicker />
      <UpdateCheck />
    </main>
  )
}
