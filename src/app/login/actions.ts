"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { allowedEmail } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export type LoginState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string }

const emailSchema = z.email()
const codeSchema = z.string().regex(/^\d{6,10}$/)

/** Step 1: email the magic link (which also contains a sign-in code). */
export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase())
  if (!parsed.success) return { step: "email", error: "That email does not look right." }
  const email = parsed.data

  const allowed = allowedEmail()
  if (!allowed) return { step: "email", error: "ALLOWED_EMAIL is not set on the server." }
  if (email !== allowed) return { step: "email", error: "This app is private." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
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

  if (email !== allowedEmail()) return { step: "email", error: "This app is private." }
  if (!codeSchema.safeParse(code).success) {
    return { step: "code", email, error: "Enter the code from the email." }
  }

  const supabase = await createClient()
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

function friendlyAuthError(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return "Too many emails just now. Wait a minute and try again."
  }
  if (/signups not allowed/i.test(message)) {
    return "Sign ups are turned off and this account does not exist yet."
  }
  return message
}
