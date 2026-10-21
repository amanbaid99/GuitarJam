"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const TABS = [
  { href: "/repertoire", label: "Songs", icon: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  { href: "/sets", label: "Sets", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/repertoire/add", label: "Add", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/practice", label: "Practice", icon: "M9 4h6M12 4v3m7 6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-7-3v3l2 2" },
  { href: "/metronome", label: "Metronome", icon: "M9 3h6l4 18H5L9 3Zm3 4v8m0 0 4-5" },
  {
    href: "/settings",
    label: "Settings",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  },
] as const

/** The tab whose path is the longest match ("/repertoire/add" beats "/repertoire"). */
function activeHref(pathname: string | null): string | null {
  if (!pathname) return null
  const matches = TABS.filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
}

/** Highlights the current tab. Reads the URL, so it sits inside <Suspense>. */
export function BottomNav() {
  const pathname = usePathname()
  // The tab you tapped lights up at once, before its page has loaded.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null)
  const pending = tapped && tapped.from === pathname ? tapped.href : null
  return <NavBar pathname={pathname} pendingHref={pending} onTap={(href) => setTapped({ href, from: pathname })} />
}

/** The bar itself. With no pathname (while loading) no tab is highlighted. */
export function NavBar({
  pathname,
  pendingHref = null,
  onTap,
}: {
  pathname: string | null
  pendingHref?: string | null
  onTap?: (href: string) => void
}) {
  const current = pendingHref ?? activeHref(pathname)
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-6">
        {TABS.map((tab) => {
          const active = tab.href === current
          const primary = "primary" in tab && tab.primary
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => onTap?.(tab.href)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 text-[11px] font-medium select-none ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  className={
                    primary
                      ? "flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg"
                      : "flex h-6 w-6 items-center justify-center"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={primary ? "h-5 w-5" : "h-6 w-6"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={primary ? 2.4 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={tab.icon} />
                  </svg>
                </span>
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
