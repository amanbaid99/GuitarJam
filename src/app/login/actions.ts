"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { canSignIn } from "@/lib/access"
import { createClient } from "@/lib/supabase/server"

export type LoginState =
  | { step: "email"; error?: string; notInvited?: string }
  | { step: "code"; email: string; error?: string }

const emailSchema = z.email()
const codeSchema = z.string().regex(/^\d{6,10}$/)

/** Step 1: email the magic link (which also contains a sign-in code). */
export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase())
  if (!parsed.success) return { step: "email", error: "That email does not look right." }
  const email = parsed.data

  const supabase = await createClient()
  if (!(await canSignIn(supabase, email))) {
    return { step: "email", error: "This email is not invited yet.", notInvited: email }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // Send the link straight to our confirm route on whichever URL you are using
      // (production, preview or localhost). Must match Supabase's Redirect URLs list.
      emailRedirectTo: `${await requestOrigin()}/auth/confirm`,
    },
  })
  if (error) {
    return { step: "email", error: friendlyAuthError(error.message) }
  }
  return { step: "code", email }
}

/** Step 2 (optional): type the code from the email instead of tapping the link. */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const code = String(formData.get("code") ?? "").replace(/\s/g, "")

  const supabase = await createClient()
  if (!(await canSignIn(supabase, email))) return { step: "email", error: "This email is not invited yet.", notInvited: email }
  if (!codeSchema.safeParse(code).success) {
    return { step: "code", email, error: "Enter the code from the email." }
  }

  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" })
  if (error) {
    return { step: "code", email, error: "That code did not work. It may have expired, so send a new one." }
  }
  redirect("/")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

function friendlyAuthError(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return "Too many emails just now. Wait a minute and try again."
  }
  if (/signups not allowed/i.test(message)) {
    return "Sign ups are turned off and this account does not exist yet."
  }
  return message
}

export type RequestState = { status: "idle" | "done" | "error"; message?: string }

const requestSchema = z.object({
  email: z.email("That email does not look right."),
  name: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
})

/** Ask the owner for access. Anyone can call this; it only adds a pending request. */
export async function requestAccess(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const parsed = requestSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? ""),
    note: String(formData.get("note") ?? ""),
  })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("request_access", {
    p_email: parsed.data.email,
    p_name: parsed.data.name || null,
    p_note: parsed.data.note || null,
  })
  if (error) return { status: "error", message: "Requests are not open yet. Ask the owner directly." }
  switch (data) {
    case "requested":
      return { status: "done", message: "Request sent. You can sign in once it is approved." }
    case "pending":
      return { status: "done", message: "You already asked. It is waiting for approval." }
    case "member":
      return { status: "done", message: "You are already in. Go back and sign in." }
    case "invalid":
      return { status: "error", message: "That email does not look right." }
    default:
      return { status: "error", message: "Too many requests right now. Try again later." }
  }
}
