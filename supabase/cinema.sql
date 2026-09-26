-- Little City cinema: the shows and movies on the Open-Air Cinema screen in every city. Run the whole file once in
-- the Supabase SQL editor (nothing highlighted). Safe to run again; it keeps your files.
--
-- Then add videos either way:
--   * Dashboard: Storage -> cinema. Put episodes and short programmes in a folder named "shows" and films in a folder
--     named "movies" (files at the top count as movies). The screen alternates a show and a movie, in file-name order,
--     looping all day on the shared clock, so everyone watching sees the same moment. Titles come from file names
--     ("01 - The Big Race.mp4" shows as "The Big Race"). Storage only accepts plain-ASCII names.
--   * Script: node scripts/upload-cinema.mjs "your folder" (README, "Cinema").
-- Use MP4 (H.264 video, AAC sound) for every browser; WebM also works in most. 720p is plenty for the big screen and
-- keeps files small: every player near the cinema streams the film from your project (it counts toward your plan's
-- bandwidth), and your plan's upload limit applies (50 MB per file on the Free plan; paid plans can raise it in
-- Storage -> Settings). Only upload videos you have the right to show publicly.
--
-- Files live in a public bucket named 'cinema': anyone with a link can watch, which is what a public screen needs. Only
-- you can add, change or delete files (dashboard, or the script with your secret key). Players can only list it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cinema', 'cinema', true, null, array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Players may list the files in the cinema bucket (watching needs no policy: the bucket is public).
drop policy if exists "players list cinema files" on storage.objects;
create policy "players list cinema files" on storage.objects for select to anon, authenticated using (bucket_id = 'cinema');
