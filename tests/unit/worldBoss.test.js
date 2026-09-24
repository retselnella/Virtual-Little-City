import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { BOSS_HP, REWARDS, WEAPONS, claimRewards, createBossStore, currentEvent, eventForDay, eventState, phDay, phaseAt, ranking, reportDeath, submitHits, weekOf, weeklyState } from '../../src/models/worldTour/bossRules.js';
import { ATTACKS, KAIJU, attackAt, destructionAt, kaijuHazards, kaijuInReach, kaijuPose, standingBlocks } from '../../src/models/worldTour/worldBoss.js';
import { CITIES, createSession, generateBlocks, stepWorld, attack } from '../../src/models/worldTour/worldAdventure.js';
import { sceneryLayout } from '../../src/models/worldTour/worldLayout.js';

const PH = 8 * 3600_000, day = phDay(Date.UTC(2026, 8, 24, 4)), at = (h, m = 0, s = 0, d = day) => d * 86_400_000 - PH + ((h * 60 + m) * 60 + s) * 1000;
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c';

// The real server SQL, in an in-memory Postgres, with Supabase's auth.uid() and API roles stubbed.
async function server() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  await db.exec(readFileSync(new URL('../../supabase/world-boss.sql', import.meta.url), 'utf8'));
  // Tests control the server clock; production uses now().
  await db.exec(`create or replace function public.boss_now() returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('test.now', true), '')::timestamptz, now()) $$;`);
  const as = async (uid, ms, sql, params = []) => {
    await db.query(`select set_config('test.uid', $1, false), set_config('test.now', $2, false)`, [uid || '', new Date(ms).toISOString()]);
    await db.exec('set role authenticated');
    try { return (await db.query(sql, params)).rows[0]; } finally { await db.exec('reset role'); }
  };
  return { db, as, state: (uid, ms) => as(uid, ms, 'select public.boss_state() as v').then(r => r.v),
    hit: (uid, ms, event, shots, punches, x, z, city, name = 'P') => as(uid, ms, 'select public.boss_hit($1, $2, $3, $4, $5, $6, $7) as v', [event, shots, punches, x, z, city, name]).then(r => r.v) };
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
    [A, t, 10, 0, boss.x + 30, boss.z, event.city], [A, t, 10, 10, boss.x + 30, boss.z, event.city], [A, t + 3000, 50, 50, boss.x, boss.z + 20, event.city],
    [B, t + 3100, 2, 1, boss.x - 10, boss.z, event.city], [B, t + 3200, 1, 0, boss.x + 500, boss.z, event.city], [C, t + 3300, 1, 0, boss.x, boss.z, 'nowhere'],
    [C, t + 3400, -5, 0, boss.x, boss.z, event.city],
  ];
  for (const [uid, ms, shots, punches, x, z, city] of cases) {
    const sql = await S.hit(uid, ms, event.id, shots, punches, x, z, city), pose = kaijuPose((ms - event.startsAt) / 1000);
    const js = submitHits(store, { playerId: uid, name: 'P', eventId: event.id, shots, punches, x, z, city, bossX: pose.x, bossZ: pose.z, now: ms });
    assert.equal(sql.ok, js.ok, `ok for ${JSON.stringify([uid.at(-1), shots, punches])}: ${sql.reason}`); assert.equal(sql.reason, js.reason); assert.equal(Number(sql.damage), js.damage);
  }
  // Spamming hits within one second only counts what the cooldowns allow.
  const first = await S.hit(A, t + 3000 + 1, event.id, 1000, 1000, boss.x, boss.z, event.city);
  assert.equal(first.accepted.shots, 1); assert.equal(first.accepted.punches, 1);
  assert.equal(Number(first.damage), WEAPONS.shot.damage + WEAPONS.punch.damage);
  const after = await S.state(A, t + 4000);
  assert.equal(after.phase, 'active'); assert.equal(Number(after.hp), BOSS_HP - after.top.reduce((sum, r) => sum + Number(r.damage), 0));
});

test('the ranking orders players by damage with their share, and the kaiju can be defeated', async () => {
  const S = await server(), event = eventForDay(day), t = at(12, 10), boss = kaijuPose(600);
  await S.state(A, t);
  await S.hit(A, t, event.id, 3, 0, boss.x, boss.z, event.city, 'Ada');
  await S.hit(B, t, event.id, 0, 2, boss.x, boss.z, event.city, 'Ben');
  await S.hit(C, t, event.id, 1, 0, boss.x, boss.z, event.city, 'Cy');
  const state = await S.state(B, t + 100);
  assert.deepEqual(state.top.map(r => r.name), ['Ben', 'Ada', 'Cy']);
  assert.ok(Math.abs(state.top.reduce((sum, r) => sum + r.share, 0) - 1) < 1e-9); assert.equal(state.me.rank, 1);
  const local = ranking({ a: { id: 'a', name: 'Ada', damage: 135000 }, b: { id: 'b', name: 'Ben', damage: 160000 }, c: { id: 'c', name: 'Cy', damage: 45000 } });
  assert.deepEqual(local.rows.map(r => [r.rank, r.name]), [[1, 'Ben'], [2, 'Ada'], [3, 'Cy']]);
  // Nearly dead: the next hit kills it, only the remaining HP counts, and later hits are refused.
  await S.db.query('update boss_events set hp = 50000 where id = $1', [event.id]);
  const kill = await S.hit(A, t + 2000, event.id, 5, 0, boss.x, boss.z, event.city, 'Ada');
  assert.equal(Number(kill.damage), 50000); assert.equal(Number(kill.hp), 0);
  assert.equal((await S.state(A, t + 2100)).phase, 'defeated');
  assert.equal((await S.hit(B, t + 4000, event.id, 1, 0, boss.x, boss.z, event.city)).reason, 'defeated');
});

test('the event ends on its own after an hour and the next one is prepared', async () => {
  const S = await server(), event = eventForDay(day);
  await S.state(A, at(12, 1));
  const late = await S.state(A, at(13, 0, 30));
  assert.equal(late.id, eventForDay(day + 1).id); assert.equal(late.phase, 'scheduled'); assert.notEqual(late.city, event.city);
  assert.equal((await S.hit(A, at(13, 0, 30), event.id, 1, 0, 0, 0, event.city)).reason, 'ended');
});

test('weekly leaderboard: totals across events, closed at the end of the week with configured rewards, claimed once', async () => {
  const S = await server(), e1 = eventForDay(day), e2 = eventForDay(day + 1);
  const hitAt = async (uid, e, shots) => { const t = e.startsAt + 200_000, p = kaijuPose(200); await S.state(uid, t); return S.hit(uid, t, e.id, shots, 0, p.x, p.z, e.city, uid === A ? 'Ada' : 'Ben'); };
  await hitAt(A, e1, 2); await hitAt(B, e1, 4); await hitAt(A, e2, 4);
  const sameWeek = weekOf(e1.startsAt) === weekOf(e2.startsAt), weekly = await S.as(A, e2.startsAt + 300_000, 'select public.boss_weekly_state() as v').then(r => r.v);
  // Each first report may count at most 4 shots (one second of fire): Ada 2 + 4 shots, Ben 4 shots.
  if (sameWeek) assert.deepEqual(weekly.rows.map(r => [r.name, Number(r.damage)]), [['Ada', 270000], ['Ben', 180000]]);
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
  const p = kaijuPose(200); submitHits(store, { playerId: 'a', name: 'Ada', eventId: e1.id, shots: 2, punches: 0, x: p.x, z: p.z, city: e1.city, bossX: p.x, bossZ: p.z, now: e1.startsAt + 200_000 });
  const local = weeklyState(store, nextWeek, 'a'); assert.equal(local.unclaimed[0].reward.tier, 'Champion'); assert.ok(claimRewards(store, 'a') > 0 && claimRewards(store, 'a') === 0);
  assert.ok(reportDeath(store, { playerId: 'a', eventId: e1.id, now: e1.startsAt + 300_000 }) && !reportDeath(store, { playerId: 'a', eventId: e1.id, now: e1.startsAt + 301_000 }));
});

test('clients cannot touch the tables or call internal functions', async () => {
  const S = await server();
  for (const sql of ['select * from boss_events', 'update boss_events set hp = 0', "insert into boss_weekly values (1, gen_random_uuid(), 'x', 999999999999)", 'select public.boss_close_weeks()', 'select * from boss_reward_tiers']) {
    await assert.rejects(S.as(A, at(12, 5), sql), /permission denied/, sql);
  }
  assert.equal((await S.as(null, at(12, 5), `select public.boss_hit('x', 1, 0, 0, 0, 'miami', 'x') as v`)).v.reason, 'signed-out');
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
  attack(s); assert.equal(s.bossHits.shot, 1, 'the shot is queued for the server (it decides the damage)'); assert.equal(s.heat, 0, 'fighting the kaiju does not draw the police');
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
