import type { NextRequest } from "next/server"
import { neonAuth } from "@/lib/neon/auth"

export function proxy(request: NextRequest) {
  return neonAuth().middleware({ loginUrl: "/login", publicRoutes: ["/login", "/auth/confirm"] })(request)
}

export const config = {
  matcher: [
    // Everything except static files, images and PWA assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
