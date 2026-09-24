-- Little City world boss: the server-authoritative event. Run once in the Supabase SQL editor, after
-- realtime-policies.sql. See README.md, section 14.
--
-- The server decides everything that matters: when the kaiju appears (12:00 Philippine time every day, on each city in
-- turn), its HP (1,000,000,000), how much damage each hit does, how many hits a player can land per second, whether
-- the kaiju is in range, when it dies, the live ranking, the weekly leaderboard and weekly rewards. Clients can only
-- call the functions below (they cannot read or write the tables), and they only ever send *what they did* (how many
-- shots and punches since their last report, and where they are), never damage numbers or HP.
-- The rules match src/models/worldTour/bossRules.js and the kaiju's path matches worldBoss.js (tests check both).
--
-- Destruction is not stored: it is a pure function of the event's start time and seed (issued here), so every client
-- computes the same ruins, cannot alter what anyone else sees, and everything is restored when the event ends.

create table if not exists public.boss_events (
  id text primary key, day integer not null, city text not null, seed integer not null,
  starts_at timestamptz not null, ends_at timestamptz not null, max_hp bigint not null, hp bigint not null, defeated_at timestamptz
);
create table if not exists public.boss_damage (
  event_id text not null references public.boss_events (id) on delete cascade, user_id uuid not null, name text not null,
  damage bigint not null default 0, hits integer not null default 0, deaths integer not null default 0,
  last_at timestamptz not null, last_death_at timestamptz, primary key (event_id, user_id)
);
create table if not exists public.boss_weekly (week integer not null, user_id uuid not null, name text not null, damage bigint not null default 0, primary key (week, user_id));
create table if not exists public.boss_reward_tiers (rank_from integer not null, rank_to integer not null, tier text not null, cash integer not null, title text not null);
create table if not exists public.boss_rewards (
  week integer not null, user_id uuid not null, rank integer not null, name text not null, damage bigint not null,
  tier text not null, cash integer not null, title text not null, claimed_at timestamptz, primary key (week, user_id)
);
create table if not exists public.boss_weeks_closed (week integer primary key, closed_at timestamptz not null default now());

-- Rewards are configurable: edit this table (ranks are inclusive).
insert into public.boss_reward_tiers (rank_from, rank_to, tier, cash, title)
select * from (values (1, 1, 'Champion', 100000, 'Kaiju Slayer'), (2, 10, 'Top 10', 50000, 'Kaiju Hunter'), (11, 100, 'Top 100', 10000, 'Defender')) as t
where not exists (select 1 from public.boss_reward_tiers);

-- No direct access: row level security with no policies, and no table privileges for API roles.
alter table public.boss_events enable row level security;
alter table public.boss_damage enable row level security;
alter table public.boss_weekly enable row level security;
alter table public.boss_reward_tiers enable row level security;
alter table public.boss_rewards enable row level security;
alter table public.boss_weeks_closed enable row level security;
revoke all on public.boss_events, public.boss_damage, public.boss_weekly, public.boss_reward_tiers, public.boss_rewards, public.boss_weeks_closed from anon, authenticated;

-- ---- Rules (constants mirror bossRules.js)
create or replace function public.boss_now() returns timestamptz language sql stable as $$ select now() $$;
create or replace function public.boss_ms(t timestamptz) returns bigint language sql immutable as $$ select floor(extract(epoch from t) * 1000)::bigint $$;
-- Day number in Philippine time (UTC+8) and Monday-based week number.
create or replace function public.boss_ph_day(t timestamptz) returns integer language sql immutable as $$ select floor((extract(epoch from t) + 28800) / 86400)::integer $$;
create or replace function public.boss_week(t timestamptz) returns integer language sql immutable as $$
  select public.boss_ph_day(t) - (((public.boss_ph_day(t) + 3) % 7) + 7) % 7 $$;
create or replace function public.boss_city(day integer) returns text language sql immutable as $$
  select (array['miami','tokyo','manila','london','dubai','rio','cape'])[((day % 7) + 7) % 7 + 1] $$;
-- The event for a Philippine day starts at 12:00 PHT and lasts an hour.
create or replace function public.boss_event_start(day integer) returns timestamptz language sql immutable as $$
  select to_timestamp(day::double precision * 86400 - 28800 + 12 * 3600) $$;

-- The kaiju's path (same as kaijuPose in worldBoss.js): it wades in from the east, then walks the avenues.
create or replace function public.boss_position(t double precision, out x double precision, out z double precision) language plpgsql immutable as $$
declare wade constant double precision := 104; d double precision; side integer; along double precision;
begin
  if t < wade then x := 760 - 5 * greatest(0, t); z := -240; return; end if;
  d := mod(((t - wade) * 2.5)::numeric, 1920)::double precision; side := floor(d / 480); along := d - side * 480;
  if side = 0 then x := 240; z := -240 + along;
  elsif side = 1 then x := 240 - along; z := 240;
  elsif side = 2 then x := -240; z := 240 - along;
  else x := -240 + along; z := -240; end if;
end $$;

-- Today's event (or tomorrow's once today's has ended); creates its row when it starts.
create or replace function public.boss_event_now() returns public.boss_events language plpgsql security definer set search_path = public as $$
declare t timestamptz := boss_now(); d integer := boss_ph_day(t); ev public.boss_events;
begin
  if t >= boss_event_start(d) + interval '1 hour' then d := d + 1; end if;
  select * into ev from boss_events where id = 'boss-' || d;
  if not found then
    ev := row('boss-' || d, d, boss_city(d), d, boss_event_start(d), boss_event_start(d) + interval '1 hour', 1000000000, 1000000000, null)::boss_events;
    if t >= ev.starts_at then insert into boss_events values (ev.*) on conflict (id) do nothing; select * into ev from boss_events where id = ev.id; end if;
  end if;
  return ev;
end $$;
create or replace function public.boss_phase(ev public.boss_events, t timestamptz) returns text language sql immutable as $$
  select case when ev.defeated_at is not null then 'defeated' when t >= ev.ends_at then 'ended'
    when t >= ev.starts_at then case when ev.hp > 0 then 'active' else 'defeated' end
    when t >= ev.starts_at - interval '1 hour' then 'countdown' else 'scheduled' end $$;

-- Close finished weeks: final ranks and rewards for the top 100 (idempotent). Also safe to schedule with pg_cron:
--   select cron.schedule('little-city-boss-week', '5 16 * * 0', $$select public.boss_close_weeks()$$);  -- Monday 00:05 PHT
create or replace function public.boss_close_weeks() returns integer language plpgsql security definer set search_path = public as $$
declare w integer; closed integer := 0;
begin
  for w in select distinct week from boss_weekly where week < boss_week(boss_now()) and week not in (select week from boss_weeks_closed) order by week loop
    insert into boss_rewards (week, user_id, rank, name, damage, tier, cash, title)
    select r.week, r.user_id, r.rank, r.name, r.damage, t.tier, t.cash, t.title
    from (select week, user_id, name, damage, row_number() over (order by damage desc, user_id) as rank from boss_weekly where week = w and damage > 0) r
    join boss_reward_tiers t on r.rank between t.rank_from and t.rank_to
    on conflict do nothing;
    insert into boss_weeks_closed (week) values (w) on conflict do nothing;
    closed := closed + 1;
  end loop;
  return closed;
end $$;

-- Everything the event UI needs, for the calling player.
create or replace function public.boss_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.boss_events := boss_event_now(); t timestamptz := boss_now(); me uuid := auth.uid(); total bigint; mine public.boss_damage; my_rank integer;
begin
  perform boss_close_weeks();
  select coalesce(sum(damage), 0) into total from boss_damage where event_id = ev.id;
  select * into mine from boss_damage where event_id = ev.id and user_id = me;
  select count(*) + 1 into my_rank from boss_damage where event_id = ev.id and (damage > coalesce(mine.damage, 0) or (damage = coalesce(mine.damage, 0) and user_id::text < me::text));
  return jsonb_build_object(
    'id', ev.id, 'city', ev.city, 'seed', ev.seed, 'startsAt', boss_ms(ev.starts_at), 'endsAt', boss_ms(ev.ends_at), 'maxHp', ev.max_hp, 'hp', ev.hp,
    'defeatedAt', case when ev.defeated_at is null then null else boss_ms(ev.defeated_at) end, 'phase', boss_phase(ev, t), 'serverNow', boss_ms(t), 'totalDamage', total,
    'top', coalesce((select jsonb_agg(row_to_json(r) order by r.rank) from (
      select row_number() over (order by damage desc, user_id::text) as rank, user_id::text as id, name, damage, case when total > 0 then damage::double precision / total else 0 end as share
      from boss_damage where event_id = ev.id and damage > 0 order by damage desc, user_id::text limit 10) r), '[]'::jsonb),
    'me', jsonb_build_object('damage', coalesce(mine.damage, 0), 'hits', coalesce(mine.hits, 0), 'deaths', coalesce(mine.deaths, 0), 'rank', case when coalesce(mine.damage, 0) > 0 then my_rank else null end));
end $$;

-- Report hits since the last report. The server checks the event, the city, the range to the kaiju and the rate, then
-- computes the damage itself (45,000 per shot, 80,000 per punch).
create or replace function public.boss_hit(p_event text, p_shots integer, p_punches integer, p_x double precision, p_z double precision, p_city text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.boss_events; t timestamptz := boss_now(); me uuid := auth.uid(); player public.boss_damage; pos record;
  since double precision; shots integer; punches integer; dmg bigint; clean text;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed-out'); end if;
  perform boss_event_now();
  select * into ev from boss_events where id = p_event for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-event', 'damage', 0); end if;
  if boss_phase(ev, t) <> 'active' then return jsonb_build_object('ok', false, 'reason', boss_phase(ev, t), 'damage', 0, 'hp', ev.hp); end if;
  if p_city is distinct from ev.city then return jsonb_build_object('ok', false, 'reason', 'wrong-city', 'damage', 0, 'hp', ev.hp); end if;
  if p_shots is null or p_punches is null or p_shots < 0 or p_punches < 0 then return jsonb_build_object('ok', false, 'reason', 'bad-input', 'damage', 0, 'hp', ev.hp); end if;
  select * into pos from boss_position(extract(epoch from (t - ev.starts_at)));
  if sqrt(power(p_x - pos.x, 2) + power(p_z - pos.z, 2)) > 220 then return jsonb_build_object('ok', false, 'reason', 'out-of-range', 'damage', 0, 'hp', ev.hp); end if;
  clean := left(regexp_replace(coalesce(nullif(trim(p_name), ''), 'Traveller'), '[[:cntrl:]]', '', 'g'), 24);
  insert into boss_damage (event_id, user_id, name, last_at) values (ev.id, me, clean, greatest(ev.starts_at, t - interval '1 second')) on conflict do nothing;
  select * into player from boss_damage where event_id = ev.id and user_id = me for update;
  since := least(5, greatest(0, extract(epoch from (t - player.last_at))));
  shots := least(p_shots, floor(since / 0.3)::integer + 1); punches := least(p_punches, floor(since / 0.45)::integer + 1);
  dmg := least(ev.hp, shots::bigint * 45000 + punches::bigint * 80000);
  update boss_damage set name = clean, damage = damage + dmg, hits = hits + shots + punches, last_at = t where event_id = ev.id and user_id = me;
  update boss_events set hp = hp - dmg, defeated_at = case when hp - dmg <= 0 then t else defeated_at end where id = ev.id returning * into ev;
  insert into boss_weekly (week, user_id, name, damage) values (boss_week(t), me, clean, dmg)
    on conflict (week, user_id) do update set damage = boss_weekly.damage + excluded.damage, name = excluded.name;
  return jsonb_build_object('ok', true, 'damage', dmg, 'hp', ev.hp, 'accepted', jsonb_build_object('shots', shots, 'punches', punches));
end $$;

-- A player was wasted during the event (counted at most once every 8 seconds).
create or replace function public.boss_death(p_event text) returns boolean language plpgsql security definer set search_path = public as $$
declare t timestamptz := boss_now(); n integer;
begin
  update boss_damage set deaths = deaths + 1, last_death_at = t
  where event_id = p_event and user_id = auth.uid() and (last_death_at is null or last_death_at < t - interval '8 seconds');
  get diagnostics n = row_count; return n > 0;
end $$;

-- The weekly leaderboard (top 100), the caller's rank and their unclaimed rewards.
create or replace function public.boss_weekly_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare w integer := boss_week(boss_now()); me uuid := auth.uid();
begin
  perform boss_close_weeks();
  return jsonb_build_object('week', w, 'startsAt', boss_ms(to_timestamp(w::double precision * 86400 - 28800)), 'endsAt', boss_ms(to_timestamp((w + 7)::double precision * 86400 - 28800)),
    'rows', coalesce((select jsonb_agg(row_to_json(r) order by r.rank) from (
      select row_number() over (order by damage desc, user_id::text) as rank, user_id::text as id, name, damage from boss_weekly where week = w and damage > 0 order by damage desc, user_id::text limit 100) r), '[]'::jsonb),
    'myRank', (select r.rank from (select user_id, row_number() over (order by damage desc, user_id::text) as rank from boss_weekly where week = w and damage > 0) r where r.user_id = me),
    'unclaimed', coalesce((select jsonb_agg(jsonb_build_object('week', week, 'rank', rank, 'tier', tier, 'cash', cash, 'title', title)) from boss_rewards where user_id = me and claimed_at is null), '[]'::jsonb));
end $$;

-- Claim this player's weekly rewards; returns the cash granted (each reward can only be claimed once).
create or replace function public.boss_claim_rewards() returns integer language plpgsql security definer set search_path = public as $$
declare cash integer;
begin
  with claimed as (update boss_rewards set claimed_at = boss_now() where user_id = auth.uid() and claimed_at is null returning boss_rewards.cash)
  select coalesce(sum(claimed.cash), 0) into cash from claimed;
  return cash;
end $$;

-- Only the entry points are callable, and only by signed-in (anonymous) players.
revoke all on function public.boss_event_now(), public.boss_close_weeks(), public.boss_state(), public.boss_hit(text, integer, integer, double precision, double precision, text, text),
  public.boss_death(text), public.boss_weekly_state(), public.boss_claim_rewards() from public, anon;
grant execute on function public.boss_state(), public.boss_hit(text, integer, integer, double precision, double precision, text, text),
  public.boss_death(text), public.boss_weekly_state(), public.boss_claim_rewards() to authenticated;
