import { Suspense } from "react"
import { BottomNav, NavBar } from "./bottom-nav"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div
        className="mx-auto w-full max-w-xl px-4 pb-28"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
      >
        {children}
      </div>
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  )
}
