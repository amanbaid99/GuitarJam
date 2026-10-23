-- Groups (the table is still called families): songs that share chord shapes,
-- played as a ready-made set. These columns hold the play order.

-- Order of a song inside its group (1 = first). Null when the song has no group.
alter table public.songs add column if not exists group_position smallint;

-- Order of the groups on the Sets tab (lowest first).
alter table public.families add column if not exists position smallint not null default 0;

create index if not exists songs_family_position_idx on public.songs (family_id, group_position);
