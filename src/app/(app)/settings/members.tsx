"use client"

import { useState, useTransition } from "react"
import { shortDate } from "@/lib/dates"
import { decideAccess, removeMember } from "./members-actions"

export type PendingRequest = { id: string; email: string; name: string | null; note: string | null; created_at: string }
export type Member = { email: string; role: string; added_at: string }

export function Members({
  requests,
  members,
  ready,
}: {
  requests: PendingRequest[]
  members: Member[]
  /** False until the members migration is applied. */
  ready: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? "Something went wrong.")
    })
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Members">
      <h2 className="text-lg font-semibold">Members</h2>
      {!ready ? (
        <p className="card text-sm text-muted">
          The members list is not set up in the database yet, so only you can sign in. Apply the
          members migration in Supabase to start inviting people.
        </p>
      ) : (
        <>
          <div className="card flex flex-col gap-3">
            <h3 className="font-semibold">
              Requests{requests.length ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{requests.length}</span> : null}
            </h3>
            {requests.length === 0 && <p className="text-sm text-muted">No one is waiting.</p>}
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-bg p-3">
                <div>
                  <p className="font-medium break-all">{r.name ? `${r.name} · ` : ""}{r.email}</p>
                  <p className="text-xs text-muted">Asked {shortDate(r.created_at.slice(0, 10))}</p>
                  {r.note && <p className="mt-1 text-sm">{r.note}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={pending} onClick={() => run(() => decideAccess(r.id, false))} className="btn-ghost min-h-11">
                    Decline
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(() => decideAccess(r.id, true))} className="btn-primary min-h-11 text-base">
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card flex flex-col gap-2">
            <h3 className="font-semibold">People with access</h3>
            <ul className="flex flex-col divide-y divide-border">
              {members.map((m) => (
                <li key={m.email} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm">{m.email}</span>
                  {m.role === "owner" ? (
                    <span className="shrink-0 text-xs text-muted">Owner</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Remove access for ${m.email}? Their songs stay, but they cannot sign in.`)) {
                          run(() => removeMember(m.email))
                        }
                      }}
                      className="min-h-11 shrink-0 px-2 text-sm text-danger"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
