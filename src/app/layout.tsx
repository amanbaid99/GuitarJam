import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { THEME_INIT_SCRIPT } from "@/lib/theme"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "My Jamm", template: "%s | My Jamm" },
  description: "Guitar practice, repertoire and sets.",
  appleWebApp: { capable: true, title: "My Jamm", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-bg="black"
      data-accent="amber"
      // The theme script changes data-bg/data-accent before React loads.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
