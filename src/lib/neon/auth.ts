import "server-only"
import { createNeonAuth } from "@neon/auth/next/server"

type AuthError = { message: string }

// These endpoints are present in the SDK's server endpoint map but are
// omitted from its inferred Better Auth server types.
type ManagedEndpoints = {
  token(): Promise<{ data: { token: string } | null; error: AuthError | null }>
  emailOtp: {
    sendVerificationOtp(input: { email: string; type: "sign-in" }): Promise<{ error: AuthError | null }>
  }
  signIn: {
    emailOtp(input: { email: string; otp: string }): Promise<{ error: AuthError | null }>
  }
}

export function neonAuth() {
  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  }) as ReturnType<typeof createNeonAuth> & ManagedEndpoints
}
