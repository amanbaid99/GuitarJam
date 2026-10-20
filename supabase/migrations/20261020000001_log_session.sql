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

revoke execute on function public.log_session from public, anon;
grant execute on function public.log_session to authenticated;
