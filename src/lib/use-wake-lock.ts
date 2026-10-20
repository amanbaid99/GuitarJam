"use client"

import { useEffect, useState } from "react"

export type WakeState = "on" | "off" | "unsupported"

/**
 * Keeps the screen awake while `enabled` is true, taking the lock again
 * when the app comes back to the front (browsers drop it when hidden).
 */
export function useWakeLock(enabled = true): WakeState {
  const [state, setState] = useState<WakeState>("off")

  useEffect(() => {
    if (!enabled) return
    if (!("wakeLock" in navigator)) {
      queueMicrotask(() => setState("unsupported"))
      return
    }
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      if (document.visibilityState !== "visible") return
      try {
        lock = await navigator.wakeLock.request("screen")
        if (cancelled) {
          await lock.release()
          return
        }
        setState("on")
        lock.addEventListener("release", () => setState("off"))
      } catch {
        setState("off")
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") acquire()
    }

    acquire()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      lock?.release().catch(() => {})
    }
  }, [enabled])

  return enabled ? state : "off"
}
