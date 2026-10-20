"use client"

import { useSyncExternalStore } from "react"

/**
 * A tiny per-device store backed by localStorage, readable with
 * useSyncExternalStore (no hydration mismatch, no setState in effects).
 * Storage can be blocked (private mode), so every access is guarded and
 * the app keeps working in memory.
 */
export function createLocalStore<T>(key: string, parse: (raw: unknown) => T | null, fallback: T) {
  const listeners = new Set<() => void>()
  let cache: T | undefined

  function read(): T {
    if (cache !== undefined) return cache
    try {
      const raw = localStorage.getItem(key)
      cache = (raw ? parse(JSON.parse(raw)) : null) ?? fallback
    } catch {
      cache = fallback
    }
    return cache
  }

  function set(value: T) {
    cache = value
    try {
      if (value === fallback) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore: value still lives in memory for this visit.
    }
    listeners.forEach((l) => l())
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, read, () => fallback)
  }

  return { get: read, set, useValue }
}
