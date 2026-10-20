"use client"

import { useState } from "react"
import { shortDate } from "@/lib/dates"
import { APP_BUILT_AT, APP_VERSION } from "@/lib/version"

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; version: string }
  | { kind: "error" }

/** Clears anything cached for offline use, then loads the newest version. */
async function reloadFresh() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.update().catch(() => {})))
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Nothing cached or not allowed: a plain reload still picks up the new version.
  }
  window.location.reload()
}

export function UpdateCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [reloading, setReloading] = useState(false)

  async function check() {
    setStatus({ kind: "checking" })
    try {
      const res = await fetch("/api/version", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const live = (await res.json()) as { version: string }
      setStatus(live.version === APP_VERSION ? { kind: "current" } : { kind: "available", version: live.version })
    } catch {
      setStatus({ kind: "error" })
    }
  }

  function update() {
    setReloading(true)
    void reloadFresh()
  }

  // Same text on server and phone (no locale formatting).
  const built = APP_BUILT_AT ? `${shortDate(APP_BUILT_AT.slice(0, 10))}, ${APP_BUILT_AT.slice(11, 16)} UTC` : null

  return (
    <section className="flex flex-col gap-3" aria-label="App updates">
      <h2 className="text-lg font-semibold">App</h2>
      <div className="card flex flex-col gap-3">
        <p className="text-sm text-muted">
          Version <span className="font-mono text-fg">{APP_VERSION}</span>
          {built ? ` · built ${built}` : ""}
        </p>

        {status.kind === "available" ? (
          <>
            <p className="text-base font-medium text-accent" role="status">
              A new version is ready ({status.version}).
            </p>
            <button type="button" onClick={update} disabled={reloading} className="btn-primary">
              {reloading ? "Updating..." : "Update now"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={check}
            disabled={status.kind === "checking"}
            className="btn-ghost"
          >
            {status.kind === "checking" ? "Checking..." : "Check for updates"}
          </button>
        )}

        {status.kind === "current" && (
          <p className="text-sm text-ok" role="status">
            You are on the latest version.
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-danger" role="alert">
            Could not check right now. Are you online?
          </p>
        )}

        <button type="button" onClick={update} disabled={reloading} className="text-left text-sm text-muted underline underline-offset-4">
          Reload the app anyway
        </button>
      </div>
    </section>
  )
}
