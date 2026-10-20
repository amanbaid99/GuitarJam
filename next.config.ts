import type { NextConfig } from "next";

// Stamped into every build so the app can tell when a newer version is live.
// On Vercel this is the git commit; locally it is the build time.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? `local-${Date.now().toString(36)}`
const BUILT_AT = new Date().toISOString()

const nextConfig: NextConfig = {
  env: {
    APP_VERSION,
    APP_BUILT_AT: BUILT_AT,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
