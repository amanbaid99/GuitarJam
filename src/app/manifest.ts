import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "My Jamm",
    short_name: "My Jamm",
    description: "Guitar practice, repertoire and sets.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#17140f",
    theme_color: "#0d0f12",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
