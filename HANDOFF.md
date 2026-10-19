# Riyaaz: build handoff for Claude Code

Working name: Riyaaz (Hindustani for daily practice). Easy to rename later.

## What this is
A personal guitar practice app for one user (Aman). Phone and web. It helps him:
1. Practise regularly (small, planned sessions and a simple log)
2. Organise his repertoire into chord families and play medleys from memory
3. Build a quick set for any room ("play something!")
4. Add new songs fast by importing a chord chart screenshot

Single user. No sharing, no social, no monetisation.

## Player context (use this to design and to prompt the AI)
- Guitar: Yamaha FX280 acoustic with built-in tuner, has a capo
- Level: intermediate rhythm player, rusty. Knows open, barre, slash and most extended chords
- Plays about once a week now. Target: 2 sessions a week, 20 min each
- Current focus: strumming with a metronome. Focus song: Yellow (Coldplay)
- Tastes: Bollywood, old Hindi, classic rock, John Mayer, Coldplay, James Blunt
- Skill gaps: lead (pentatonic, bends), fingerstyle, theory, playing by ear

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- Supabase: Postgres, Auth (email magic link, single user), Storage (screenshot uploads)
- Installable PWA so it feels like an app on the phone
- AI: Anthropic Claude API, called only from server code (Next.js route handlers or Supabase edge functions). API key never in the client
- Mobile-first layout, large tap targets (he is holding a guitar), dark mode default

## Data model (Supabase)
Enable RLS on every table, policy: `user_id = auth.uid()`.

```sql
create table families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  name text not null,            -- e.g. 'Em-D-C'
  key text not null,             -- e.g. 'G'
  numbers text not null,         -- e.g. 'vi-V-IV'
  vibe text,                     -- e.g. 'Hindi sing-along'
  created_at timestamptz default now()
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  title text not null,
  artist text,
  status text not null check (status in ('want_to_learn','learning','can_play','polished')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  style text check (style in ('strumming','fingerstyle','riff_lead','mixed')),
  family_id uuid references families,
  key_capo text,
  chords text,                   -- free text chord chart, sections allowed
  first_line_hint text,          -- a few words to jog memory, never full lyrics
  tab_link text,
  notes text,
  needs_verify boolean default false,   -- true when chords came from AI
  last_practised date,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  date date not null default current_date,
  minutes int not null,
  focus text,                    -- skill worked on
  how_it_went text check (how_it_went in ('rough','ok','good','great')),
  notes text,
  created_at timestamptz default now()
);

create table session_songs (
  session_id uuid references sessions on delete cascade,
  song_id uuid references songs on delete cascade,
  primary key (session_id, song_id)
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  area text not null,            -- basics, rhythm, chords, lead, fingerstyle, theory
  name text not null,
  level text not null check (level in ('not_started','to_check','learning','comfortable')),
  is_focus boolean default false
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  name text,
  room text,                     -- e.g. 'friends, mostly Hindi, 20 min'
  song_ids uuid[] not null,      -- ordered
  created_at timestamptz default now()
);
```

When a session is logged, update `last_practised` on each linked song.

## Seed data
`repertoire_seed.json` (attached alongside this file) holds 5 families and 63 songs exported from his Notion. Write a seed script that inserts the families, then the songs, mapping `family` names to `family_id`.

Seed `skills` with:
- basics: open chords, clean changes, basic strumming: comfortable
- rhythm: strumming with a metronome: learning (is_focus = true); palm muting, syncopation: to_check
- chords: barre chords, slash chords: comfortable; 7th/add9/sus chords: learning; power chords: to_check
- lead: minor pentatonic box 1, bends, hammer-ons and pull-offs, slides: to_check
- fingerstyle: basic arpeggios: to_check; Travis picking: not_started
- theory: chord families: learning; number system: not_started; fretboard notes, major scale, CAGED: to_check; playing by ear: not_started

## Screens (v1)

### 1. Today (home)
- Streak-free summary: sessions this week vs target (2), minutes this week
- Time picker: 10 / 15 / 20 / 30 min, then "Plan my session" (AI coach, see below)
- Plan shows as timed blocks (warm-up, skill, song, free play) with a simple countdown per block
- Built-in metronome: BPM, tap tempo, accent on beat 1, works with screen locked if possible (Web Audio API)
- "Log session" button: prefilled from the plan, one tap to save, optional how-it-went and note

### 2. Repertoire
- Grouped by family (collapsible), then an "Unassigned" group
- Filters: status, difficulty, style
- Song card: title, artist, family, key/capo, chords, first line hint, last practised, needs-verify badge
- Edit inline; change status in one tap
- Transpose control on a song: shows chords shifted by semitones, and the capo equivalent (deterministic code, see Theory engine)

### 3. Performance mode
- Full screen, very large text, screen stays awake (Wake Lock API)
- Swipe between songs of a set or a family medley
- Each card: title, family, chords, first line hint. Nothing else

### 4. Sets
- "Build a set": inputs are room (free text), language mix, minutes. AI returns an ordered list from his Can play and Polished songs only
- Save, reorder by drag, open in Performance mode
- One default saved set: "Go-to set" (opener Stand by Me or Pani Da Rang, a family medley, a switch, an optional showpiece like Wonderful Tonight, closer Yaaron or Ek Ajnabee Haseena Se)

### 5. Add song
- Manual form, or "Import from screenshot": upload image to Storage, AI extracts title, artist, chords, key/capo and suggests a family
- Always lands on a review screen before saving; anything AI-filled sets `needs_verify = true` until he confirms

### 6. Progress (simple)
- Minutes per week (last 8 weeks), sessions per week, songs moved up a status, skills ladder with one-tap level changes

## Theory engine (deterministic, no AI)
Write a small pure TypeScript module with unit tests:
- Parse chord names (root, accidental, quality, extensions, slash bass)
- Transpose by semitones, prefer sharps or flats by key
- Capo math: given shapes and capo fret, return sounding chords, and the reverse
- Number system: given a key, return the diatonic chords (I ii iii IV V vi vii°) and convert a progression to numbers
- Suggest a family for a song by matching its chord set against family chord sets

The AI must never be trusted for transposition or theory. Use this module.

## AI features (v1)
Use Claude via server routes. Return strict JSON, validate with zod, fail gracefully.

### Practice coach
Input: minutes available, current focus skill and song, skills ladder, songs with last_practised and status, last 14 days of sessions.
Output JSON: `{ blocks: [{ label, minutes, instruction, song_id? }], why: string }`.
Rules for the prompt:
- Blocks must sum to the minutes given
- Shape: warm-up, focus skill, song, free play. Shrink or merge blocks for 10 min
- Prefer the focus song; rotate in one family song not played in 21+ days
- If fewer than 2 sessions in the last 14 days, keep it short and easy and say so kindly
- Chord shapes as fret numbers (G = 320003), strumming as D DU UDU
- Plain, encouraging, honest. No em dashes

### Screenshot import
Input: image. Output JSON: `{ songs: [{ title, artist?, chords?, key_capo?, sections? }] }`. One image may contain many songs (his notes app had tables). Never output lyrics. Then run the theory engine to suggest a family.

### Set builder
Input: room description, minutes, his Can play and Polished songs with family, difficulty, style.
Output JSON: `{ name, song_ids: [], notes }`. Rules: open with a well-known song, group by family for medleys, at most one hard showpiece, end on a sing-along. Only use provided song_ids.

## Hard rules
- Never store or display full song lyrics. A short first-line hint (a few words) is the maximum
- No em dashes anywhere in UI copy or AI output
- Single user, but keep RLS on

## Not in v1
- Mic listening or chord detection (dropped)
- Ear trainer (v2)
- Notion sync (Notion keeps only a summary page; the app is the source of truth)

## Build order
1. Project setup, Supabase schema, RLS, auth, seed script
2. Repertoire screen with families and edit
3. Theory engine with tests, then transpose and capo on song cards
4. Performance mode
5. Today screen: metronome and session log
6. AI practice coach
7. Sets and AI set builder
8. Screenshot import
9. Progress screen
10. PWA install, icons, polish

## Kickoff prompt for Claude Code
> Read HANDOFF.md and repertoire_seed.json. This repo is empty and a new Supabase project exists. Start with step 1 of the build order: set up Next.js + TypeScript + Tailwind, write the Supabase migration for the data model with RLS, magic-link auth for a single user, and a seed script that loads repertoire_seed.json and the skills list. Ask me for the Supabase URL and keys when you need them. Show me the plan before writing code, then work through the build order one step at a time, stopping after each step so I can test on my phone.
