-- Little City multiplayer: Realtime Authorization for the game's private channels.
-- Run once in the Supabase SQL editor. See README.md, section 14 ("Turn on online play") for the full setup.
--
-- Players sign in anonymously (Authentication > Sign In / Providers > "Allow anonymous sign-ins"), which gives them the
-- `authenticated` role. With Realtime's "Allow public access" turned off, only private channels authorised below work,
-- so the anon key alone cannot read or write game traffic, and no other topic is usable by these clients.
-- Only the lobby and the seven city channels are allowed, for Broadcast and Presence messages.

create policy "little city players receive game channels"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() ~ '^little-city:(lobby|city:(miami|tokyo|manila|london|dubai|rio|cape))$'
  and realtime.messages.extension in ('broadcast', 'presence')
);

create policy "little city players send on game channels"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() ~ '^little-city:(lobby|city:(miami|tokyo|manila|london|dubai|rio|cape))$'
  and realtime.messages.extension in ('broadcast', 'presence')
);
