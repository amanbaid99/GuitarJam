-- Riyaaz: initial schema
-- Every table is owned by one user and locked down with RLS (user_id = auth.uid()).
-- user_id defaults to auth.uid(), so the app never has to send it.

-- ---------- tables ----------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,            -- e.g. 'Em-D-C'
  key text not null,             -- e.g. 'G'
  numbers text not null,         -- e.g. 'vi-V-IV'
  vibe text,                     -- e.g. 'Hindi sing-along'
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  artist text,
  status text not null check (status in ('want_to_learn','learning','can_play','polished')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  style text check (style in ('strumming','fingerstyle','riff_lead','mixed')),
  family_id uuid references public.families on delete set null,
  key_capo text,
  chords text,                   -- free text chord chart, sections allowed
  first_line_hint text check (char_length(first_line_hint) <= 60), -- a few words, never full lyrics
  tab_link text,
  notes text,
  needs_verify boolean not null default false,  -- true when chords came from AI
  last_practised date,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null default current_date,
  minutes int not null check (minutes > 0),
  focus text,
  how_it_went text check (how_it_went in ('rough','ok','good','great')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.session_songs (
  session_id uuid not null references public.sessions on delete cascade,
  song_id uuid not null references public.songs on delete cascade,
  primary key (session_id, song_id)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  area text not null,            -- basics, rhythm, chords, lead, fingerstyle, theory
  name text not null,
  level text not null check (level in ('not_started','to_check','learning','comfortable')),
  is_focus boolean not null default false,
  unique (user_id, area, name)
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  room text,                     -- e.g. 'friends, mostly Hindi, 20 min'
  song_ids uuid[] not null,      -- ordered
  created_at timestamptz not null default now()
);

-- ---------- indexes (foreign keys and per-user lookups) ----------

create index songs_user_id_idx on public.songs (user_id);
create index songs_family_id_idx on public.songs (family_id);
create index sessions_user_id_date_idx on public.sessions (user_id, date desc);
create index session_songs_song_id_idx on public.session_songs (song_id);
create index skills_user_id_idx on public.skills (user_id);
create index sets_user_id_idx on public.sets (user_id);

-- ---------- row level security ----------

alter table public.families enable row level security;
alter table public.songs enable row level security;
alter table public.sessions enable row level security;
alter table public.session_songs enable row level security;
alter table public.skills enable row level security;
alter table public.sets enable row level security;

create policy "own families" on public.families for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own songs" on public.songs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own sessions" on public.sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own skills" on public.skills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own sets" on public.sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- session_songs has no user_id: both the session and the song must be yours.
create policy "own session songs" on public.session_songs for all to authenticated
  using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.songs g where g.id = song_id and g.user_id = (select auth.uid()))
  );

-- ---------- last_practised ----------
-- When a song is linked to a session, move the song's last_practised forward
-- to that session's date (never backwards, so logging an old session is safe).

create function public.touch_last_practised()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.songs g
     set last_practised = greatest(coalesce(g.last_practised, s.date), s.date)
    from public.sessions s
   where s.id = new.session_id
     and g.id = new.song_id;
  return new;
end;
$$;

create trigger session_songs_touch_last_practised
  after insert on public.session_songs
  for each row execute function public.touch_last_practised();

-- ---------- storage: chord chart screenshots ----------
-- Private bucket. Files live under '<user id>/...' and only the owner can touch them.

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "own screenshots read" on storage.objects for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own screenshots write" on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own screenshots delete" on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
