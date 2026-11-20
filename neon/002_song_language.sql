alter table public.songs
  add column if not exists language text
  check (language in ('hindi', 'english'));

create or replace function public.tag_song_languages(p_song_ids uuid[], p_language text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.songs set language = p_language where id = any(p_song_ids);
  get diagnostics changed = row_count;
  if changed <> cardinality(p_song_ids) then
    raise exception 'Some songs were not available to update';
  end if;
end;
$$;

revoke execute on function public.tag_song_languages(uuid[], text) from public;
grant execute on function public.tag_song_languages(uuid[], text) to authenticated;
