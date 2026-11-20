-- Read identity from the verified Neon account behind the Data API JWT.
create function public.verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from neon_auth."user" u
  where u.id::text = (select auth.user_id()) and u."emailVerified"
$$;
revoke execute on function public.verified_email from public;


-- Invite-only access. Only emails in public.members can use the app.
-- Anyone can ask to join through request_access(); the owner approves in Settings > Members.

create table public.members (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  role text not null default 'member' check (role in ('owner', 'member')),
  added_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  name text check (char_length(name) <= 80),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index access_requests_one_pending on public.access_requests (email) where status = 'pending';

-- No policies: these tables are only reachable through the functions below.
alter table public.members enable row level security;
alter table public.access_requests enable row level security;

-- The app's owner.


-- ---------- helpers ----------

create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.members m
  where m.email = lower(coalesce(public.verified_email(), ''))
$$;

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.email = lower(coalesce(public.verified_email(), ''))
  )
$$;

-- Before sending a sign-in email: is this address invited?
create function public.can_sign_in(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.email = lower(trim(p_email)))
$$;

-- Ask to join. Returns: requested | pending | member | invalid | busy
create function public.request_access(p_email text, p_name text default null, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 254 then
    return 'invalid';
  end if;
  if exists (select 1 from public.members m where m.email = e) then
    return 'member';
  end if;
  if exists (select 1 from public.access_requests r where r.email = e and r.status = 'pending') then
    return 'pending';
  end if;
  -- Simple flood guard for a small invite-only app.
  if (select count(*) from public.access_requests r where r.status = 'pending') >= 200 then
    return 'busy';
  end if;
  insert into public.access_requests (email, name, note)
  values (e, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''));
  return 'requested';
end;
$$;

-- ---------- owner only ----------

create function public.owner_requests()
returns setof public.access_requests
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return query select * from public.access_requests r where r.status = 'pending' order by r.created_at;
end;
$$;

create function public.owner_members()
returns setof public.members
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return query select * from public.members m order by m.role desc, m.added_at;
end;
$$;

create function public.decide_access(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text;
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.access_requests
     set status = case when p_approve then 'approved' else 'declined' end, decided_at = now()
   where id = p_request_id and status = 'pending'
   returning email into e;
  if e is null then
    raise exception 'request not found';
  end if;
  if p_approve then
    insert into public.members (email) values (e) on conflict (email) do nothing;
  end if;
end;
$$;

create function public.remove_member(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  delete from public.members m where m.email = lower(trim(p_email)) and m.role <> 'owner';
end;
$$;

revoke execute on function public.my_role, public.is_member, public.can_sign_in, public.request_access,
  public.owner_requests, public.owner_members, public.decide_access, public.remove_member from public;
grant execute on function public.can_sign_in, public.request_access to anonymous, authenticated;
grant execute on function public.my_role, public.is_member, public.owner_requests, public.owner_members,
  public.decide_access, public.remove_member to authenticated;


-- Keep the restored ownership UUID for the owner and use Neon UUIDs for new members.
alter table public.members add column library_id uuid unique;
create function public.app_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(m.library_id, u.id)
  from neon_auth."user" u join public.members m on m.email = lower(u.email)
  where u.id::text = (select auth.user_id()) and u."emailVerified"
$$;
revoke execute on function public.app_user_id from public;
grant execute on function public.app_user_id to authenticated;


-- My Jamm: initial schema
-- Every table is owned by one user and locked down with RLS (user_id = public.app_user_id()).
-- user_id defaults to public.app_user_id(), so the app never has to send it.

-- ---------- tables ----------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.app_user_id(),
  name text not null,            -- e.g. 'Em-D-C'
  key text not null,             -- e.g. 'G'
  numbers text not null,         -- e.g. 'vi-V-IV'
  vibe text,                     -- e.g. 'Hindi sing-along'
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.app_user_id(),
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
  user_id uuid not null default public.app_user_id(),
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
  user_id uuid not null default public.app_user_id(),
  area text not null,            -- basics, rhythm, chords, lead, fingerstyle, theory
  name text not null,
  level text not null check (level in ('not_started','to_check','learning','comfortable')),
  is_focus boolean not null default false,
  unique (user_id, area, name)
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.app_user_id(),
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
  using (user_id = (select public.app_user_id())) with check (user_id = (select public.app_user_id()));

create policy "own songs" on public.songs for all to authenticated
  using (user_id = (select public.app_user_id())) with check (user_id = (select public.app_user_id()));

create policy "own sessions" on public.sessions for all to authenticated
  using (user_id = (select public.app_user_id())) with check (user_id = (select public.app_user_id()));

create policy "own skills" on public.skills for all to authenticated
  using (user_id = (select public.app_user_id())) with check (user_id = (select public.app_user_id()));

create policy "own sets" on public.sets for all to authenticated
  using (user_id = (select public.app_user_id())) with check (user_id = (select public.app_user_id()));

-- session_songs has no user_id: both the session and the song must be yours.
create policy "own session songs" on public.session_songs for all to authenticated
  using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select public.app_user_id()))
  )
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select public.app_user_id()))
    and exists (select 1 from public.songs g where g.id = song_id and g.user_id = (select public.app_user_id()))
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



-- Someone could create an account straight through the auth API (the public key is
-- public). They still cannot read or write anything unless they are a member.

alter policy "own families" on public.families
  using (user_id = (select public.app_user_id()) and (select public.is_member()))
  with check (user_id = (select public.app_user_id()) and (select public.is_member()));
alter policy "own songs" on public.songs
  using (user_id = (select public.app_user_id()) and (select public.is_member()))
  with check (user_id = (select public.app_user_id()) and (select public.is_member()));
alter policy "own sessions" on public.sessions
  using (user_id = (select public.app_user_id()) and (select public.is_member()))
  with check (user_id = (select public.app_user_id()) and (select public.is_member()));
alter policy "own skills" on public.skills
  using (user_id = (select public.app_user_id()) and (select public.is_member()))
  with check (user_id = (select public.app_user_id()) and (select public.is_member()));
alter policy "own sets" on public.sets
  using (user_id = (select public.app_user_id()) and (select public.is_member()))
  with check (user_id = (select public.app_user_id()) and (select public.is_member()));

-- Log a practice session and the songs played, in one transaction.
-- security invoker: runs as the signed-in user, so RLS still applies to every insert,
-- and the session_songs trigger moves each song's last_practised forward.

create function public.log_session(
  p_minutes int,
  p_date date default null,
  p_focus text default null,
  p_how_it_went text default null,
  p_notes text default null,
  p_song_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.sessions (date, minutes, focus, how_it_went, notes)
  values (coalesce(p_date, current_date), p_minutes, p_focus, p_how_it_went, p_notes)
  returning id into new_id;

  insert into public.session_songs (session_id, song_id)
  select new_id, s from (select distinct unnest(p_song_ids) as s) u;

  return new_id;
end;
$$;

revoke execute on function public.log_session from public, anonymous;
grant execute on function public.log_session to authenticated;

-- A few words about a set (from the AI set builder or typed by hand).
alter table public.sets add column notes text check (char_length(notes) <= 1000);

-- Lyrics you type yourself (chords inline as [G]word). Private to you; never sent to the AI.
alter table public.songs add column lyrics text check (char_length(lyrics) <= 20000);

-- "My version": how you actually play it, applied on top of the written chords.
-- my_transpose moves the sound (semitones); my_capo is where you put the capo
-- (null = use the capo written in key_capo).
alter table public.songs
  add column my_transpose smallint not null default 0 check (my_transpose between -11 and 11),
  add column my_capo smallint check (my_capo between 0 and 12);

-- Groups (the table is still called families): songs that share chord shapes,
-- played as a ready-made set. These columns hold the play order.

-- Order of a song inside its group (1 = first). Null when the song has no group.
alter table public.songs add column if not exists group_position smallint;

-- Order of the groups on the Sets tab (lowest first).
alter table public.families add column if not exists position smallint not null default 0;

create index if not exists songs_family_position_idx on public.songs (family_id, group_position);

grant usage on schema public to anonymous, authenticated;
grant select, insert, update, delete on public.families, public.songs, public.skills, public.sets, public.sessions, public.session_songs to authenticated;
