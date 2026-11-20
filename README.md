# My Jamm

A personal guitar practice app: planned sessions, a repertoire grouped by chord family,
quick sets for any room, and performance mode. Single user. See [HANDOFF.md](HANDOFF.md)
for the full brief and build order.

Stack: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4, Neon
(Postgres, Auth, Data API), deployed on Vercel.

## Status

- [x] Step 1: project setup, schema with RLS, email code sign-in, seed
- [x] Step 2: repertoire screen (families, filters, search, inline edit, one-tap status)
- [x] Step 3: theory engine (`src/lib/theory`, tested), transpose and capo on song cards
- [x] Theme: black / white / beige background and 6 accent colours (Settings, saved per device)
- [x] Step 4: performance mode (family medleys and sets, swipe, keeps screen awake)
- [x] Step 5: Today screen (week summary, timed session plan, metronome, one-tap session log)
- [x] Step 6: AI practice coach via OpenRouter (free NVIDIA Nemotron), validated, falls back to the built-in plan
- [x] Step 7: Sets (AI set builder with built-in fallback, drag to reorder, Go-to set, play in performance mode)
- [x] Step 8: Add song: Paste chords (read by the app, no AI, chords placed over the words), screenshot import for song lists (AI, long pages sliced, checked against the page's chord list), or type it in
- [x] Delete song (song page, also removes it from sets)
- [x] Groups: songs that share chord shapes (by key, capo not counted) play as ready-made sets in your order. New songs get a suggested group to confirm; songs without chords wait outside; the rest go to Other. AI set builder parked for now
- [x] Song page: your lyrics with chords above the words, Save as my version, practice history
- [x] Songs: Show and Sort dropdowns (A to Z by default; family, key, least played, difficulty)
- [x] Invite only: Request access on sign-in, owner approves in Settings > Members
- [x] Songs is the home screen; tabs are Songs, Sets, Add, Practice, Metronome, Settings. Progress and session logging hidden for now
- [ ] Step 10: installable app, icons, polish

## Run locally

```bash
cp .env.example .env.local   # fill in the Neon test branch values below
npm install
npm run dev                  # http://localhost:3000
```

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Project layout

```
neon/001_app.sql       app schema, membership functions and row-level security
supabase/migrations/  historical schema for the old backend
src/proxy.ts          redirects signed-out visitors to /login
src/lib/neon/         server-side Neon Auth and PostgREST clients
src/lib/auth.ts       verifies account, membership and library ownership
src/lib/seed/         starter repertoire and skills
src/app/login/        email-code sign-in and access requests
src/app/(app)/        signed-in screens with the bottom tab bar
```

## Neon setup

1. Enable Neon Auth and the Data API on the same branch. Configure the Data API
   to use Neon Auth and leave automatic table grants disabled.
2. Apply `neon/001_app.sql` to a fresh database after enabling both services.
   Insert the owner's verified email in `public.members` with role `owner`.
   When importing an existing library, set that row's `library_id` to its
   original owner UUID after checking the backup account owns the records.
3. Set `NEON_AUTH_BASE_URL`, `NEON_DATA_API_URL`, `NEON_AUTH_COOKIE_SECRET`
   (use a fresh secret of at least 32 characters), and `ALLOWED_EMAIL`.
   Allow localhost in the test branch's Auth settings for local sign-in.
4. For deployment, set those variables in Vercel for the target branch and add
   the deployment origin to Neon Auth's trusted origins. Configure email
   delivery before switching production.

Use **Load my repertoire** on Songs to seed an empty library. The legacy CLI
seed command applies only to Supabase backups.

`APP_TIME_ZONE` and `OPENROUTER_API_KEY` configure practice dates and AI.

AI runs through OpenRouter, server side only, on a chain of free models tried in order:
`nvidia/nemotron-3.5-super-vl:free`, `google/gemma-4-31b-it:free`, `minimax/minimax-m3.1-flash:free`.
Override with comma-separated `OPENROUTER_MODEL` / `OPENROUTER_VISION_MODEL`. If every model
fails, the app uses its built-in plan or set builder. Settings > Test AI connection shows what happened.

## Rules

- Lyrics come only from what you type or paste yourself (chords inline as `[G]word`).
  Pasted chord sheets can keep their words too. They are private to your account and never sent to the AI. Screenshot import still strips lyrics.
- No em dashes in UI copy or AI output.
- The AI is never trusted for theory or transposition (step 3 adds a tested module for that).
