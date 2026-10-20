"use client"

import { useState, useTransition } from "react"
import { testAi, type AiTestResult } from "./actions"

export function AiCheck() {
  const [result, setResult] = useState<AiTestResult | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    setResult(null)
    startTransition(async () => setResult(await testAi("text")))
  }

  return (
    <section className="flex flex-col gap-3" aria-label="AI connection">
      <h2 className="text-lg font-semibold">AI coach</h2>
      <div className="card flex flex-col gap-3">
        <p className="text-sm text-muted">
          Checks the OpenRouter key and the free model. Takes up to a minute.
        </p>
        <button type="button" onClick={run} disabled={pending} className="btn-ghost">
          {pending ? "Testing..." : "Test AI connection"}
        </button>
        {result?.ok && (
          <p className="text-sm text-ok" role="status">
            Working. {result.model} answered in {(result.ms / 1000).toFixed(1)} s.
          </p>
        )}
        {result && !result.ok && (
          <div className="flex flex-col gap-1" role="alert">
            <p className="text-sm text-danger">{result.message}</p>
            <p className="font-mono text-xs break-words text-muted">
              {result.model}: {result.detail}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
