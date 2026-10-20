-- Lyrics you type yourself (chords inline as [G]word). Private to you; never sent to the AI.
alter table public.songs add column lyrics text check (char_length(lyrics) <= 20000);

-- "My version": how you actually play it, applied on top of the written chords.
-- my_transpose moves the sound (semitones); my_capo is where you put the capo
-- (null = use the capo written in key_capo).
alter table public.songs
  add column my_transpose smallint not null default 0 check (my_transpose between -11 and 11),
  add column my_capo smallint check (my_capo between 0 and 12);
