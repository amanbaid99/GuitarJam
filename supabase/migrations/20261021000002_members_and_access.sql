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
insert into public.members (email, role) values ('amanbaid99@gmail.com', 'owner');

-- ---------- helpers ----------

create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.members m
  where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
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
grant execute on function public.can_sign_in, public.request_access to anon, authenticated;
grant execute on function public.my_role, public.is_member, public.owner_requests, public.owner_members,
  public.decide_access, public.remove_member to authenticated;

-- ---------- data: members only ----------
-- Someone could create an account straight through the auth API (the public key is
-- public). They still cannot read or write anything unless they are a member.

alter policy "own families" on public.families
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own songs" on public.songs
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own sessions" on public.sessions
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own skills" on public.skills
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own sets" on public.sets
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
alter policy "own screenshots write" on storage.objects
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_member()));
