# My Jamm

A personal guitar practice app: planned sessions, a repertoire grouped by chord family,
quick sets for any room, and performance mode. Single user. See [HANDOFF.md](HANDOFF.md)
for the full brief and build order.

Stack: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4, Supabase
(Postgres, Auth, Storage), deployed on Vercel.

## Status

- [x] Step 1: project setup, schema with RLS, magic-link auth, seed
- [x] Step 2: repertoire screen (families, filters, search, inline edit, one-tap status)
- [x] Step 3: theory engine (`src/lib/theory`, tested), transpose and capo on song cards
- [x] Theme: black / white / beige background and 6 accent colours (Settings, saved per device)
- [x] Step 4: performance mode (family medleys and sets, swipe, keeps screen awake)
- [x] Step 5: Today screen (week summary, timed session plan, metronome, one-tap session log)
- [x] Step 6: AI practice coach via OpenRouter (free NVIDIA Nemotron), validated, falls back to the built-in plan
- [x] Step 7: Sets (AI set builder with built-in fallback, drag to reorder, Go-to set, play in performance mode)
- [x] Step 8: Add song: Paste chords (read by the app, no AI, chords placed over the words), screenshot import for song lists (AI, long pages sliced, checked against the page's chord list), or type it in
- [x] Delete song (song page, also removes it from sets)
- [x] Song page: your lyrics with chords above the words, Save as my version, practice history
- [x] Songs: Show and Sort dropdowns (A to Z by default; family, key, least played, difficulty)
- [x] Invite only: Request access on sign-in, owner approves in Settings > Members
- [x] Songs is the home screen; tabs are Songs, Sets, Add, Practice, Metronome, Settings. Progress and session logging hidden for now
- [ ] Step 10: installable app, icons, polish

## Run locally

```bash
cp .env.example .env.local   # values for the Jam Supabase project are already filled in
npm install
npm run dev                  # http://localhost:3000
```

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Project layout

```
supabase/migrations/   SQL schema, RLS policies, last_practised trigger, storage bucket
src/proxy.ts           refreshes the session cookie and sends signed-out visitors to /login
src/lib/supabase/      Supabase clients (server, browser, proxy)
src/lib/auth.ts        requireUser(): use in every page and action that reads data
src/lib/seed/          starter repertoire + skills loader (shared by the app and the CLI)
src/data/              repertoire_seed.json exported from Notion
src/app/login/         email + code sign-in
src/app/auth/confirm/  where the magic link lands
src/app/(app)/         signed-in screens with the bottom tab bar
scripts/seed.ts        CLI seed (needs the service role key)
```

## One-time Supabase setup (dashboard)

1. **Authentication > URL Configuration**
   - Site URL: your Vercel production URL (for example `https://guitar-jam-aman-projects8.vercel.app`).
   - Redirect URLs: add `http://localhost:3000/**` and `https://*.vercel.app/**`.
2. **Authentication > Emails > Templates**. Paste this into both **Magic Link** and
   **Confirm signup** (the first sign-in uses Confirm signup, later ones use Magic Link):

   ```html
   <h2>Sign in to My Jamm</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Tap to sign in</a></p>
   <p>Or type this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   The link works in any browser. The code is for when the link opens somewhere other
   than where you started (for example the installed app on your phone).
3. After your first successful sign-in: **Authentication > Sign In / Providers**, turn
   off **Allow new users to sign up**. The app already rejects every email except
   `ALLOWED_EMAIL`; this closes the door at Supabase too.

## Seeding

Easiest: sign in, then tap **Load my repertoire** on the Today screen. It adds the 5
families, 63 songs and the skills ladder using your own session.

Or from a terminal (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, and you must have
signed in once):

```bash
npm run seed
```

Both are safe to run again: they only add what is missing and never overwrite edits.

## Deploy (Vercel)

Import the GitHub repo in Vercel, then add these environment variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_EMAIL`,
`APP_TIME_ZONE`, `OPENROUTER_API_KEY`. Do not add the service role key.

AI runs through OpenRouter, server side only, on a chain of free models tried in order:
`nvidia/nemotron-3.5-super-vl:free`, `google/gemma-4-31b-it:free`, `minimax/minimax-m3.1-flash:free`.
Override with comma-separated `OPENROUTER_MODEL` / `OPENROUTER_VISION_MODEL`. If every model
fails, the app uses its built-in plan or set builder. Settings > Test AI connection shows what happened.

## Rules

- Lyrics come only from what you type or paste yourself (chords inline as `[G]word`).
  Pasted chord sheets can keep their words too. They are private to your account and never sent to the AI. Screenshot import still strips lyrics.
- No em dashes in UI copy or AI output.
- The AI is never trusted for theory or transposition (step 3 adds a tested module for that).
