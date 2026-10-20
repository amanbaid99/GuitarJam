import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in" }

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">My Jamm</h1>
        <p className="text-muted">Daily practice, your songs, ready for any room.</p>
      </div>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithError searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function LoginFormWithError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"]
}) {
  const params = await searchParams
  return <LoginForm linkError={params.error === "link"} />
}
