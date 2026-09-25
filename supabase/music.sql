-- Little City music: the in-game playlist. Run the whole file once in the Supabase SQL editor (nothing highlighted).
-- Safe to run again; it keeps your files and tracks.
--
-- Then add music either way:
--   * Dashboard: Storage -> music -> Upload files. Every audio file at the top of the bucket plays, in file-name order,
--     titled from its name ("01 - Artist - Title.mp3" shows as "Title" by "Artist").
--   * Script: node scripts/upload-music.mjs "your folder" (README 15), which also fills the music_tracks table.
-- The optional music_tracks table sets a track's title, artist and position, or hides it (enabled = false).
--
-- Files live in a public Storage bucket named 'music': anyone with a track's link can play it, which is what an
-- in-game radio needs. Only you can add, change or delete files and tracks (dashboard, or the script with your secret
-- key): players get no insert, update or delete rights. They can only list the bucket and read the playlist table.
-- Only upload music you have the right to share publicly.

-- The bucket: public reads, audio files only, 50 MB each (the free plan's upload limit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/flac', 'audio/x-flac', 'audio/x-aac'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Optional: a title, artist and position per file, or enabled = false to hide it. Files without a row still play.
create table if not exists public.music_tracks (
  id bigint generated always as identity primary key,
  path text not null unique check (char_length(path) between 1 and 200 and path !~ '(^/|\.\.|\\)'), -- the file's name in the bucket
  title text not null check (char_length(title) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 120),
  position integer not null default 0,
  enabled boolean not null default true,
  added_at timestamptz not null default now()
);
alter table public.music_tracks enable row level security;
revoke all on public.music_tracks from anon, authenticated;
grant select on public.music_tracks to anon, authenticated;
drop policy if exists "players read enabled tracks" on public.music_tracks;
drop policy if exists "players read the playlist" on public.music_tracks;
-- Hidden tracks are readable too, so the game knows to skip those files in the bucket.
create policy "players read the playlist" on public.music_tracks for select to anon, authenticated using (true);

-- Players may list the files in the music bucket (reading them needs no policy: the bucket is public).
drop policy if exists "players list music files" on storage.objects;
create policy "players list music files" on storage.objects for select to anon, authenticated using (bucket_id = 'music');

-- Tell the API about the new table.
notify pgrst, 'reload schema';
