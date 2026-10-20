"use client"

import { useActionState, useState } from "react"
import { requestAccess, sendLink, signOut, verifyCode, type LoginState, type RequestState } from "./actions"

const initial: LoginState = { step: "email" }

type Props = { linkError?: boolean; accessError?: boolean }

export function LoginForm({ linkError, accessError }: Props) {
  const [requesting, setRequesting] = useState<string | null>(null)
  const [sendState, send, sending] = useActionState(sendLink, initial)
  const [codeState, verify, verifying] = useActionState(verifyCode, initial)

  if (requesting !== null) return <RequestForm email={requesting} onBack={() => setRequesting(null)} />

  if (accessError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base">
          You are signed in, but this email is not on the invite list yet (or was removed).
        </p>
        <button type="button" onClick={() => setRequesting("")} className="btn-primary">
          Request access
        </button>
        <form action={signOut}>
          <button type="submit" className="btn-ghost w-full">
            Sign out
          </button>
        </form>
      </div>
    )
  }

  // Once the email is sent, show the code step. A failed code keeps us there.
  const onCodeStep = sendState.step === "code" || codeState.step === "code"
  const email =
    codeState.step === "code" ? codeState.email : sendState.step === "code" ? sendState.email : ""

  if (!onCodeStep) {
    const error =
      sendState.error ?? (linkError ? "That link did not work. Send yourself a new one." : undefined)
    return (
      <form action={send} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Email</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className="field"
            placeholder="you@example.com"
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {sendState.step === "email" && sendState.notInvited && (
          <button type="button" onClick={() => setRequesting(sendState.notInvited!)} className="btn-primary">
            Request access for this email
          </button>
        )}
        <button
          type="submit"
          disabled={sending}
          className={sendState.step === "email" && sendState.notInvited ? "btn-ghost" : "btn-primary"}
        >
          {sending ? "Sending..." : "Email me a sign-in link"}
        </button>
        <button type="button" onClick={() => setRequesting("")} className="min-h-11 text-sm text-muted">
          New here? <span className="text-accent underline underline-offset-4">Request access</span>
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base">
        Check <span className="font-semibold">{email}</span>. Tap the link in the email, or type
        the code from it here. The code is handy if the link opens in a different browser from
        this one.
      </p>
      <form action={verify} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            className="field text-center text-2xl tracking-[0.4em]"
          />
        </label>
        {codeState.step === "code" && codeState.error && (
          <p role="alert" className="text-sm text-danger">{codeState.error}</p>
        )}
        <button type="submit" disabled={verifying} className="btn-primary">
          {verifying ? "Checking..." : "Sign in"}
        </button>
      </form>
      <form action={send}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={sending} className="btn-ghost w-full">
          {sending ? "Sending..." : "Send a new email"}
        </button>
      </form>
    </div>
  )
}

const requestInitial: RequestState = { status: "idle" }

function RequestForm({ email, onBack }: { email: string; onBack: () => void }) {
  const [state, action, pending] = useActionState(requestAccess, requestInitial)

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base" role="status">
          {state.message}
        </p>
        <button type="button" onClick={onBack} className="btn-ghost">
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted">My Jamm is invite only for now. Ask for access and you will be able to sign in once approved.</p>
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">Email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={email} required className="field" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">Your name</span>
        <input name="name" autoComplete="name" maxLength={80} className="field" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">Anything to add? (optional)</span>
        <textarea name="note" maxLength={500} rows={2} className="field min-h-20 py-3" placeholder="How do we know each other?" />
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending..." : "Request access"}
      </button>
      <button type="button" onClick={onBack} className="btn-ghost">
        Back to sign in
      </button>
    </form>
  )
}
