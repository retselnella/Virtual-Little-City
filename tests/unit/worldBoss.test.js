import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { BOSS_HP, FIRE_GRACE_MS, FIRE_WINDOW_MS, KAIJU_DAMAGE, REWARDS, claimRewards, createBossStore, currentEvent, eventForDay, eventState, phDay, phaseAt, ranking, reportDeath, spendFireTime, submitHits, weekOf, weeklyState } from '../../src/models/worldTour/bossRules.js';
import { ATTACKS, KAIJU, attackAt, destructionAt, kaijuHazards, kaijuInReach, kaijuPose, standingBlocks } from '../../src/models/worldTour/worldBoss.js';
import { CITIES, createSession, equip, generateBlocks, stepWorld, attack } from '../../src/models/worldTour/worldAdventure.js';
import { aimFromRay, kaijuRayHit, kaijuRise } from '../../src/models/worldTour/aiming.js';
import { sceneryLayout } from '../../src/models/worldTour/worldLayout.js';

const PH = 8 * 3600_000, day = phDay(Date.UTC(2026, 8, 24, 4)), at = (h, m = 0, s = 0, d = day) => d * 86_400_000 - PH + ((h * 60 + m) * 60 + s) * 1000;
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c';

// The real server SQL, in an in-memory Postgres, with Supabase's auth.uid() and API roles stubbed.
async function server() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;`); // as Supabase does
  await db.exec(readFileSync(new URL('../../supabase/world-boss.sql', import.meta.url), 'utf8'));
  // Tests control the server clock; production uses now().
  await db.exec(`create or replace function public.boss_real_now() returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('test.now', true), '')::timestamptz, now()) $$;`);
  const as = async (uid, ms, sql, params = []) => {
    await db.query(`select set_config('test.uid', $1, false), set_config('test.now', $2, false)`, [uid || '', new Date(ms).toISOString()]);
    await db.exec('set role authenticated');
    try { return (await db.query(sql, params)).rows[0]; } finally { await db.exec('reset role'); }
  };
  return { db, as, state: (uid, ms) => as(uid, ms, 'select public.boss_state() as v').then(r => r.v),
    hit: (uid, ms, event, hits, x, z, city, name = 'P') => as(uid, ms, 'select public.boss_hit($1, $2::jsonb, $3, $4, $5, $6) as v', [event, JSON.stringify(hits), x, z, city, name]).then(r => r.v) };
}

test('the kaiju arrives at 12:00 Philippine time, on each city in turn, for one hour', () => {
  const event = eventForDay(day);
  assert.equal(new Date(event.startsAt).toISOString(), new Date(Date.UTC(2026, 8, 24, 4)).toISOString(), '12:00 PHT is 04:00 UTC');
  assert.equal(event.endsAt - event.startsAt, 3600_000); assert.equal(event.maxHp, BOSS_HP);
  assert.equal(phaseAt(event, at(9)), 'scheduled'); assert.equal(phaseAt(event, at(11, 30)), 'countdown'); assert.equal(phaseAt(event, at(12, 0, 1)), 'active');
  assert.equal(phaseAt(event, at(13, 0, 1)), 'ended'); assert.equal(currentEvent(at(13, 5)).day, day + 1, 'after the hour, the next event is tomorrow');
  assert.equal(new Set(Array.from({ length: 7 }, (_, k) => eventForDay(day + k).city)).size, 7, 'a week visits every city');
});

test('server SQL and local rules agree: schedule, rate limits, range and city checks, damage', async () => {
  const S = await server(), store = createBossStore(), event = eventForDay(day);
  const before = await S.state(A, at(11, 30));
  assert.equal(before.phase, 'countdown'); assert.equal(before.city, event.city); assert.equal(before.startsAt, event.startsAt); assert.equal(before.hp, BOSS_HP);
  const t = at(12, 3), boss = kaijuPose((t - event.startsAt) / 1000);
  eventState(store, t);
  const cases = [
    [A, t, { pistol: 10 }, boss.x + 30, boss.z, event.city], [A, t, { pistol: 10, fists: 10 }, boss.x + 30, boss.z, event.city], [A, t + 3000, { rifle: 50, fists: 50 }, boss.x, boss.z + 20, event.city],
    [B, t + 3100, { sniper: 2, fists: 1 }, boss.x - 10, boss.z, event.city], [B, t + 3200, { pistol: 1 }, boss.x + 500, boss.z, event.city], [C, t + 3300, { pistol: 1 }, boss.x, boss.z, 'nowhere'],
    [C, t + 3400, { pistol: -5 }, boss.x, boss.z, event.city], [C, t + 3500, { pistol: 1.5 }, boss.x, boss.z, event.city], [C, t + 3600, [3], boss.x, boss.z, event.city],
    [C, t + 3700, { bazooka: 9, rocket: 2 }, boss.x, boss.z, event.city],
  ];
  for (const [uid, ms, hits, x, z, city] of cases) {
    const sql = await S.hit(uid, ms, event.id, hits, x, z, city), pose = kaijuPose((ms - event.startsAt) / 1000);
    const js = submitHits(store, { playerId: uid, name: 'P', eventId: event.id, hits, x, z, city, bossX: pose.x, bossZ: pose.z, now: ms });
    assert.equal(sql.ok, js.ok, `ok for ${JSON.stringify([uid.at(-1), hits])}: ${sql.reason}`); assert.equal(sql.reason, js.reason); assert.equal(Number(sql.damage), js.damage);
    if (js.ok) assert.deepEqual(sql.accepted, js.accepted);
  }
  assert.equal(Number((await S.hit(C, t + 3800, event.id, { rocket: 1 }, boss.x, boss.z, event.city)).damage), KAIJU_DAMAGE.rocket.damage, 'each weapon does its own damage');
  // Spamming hits within one second only counts what the weapons can really fire.
  const spam = await S.hit(A, t + 3000 + 1, event.id, { smg: 1000, rocket: 1000 }, boss.x, boss.z, event.city);
  assert.ok((spam.accepted.smg || 0) * KAIJU_DAMAGE.smg.costMs + (spam.accepted.rocket || 0) * KAIJU_DAMAGE.rocket.costMs <= FIRE_GRACE_MS + 1, `nothing banked, only the grace (${JSON.stringify(spam.accepted)})`);
  const after = await S.state(A, t + 4000);
  assert.equal(after.phase, 'active'); assert.equal(Number(after.hp), BOSS_HP - after.top.reduce((sum, r) => sum + Number(r.damage), 0));
});

test('the ranking orders players by damage with their share, and the kaiju can be defeated', async () => {
  const S = await server(), event = eventForDay(day), t = at(12, 10), boss = kaijuPose(600);
  await S.state(A, t);
  await S.hit(A, t, event.id, { pistol: 3 }, boss.x, boss.z, event.city, 'Ada');
  await S.hit(B, t, event.id, { fists: 3 }, boss.x, boss.z, event.city, 'Ben');
  await S.hit(C, t, event.id, { pistol: 1 }, boss.x, boss.z, event.city, 'Cy');
  const state = await S.state(B, t + 100);
  assert.deepEqual(state.top.map(r => r.name), ['Ben', 'Ada', 'Cy']);
  assert.ok(Math.abs(state.top.reduce((sum, r) => sum + r.share, 0) - 1) < 1e-9); assert.equal(state.me.rank, 1);
  const local = ranking({ a: { id: 'a', name: 'Ada', damage: 135000 }, b: { id: 'b', name: 'Ben', damage: 160000 }, c: { id: 'c', name: 'Cy', damage: 45000 } });
  assert.deepEqual(local.rows.map(r => [r.rank, r.name]), [[1, 'Ben'], [2, 'Ada'], [3, 'Cy']]);
  // Nearly dead: the next hit kills it, only the remaining HP counts, and later hits are refused.
  await S.db.query('update boss_events set hp = 50000 where id = $1', [event.id]);
  const kill = await S.hit(A, t + 2000, event.id, { pistol: 5 }, boss.x, boss.z, event.city, 'Ada');
  assert.equal(Number(kill.damage), 50000); assert.equal(Number(kill.hp), 0);
  assert.equal((await S.state(A, t + 2100)).phase, 'defeated');
  assert.equal((await S.hit(B, t + 4000, event.id, { pistol: 1 }, boss.x, boss.z, event.city)).reason, 'defeated');
});

test('the event ends on its own after an hour and the next one is prepared', async () => {
  const S = await server(), event = eventForDay(day);
  await S.state(A, at(12, 1));
  const late = await S.state(A, at(13, 0, 30));
  assert.equal(late.id, eventForDay(day + 1).id); assert.equal(late.phase, 'scheduled'); assert.notEqual(late.city, event.city);
  assert.equal((await S.hit(A, at(13, 0, 30), event.id, { pistol: 1 }, 0, 0, event.city)).reason, 'ended');
});

test('weekly leaderboard: totals across events, closed at the end of the week with configured rewards, claimed once', async () => {
  const S = await server(), e1 = eventForDay(day), e2 = eventForDay(day + 1);
  const hitAt = async (uid, e, shots) => { const t = e.startsAt + 200_000, p = kaijuPose(200); await S.state(uid, t); return S.hit(uid, t, e.id, { pistol: shots }, p.x, p.z, e.city, uid === A ? 'Ada' : 'Ben'); };
  await hitAt(A, e1, 2); await hitAt(B, e1, 4); await hitAt(A, e2, 4);
  const sameWeek = weekOf(e1.startsAt) === weekOf(e2.startsAt), weekly = await S.as(A, e2.startsAt + 300_000, 'select public.boss_weekly_state() as v').then(r => r.v);
  // A first report can use up to 8 banked seconds of fire time, so all of these count: Ada 2 + 4 shots, Ben 4 shots.
  if (sameWeek) assert.deepEqual(weekly.rows.map(r => [r.name, Number(r.damage)]), [['Ada', 6 * KAIJU_DAMAGE.pistol.damage], ['Ben', 4 * KAIJU_DAMAGE.pistol.damage]]);
  // A week later the finished week is closed: ranks, tiers, rewards.
  const nextWeek = (weekOf(e2.startsAt) + 7) * 86_400_000 - PH + 3600_000;
  const later = await S.as(A, nextWeek, 'select public.boss_weekly_state() as v').then(r => r.v);
  assert.equal(later.rows.length, 0, 'the new week starts empty');
  assert.equal(later.unclaimed.length, sameWeek ? 1 : 2); assert.equal(later.unclaimed[0].tier, 'Champion');
  const cash = await S.as(A, nextWeek, 'select public.boss_claim_rewards() as v').then(r => r.v);
  assert.equal(cash, later.unclaimed.reduce((sum, r) => sum + r.cash, 0));
  assert.equal(await S.as(A, nextWeek, 'select public.boss_claim_rewards() as v').then(r => r.v), 0, 'rewards are claimed once');
  const tiers = await S.db.query('select rank_from, rank_to, cash from boss_reward_tiers order by rank_from');
  assert.deepEqual(tiers.rows.map(r => [r.rank_from, r.rank_to, r.cash]), REWARDS.map(r => [r.from, r.to, r.cash]), 'SQL and JS reward tiers match');
  // The same flow in the local rules.
  const store = createBossStore(); eventState(store, e1.startsAt + 1);
  const p = kaijuPose(200); submitHits(store, { playerId: 'a', name: 'Ada', eventId: e1.id, hits: { pistol: 2 }, x: p.x, z: p.z, city: e1.city, bossX: p.x, bossZ: p.z, now: e1.startsAt + 200_000 });
  const local = weeklyState(store, nextWeek, 'a'); assert.equal(local.unclaimed[0].reward.tier, 'Champion'); assert.ok(claimRewards(store, 'a') > 0 && claimRewards(store, 'a') === 0);
  assert.ok(reportDeath(store, { playerId: 'a', eventId: e1.id, now: e1.startsAt + 300_000 }) && !reportDeath(store, { playerId: 'a', eventId: e1.id, now: e1.startsAt + 301_000 }));
});

test('test mode runs on the real project without touching real data, and reverts cleanly', async () => {
  const S = await server(), owner = async (ms, sql) => { await S.db.query(`select set_config('test.now', $1, false)`, [new Date(ms).toISOString()]); return (await S.db.query(sql)).rows[0].v; };
  const testState = (uid, ms) => S.as(uid, ms, 'select public.boss_state(true) as v').then(r => r.v);
  const real = eventForDay(day), rpose = kaijuPose(185);
  // A real fight is under way (12:03) with real damage on the weekly board.
  assert.equal((await S.hit(A, at(12, 3, 5), real.id, { pistol: 3 }, rpose.x, rpose.z, real.city)).ok, true);
  const realHp = (await S.state(A, at(12, 3, 6))).hp, week = await S.as(A, at(12, 3, 6), 'select public.boss_weekly_state() as v').then(r => r.v);
  // ?bosstest without test mode switched on is simply the real event.
  assert.equal((await testState(B, at(12, 3, 6))).id, real.id);
  // The owner moves the test clock to 12:05 on another city's day: only ?bosstest players follow it.
  const target = CITIES.find(c => c.id !== real.city && c.id !== eventForDay(day + 1).city).id;
  assert.match(await owner(at(12, 3), `select public.boss_test_clock('12:05', '${target}') as v`), /test kaiju attacks/);
  const fight = await testState(B, at(12, 3, 10));
  assert.equal(fight.test, true); assert.match(fight.id, /^test-/); assert.equal(fight.phase, 'active'); assert.equal(fight.city, target); assert.equal(Number(fight.hp), BOSS_HP);
  const everyone = await S.state(A, at(12, 3, 10));
  assert.equal(everyone.id, real.id); assert.equal(everyone.test, false); assert.equal(everyone.serverNow, at(12, 3, 10), 'other players keep the real clock');
  const pose = kaijuPose((fight.serverNow - fight.startsAt) / 1000), hit = await S.hit(B, at(12, 3, 13), fight.id, { pistol: 3 }, pose.x, pose.z, target);
  assert.equal(hit.ok, true); assert.equal(Number(hit.damage), 3 * KAIJU_DAMAGE.pistol.damage);
  assert.equal((await S.state(A, at(12, 3, 14))).hp, realHp, 'test damage never touches the real kaiju');
  assert.deepEqual((await S.as(A, at(12, 3, 14), 'select public.boss_weekly_state() as v')).v.rows, week.rows, 'nor the weekly board');
  await assert.rejects(owner(at(12, 3), `select public.boss_test_clock('25:00') as v`), /HH:MM/);
  // Revert: test mode off, test data gone, real data as it was.
  await owner(at(12, 4), 'select public.boss_test_clock_off() as v');
  assert.equal((await S.db.query(`select count(*)::int as n from boss_events where id like 'test-%'`)).rows[0].n, 0);
  assert.equal((await S.hit(B, at(12, 4, 5), fight.id, { pistol: 1 }, pose.x, pose.z, target)).ok, false, 'old test events cannot be hit');
  assert.equal((await testState(B, at(12, 4, 6))).id, real.id);
  assert.equal((await S.state(A, at(12, 4, 6))).hp, realHp);
});

test('clients cannot touch the tables or call internal functions', async () => {
  const S = await server();
  for (const sql of ['select * from boss_events', 'update boss_events set hp = 0', "insert into boss_weekly values (1, gen_random_uuid(), 'x', 999999999999)", 'select public.boss_close_weeks()', 'select public.boss_event_now()', 'select * from boss_reward_tiers',
    "select public.boss_test_clock('12:05')", 'select public.boss_test_clock_off()', 'select public.boss_test_reset()', 'update boss_test_clock set offset_ms = 1', 'select public.boss_clock(true)', 'select public.boss_event_now(true)', 'select * from public.boss_arms()']) {
    await assert.rejects(S.as(A, at(12, 5), sql), /permission denied/, sql);
  }
  assert.equal((await S.as(null, at(12, 5), `select public.boss_hit('x', '{"pistol":1}'::jsonb, 0, 0, 'miami', 'x') as v`)).v.reason, 'signed-out');
});

test('the kaiju towers over the city, walks its avenues and wrecks it, with every client computing the same ruins', () => {
  assert.ok(KAIJU.height > 120, 'taller than the tallest towers');
  assert.deepEqual(kaijuPose(0), kaijuPose(0)); assert.ok(kaijuPose(0).x > 470, 'it rises from the sea');
  const types = new Set(Array.from({ length: 60 }, (_, i) => attackAt(7, i).type)); assert.deepEqual([...types].sort(), Object.keys(ATTACKS).sort());
  for (let i = 1; i < 200; i++) assert.notEqual(attackAt(7, i).type, attackAt(7, i - 1).type, 'never the same attack twice running');
  const blocks = generateBlocks(CITIES[0]), layout = sceneryLayout();
  const early = destructionAt(7, 60, blocks, layout), later = destructionAt(7, 1800, blocks, layout);
  assert.ok(later.ruined.size > early.ruined.size && [...early.ruined].every(i => later.ruined.has(i)), 'destruction only grows during the event');
  assert.deepEqual([...destructionAt(7, 1800, blocks, layout).ruined], [...later.ruined], 'deterministic');
  const standing = standingBlocks(blocks, later.ruined);
  assert.ok(standing.island === blocks.island && standing.filter(b => b.ruined).every(b => b.height < 5));
});

test('the kaiju hurts, knocks back and stuns players, and players can damage it in range', () => {
  const memory = new Set();
  let found = null;
  for (let i = 0; i < 60 && !found; i++) { const a = attackAt(3, i); if (a.type === 'slam') found = a; }
  const hits = kaijuHazards(3, found.impact + 0.1, found.target, memory, 0.05);
  assert.ok(hits.some(h => h.damage > 30 && h.knockdown), 'a slam at your feet hurts and knocks you down');
  let roar = null; for (let i = 0; i < 60 && !roar; i++) { const a = attackAt(3, i); if (a.type === 'roar') roar = a; }
  const shout = kaijuHazards(3, roar.impact + 0.1, { x: roar.from.x + 100, z: roar.from.z }, new Set(), 0.05).find(h => h.id.startsWith('roar'));
  assert.ok(shout.stun && !shout.knockdown, 'the roar stuns without knocking you over');
  assert.equal(kaijuHazards(3, found.impact + 0.2, found.target, memory, 0.05).filter(h => h.damage).length, 0, 'once per slam');
  const pose = kaijuPose(500), far = { x: pose.x + 400, z: pose.z };
  assert.equal(kaijuHazards(3, 500, far, new Set(), 0.05).filter(h => !h.id.startsWith('roar')).length, 0);
  // In a session: stand next to the kaiju during an active event and you take damage; shoot it and hits are recorded.
  const city = CITIES.find(c => c.id === eventForDay(day).city), s = createSession(city); s.traffic = []; s.pedestrians = [];
  s.bossEvent = { ...eventForDay(day), hp: BOSS_HP, defeatedAt: null, phase: 'active' };
  s.worldTime = (s.bossEvent.startsAt + 500_000) / 1000;
  const boss = kaijuPose(500); s.player = { ...s.player, x: boss.x + 3, z: boss.z + 3 };
  const health = s.health; for (let i = 0; i < 30; i++) { s.worldTime += 0.05; stepWorld(s, {}, 0.05); }
  assert.ok(s.health < health, 'underfoot, you get stamped on'); assert.ok(Math.hypot(s.player.x - boss.x, s.player.z - boss.z) > 3, 'and shoved away');
  s.health = 100; s.player = { ...s.player, x: boss.x + 90, z: boss.z, moveX: 0, moveZ: 0 }; s.cooldown = 0;
  s.aimYaw = Math.atan2(kaijuPose(s.worldTime - s.bossEvent.startsAt / 1000).x - s.player.x, kaijuPose(s.worldTime - s.bossEvent.startsAt / 1000).z - s.player.z);
  assert.ok(kaijuInReach(s.player, s.aimYaw, true, s.worldTime - s.bossEvent.startsAt / 1000) !== null);
  attack(s); assert.equal(s.bossHits.pistol, 1, 'the shot is queued for the server, by weapon (it decides the damage)'); assert.equal(s.heat, 0, 'fighting the kaiju does not draw the police');
});

test('destruction stays for the whole event and the city is restored when it ends', () => {
  const event = eventForDay(day), city = CITIES.find(c => c.id === event.city), s = createSession(city); s.traffic = []; s.pedestrians = [];
  s.bossEvent = { ...event, hp: BOSS_HP, defeatedAt: null, phase: 'active' };
  s.worldTime = (event.startsAt + 1800_000) / 1000; stepWorld(s, {}, 0.05);
  const ruined = s.blocks.filter(b => b.ruined).length;
  assert.ok(ruined > 10 && s.ruins.ruined.size === ruined, `ruined buildings stand as rubble (${ruined})`);
  s.worldTime = (event.startsAt + 3000_000) / 1000; stepWorld(s, {}, 0.05);
  assert.ok(s.blocks.filter(b => b.ruined).length >= ruined, 'nothing is rebuilt during the event');
  // Defeated: it stops attacking, but the damage stays until the hour is up.
  s.bossEvent = { ...s.bossEvent, hp: 0, defeatedAt: event.startsAt + 3100_000, phase: 'defeated' };
  s.worldTime = (event.startsAt + 3300_000) / 1000; stepWorld(s, {}, 0.05);
  assert.ok(!s.boss.alive && s.blocks.some(b => b.ruined));
  s.worldTime = (event.endsAt + 1000) / 1000; stepWorld(s, {}, 0.05);
  assert.equal(s.boss, null); assert.equal(s.ruins, null); assert.equal(s.blocks, s.baseBlocks, 'the city is whole again');
  assert.ok(s.blocks.every(b => !b.ruined));
});

test('the Kaiju panel explains server errors the owner can fix', async () => {
  const { describeBossError } = await import('../../src/services/bossService.js');
  assert.match(describeBossError({ code: 'PGRST202', message: 'Could not find the function public.boss_state(p_test) in the schema cache' }), /run the whole supabase\/world-boss.sql/);
  assert.match(describeBossError({ code: '42501', message: 'permission denied for function boss_state' }), /refused/);
  assert.match(describeBossError({ code: 'PGRST203', message: 'Could not choose the best candidate function between: public.boss_state(), public.boss_state(p_test => boolean).' }), /drop function if exists public\.boss_state\(\)/);
  assert.match(describeBossError(new Error('Anonymous sign-ins are disabled')), /Anonymous sign-ins are off/);
  assert.match(describeBossError({ message: 'boom' }), /Server error: boom/);
});

test('an older copy of the SQL run after the new one cannot break the game, and re-running the file cleans it up', async () => {
  const S = await server();
  // The first release's boss_state() and boss_event_now(), recreated beside the current ones.
  await S.db.exec(`create function public.boss_event_now() returns public.boss_events language sql as $$ select * from public.boss_event_now(false) $$;
    create function public.boss_state() returns jsonb language sql as $$ select public.boss_state(false) $$; grant execute on function public.boss_state() to authenticated;`);
  await assert.rejects(S.as(A, at(12, 5), 'select public.boss_state() as v'), /not unique/, 'an unnamed call is ambiguous');
  assert.equal((await S.as(A, at(12, 5), 'select public.boss_state(p_test => false) as v')).v.phase, 'active', 'the game names the argument, so it still works');
  await S.db.exec(readFileSync(new URL('../../supabase/world-boss.sql', import.meta.url), 'utf8'));
  const left = (await S.db.query(`select p.oid::regprocedure::text as f from pg_proc p where proname in ('boss_state', 'boss_event_now') order by 1`)).rows.map(r => r.f);
  assert.deepEqual(left, ['boss_event_now(boolean)', 'boss_state(boolean)'], 'running the whole file again removes the old versions');
});

test('fire time: honest players get every hit, however they batch them; spammers get what the gun can fire', () => {
  // An SMG fired flat out for a minute (magazine, reload, magazine...), reported every 2 seconds, loses nothing.
  const shots = [], cycle = 39 * 90 + 1800;
  for (let k = 0; k * cycle < 60_000; k++) for (let i = 0; i < 40; i++) shots.push(k * cycle + i * 90);
  let lastAt = -FIRE_WINDOW_MS, accepted = 0, sent = 0;
  for (let now = 2000; now <= 62_000; now += 2000) {
    const n = shots.filter(t => t < now).length - sent; sent += n;
    const spent = spendFireTime(lastAt, now, { smg: n }); lastAt = spent.lastAt; accepted += spent.accepted.smg || 0;
  }
  assert.equal(accepted, shots.length);
  // Claiming 1000 shots every half second only ever counts one SMG's worth.
  lastAt = 0; let claimed = 0;
  for (let now = 500; now <= 60_000; now += 500) { const spent = spendFireTime(lastAt, now, { smg: 1000, rocket: 1000 }); lastAt = spent.lastAt; claimed += spent.damage; }
  assert.ok(claimed <= Math.max(KAIJU_DAMAGE.smg.damage / KAIJU_DAMAGE.smg.costMs, KAIJU_DAMAGE.rocket.damage / KAIJU_DAMAGE.rocket.costMs) * (60_000 + FIRE_GRACE_MS), 'capped at the best sustained rate');
});

test('free aim: point at any part of the kaiju, from its feet to its head, and the shot lands there', () => {
  const event = eventForDay(day), city = CITIES.find(c => c.id === event.city), s = createSession(city, { owned: ['shotgun', 'sniper'] }); s.traffic = []; s.pedestrians = [];
  s.bossEvent = { ...event, hp: BOSS_HP, defeatedAt: null, phase: 'active' };
  const t = 900; s.worldTime = event.startsAt / 1000 + t; stepWorld(s, {}, 0.02);
  const boss = kaijuPose(s.boss.t);
  assert.ok(kaijuRise(0) < -60 && kaijuRise(60) === 0, 'it rises out of the sea');
  // Stand 120 m in front of it, with the camera 20 m behind you, and aim at its head.
  const toward = { x: Math.sin(boss.heading), z: Math.cos(boss.heading) };
  s.player = { ...s.player, x: boss.x + toward.x * 120, z: boss.z + toward.z * 120, moveX: 0, moveZ: 0 };
  const cam = { x: s.player.x + toward.x * 20, y: 12, z: s.player.z + toward.z * 20 };
  const rayTo = target => { const d = { x: target.x - cam.x, y: target.y - cam.y, z: target.z - cam.z }, l = Math.hypot(d.x, d.y, d.z); return { o: cam, d: { x: d.x / l, y: d.y / l, z: d.z / l }, near: 22 }; };
  const head = { x: boss.x + toward.x * 30, y: 132, z: boss.z + toward.z * 30 }, foot = { x: boss.x + toward.x * 3 + Math.cos(boss.heading) * 10.5, y: 8, z: boss.z + toward.z * 3 - Math.sin(boss.heading) * 10.5 };
  assert.equal(kaijuRayHit(rayTo(head).o, rayTo(head).d, s.boss.t, s.boss)?.part, 'head');
  assert.equal(kaijuRayHit(rayTo(foot).o, rayTo(foot).d, s.boss.t, s.boss)?.part, 'leg');
  const sky = { x: boss.x + toward.x * 30, y: 400, z: boss.z + toward.z * 30 };
  assert.notEqual(aimFromRay(s, rayTo(sky)).kind, 'kaiju', 'above its head is a miss');
  // Fire at the head: the hit is queued for the server, lands high up, and the arms point up at it.
  s.cooldown = 0; s.worldTime += 0.02; stepWorld(s, {}, 0.02, Math.PI, rayTo(head)); attack(s);
  assert.equal(s.bossHits.pistol, 1); assert.ok(s.kaijuImpact.y > 110, `hit high (${s.kaijuImpact.y})`); assert.ok(s.aimPitch > 0.5, 'aiming up');
  assert.equal(s.heat, 0, 'shooting the kaiju does not draw the police');
  // Aim at the sky: no hit, and a miss while it attacks does not bring the police.
  s.cooldown = 0; stepWorld(s, {}, 0.001, Math.PI, rayTo(sky)); attack(s); assert.equal(s.bossHits.pistol, 1); assert.equal(s.heat, 0);
  // The shotgun only reaches it up close: at 120 m the pellets fall short and you are told to get closer.
  equip(s, 'shotgun'); s.cooldown = 0; stepWorld(s, {}, 0.001, Math.PI, rayTo(head)); attack(s);
  assert.equal(s.bossHits.shotgun, undefined); assert.match(s.message, /get within 70 m/);
  // A person standing in the line of fire is hit first.
  s.enemies = [{ id: 'g', kind: 'gang', x: s.player.x - toward.x * 10, z: s.player.z - toward.z * 10, health: 100, cooldown: 9, heading: 0, height: 0 }];
  const line = aimFromRay(s, rayTo({ x: s.enemies[0].x, y: 1.4, z: s.enemies[0].z }));
  assert.equal(line.kind, 'person'); assert.equal(line.target.id, 'g');
});

test('the aiming body follows the kaiju model: its walk, its tail and its attacks', async () => {
  // The scene's sound hooks need a page; a bare stand-in is enough to build the model here.
  globalThis.document ??= { addEventListener() {}, removeEventListener() {}, hidden: false };
  globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
  const THREE = await import('three'), { createKaiju } = await import('../../src/scenes/worldTour/kaijuScene.js');
  let n = 7; const random = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (const t of [150, 700, 2000]) {
    const root = new THREE.Group(), kaiju = createKaiju(root), boss = { ...kaijuPose(t), t, alive: true };
    kaiju.update({ boss, bossEvent: { seed: 3, startsAt: 0 }, ruins: null, time: 0 }, 0.016, new THREE.PerspectiveCamera(), []); root.updateMatrixWorld(true);
    const meshes = []; root.children[0].traverse(o => { if (o.isMesh) meshes.push(o); });
    const ray = new THREE.Raycaster(); let model = 0, agree = 0, extra = 0;
    for (let i = 0; i < 1500; i++) {
      const a = random() * Math.PI * 2, o = new THREE.Vector3(boss.x + Math.sin(a) * 150, 2 + random() * 40, boss.z + Math.cos(a) * 150);
      const d = new THREE.Vector3(boss.x + (random() - 0.5) * 80, random() * 150, boss.z + (random() - 0.5) * 80).sub(o).normalize(); ray.set(o, d);
      const onModel = ray.intersectObjects(meshes, false).length > 0, onBox = !!kaijuRayHit(o, d, t, boss, 3);
      if (onModel) { model++; if (onBox) agree++; } else if (onBox) extra++;
    }
    assert.ok(agree / model > 0.9, `t=${t}: shots that hit the model count (${agree}/${model})`);
    assert.ok(extra / model < 0.15, `t=${t}: and few that miss it do (${extra})`);
    kaiju.dispose();
  }
});
