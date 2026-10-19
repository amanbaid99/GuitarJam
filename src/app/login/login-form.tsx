"use client"

import { useActionState } from "react"
import { sendLink, verifyCode, type LoginState } from "./actions"

const initial: LoginState = { step: "email" }

export function LoginForm({ linkError }: { linkError?: boolean }) {
  const [sendState, send, sending] = useActionState(sendLink, initial)
  const [codeState, verify, verifying] = useActionState(verifyCode, initial)

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
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? "Sending..." : "Email me a sign-in link"}
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
