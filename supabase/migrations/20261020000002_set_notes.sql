-- A few words about a set (from the AI set builder or typed by hand).
alter table public.sets add column notes text check (char_length(notes) <= 1000);
