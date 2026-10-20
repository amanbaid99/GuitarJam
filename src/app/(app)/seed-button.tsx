"use client"

import { useActionState } from "react"
import { loadStarterData, type SeedState } from "./actions"

export function SeedButton({ label = "Load my repertoire" }: { label?: string }) {
  const [state, action, pending] = useActionState<SeedState>(loadStarterData, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Setting up..." : label}
      </button>
      {state.message && <p className="text-sm text-ok">{state.message}</p>}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  )
}
