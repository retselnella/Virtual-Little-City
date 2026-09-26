// World boss rules: the schedule, HP, weapon damage, rate limits, rankings and weekly rewards. These are the rules the
// server enforces (supabase/world-boss.sql implements exactly the same rules in Postgres, and tests check that both
// agree); the browser only uses them to run the same-browser local mode and to predict what the server will answer.
// All times are epoch milliseconds; the event follows Philippine time (UTC+8), like the game's clock.
export const BOSS_NAME = 'Kaiju';
export const BOSS_HP = 1_000_000_000;
export const EVENT = Object.freeze({ hourPh: 12, durationMs: 60 * 60 * 1000, warningMs: 60 * 60 * 1000 });
export const CITY_ORDER = Object.freeze(['miami', 'tokyo', 'manila', 'london', 'dubai', 'rio', 'cape']);
// Damage per hit is decided here, never by the client, and differs per weapon. Each hit also costs fire time: `costMs`
// is the fastest a player can keep that weapon firing, cooldowns and reloads included (see weapons.js; tests check
// they match). The server gives each player one second of fire time per second, banks up to FIRE_WINDOW_MS of it and
// allows FIRE_GRACE_MS for network jitter, so whatever the browser claims, nobody out-damages the weapons they hold.
// Balance: sustained damage per second rises with price, from about 93k (the free pistol) to about 194k (the rocket
// launcher, the most expensive), so the best gun is about twice the free one; fists are free but mean standing under
// its feet, and the shotgun and fists only reach it up close.
export const KAIJU_DAMAGE = Object.freeze({
  fists: { damage: 50_000, costMs: 450 },
  pistol: { damage: 34_000, costMs: 367 },
  revolver: { damage: 98_000, costMs: 792 },
  smg: { damage: 17_500, costMs: 133 },
  shotgun: { damage: 145_000, costMs: 1044 },
  rifle: { damage: 32_000, costMs: 225 },
  lmg: { damage: 26_000, costMs: 154 },
  sniper: { damage: 290_000, costMs: 1680 },
  rocket: { damage: 330_000, costMs: 1700 },
});
export const ARMS = Object.freeze(Object.keys(KAIJU_DAMAGE));
export const FIRE_WINDOW_MS = 8000, FIRE_GRACE_MS = 1000;
// Sustained damage per second against the kaiju with one weapon.
export const kaijuDps = id => Math.round(KAIJU_DAMAGE[id].damage * 1000 / KAIJU_DAMAGE[id].costMs);
export const HIT_RANGE = 220, DEATH_COOLDOWN_MS = 8000;
export const REWARDS = Object.freeze([
  { from: 1, to: 1, tier: 'Champion', cash: 100_000, title: 'Kaiju Slayer' },
  { from: 2, to: 10, tier: 'Top 10', cash: 50_000, title: 'Kaiju Hunter' },
  { from: 11, to: 100, tier: 'Top 100', cash: 10_000, title: 'Defender' },
]);

const DAY = 86_400_000, PH = 8 * 3_600_000;
// Day number in Philippine time; the event of day d starts at 12:00 PHT and the boss appears on a city in turn.
export const phDay = ms => Math.floor((ms + PH) / DAY);
export function eventForDay(day) {
  const startsAt = day * DAY - PH + EVENT.hourPh * 3_600_000;
  return { id: `boss-${day}`, day, city: CITY_ORDER[((day % CITY_ORDER.length) + CITY_ORDER.length) % CITY_ORDER.length], seed: day, startsAt, endsAt: startsAt + EVENT.durationMs, maxHp: BOSS_HP };
}
// The event that matters at `now`: today's if it has not finished yet, otherwise tomorrow's.
export function currentEvent(now) {
  const today = eventForDay(phDay(now));
  return now < today.endsAt ? today : eventForDay(phDay(now) + 1);
}
// scheduled (far off) → countdown (in the hour before) → active → defeated or ended.
export function phaseAt(event, now, hp = event.maxHp, defeatedAt = null) {
  if (defeatedAt !== null && defeatedAt !== undefined) return 'defeated';
  if (now >= event.endsAt) return 'ended';
  if (now >= event.startsAt) return hp > 0 ? 'active' : 'defeated';
  return now >= event.startsAt - EVENT.warningMs ? 'countdown' : 'scheduled';
}

// A batch of hits: { weaponId: count }. Unknown weapons are ignored; counts must be whole and not negative.
export function validHits(hits) {
  if (!hits || typeof hits !== 'object' || Array.isArray(hits)) return false;
  return ARMS.every(id => hits[id] === undefined || (Number.isInteger(hits[id]) && hits[id] >= 0));
}
// Charge a batch against the player's fire time. `lastAt` is how far their fire time is used up (ms). Weapons are
// taken in a fixed order, each accepting as many hits as the time left pays for. Returns the accepted hits, the damage
// and the new `lastAt`.
export function spendFireTime(lastAt, now, hits) {
  const start = Math.max(lastAt, now - FIRE_WINDOW_MS);
  let budget = now - start + FIRE_GRACE_MS, used = 0, damage = 0, count = 0;
  const accepted = {};
  for (const id of ARMS) {
    const arm = KAIJU_DAMAGE[id], n = Math.max(0, Math.min(Math.min(hits[id] || 0, 100_000), Math.floor(budget / arm.costMs)));
    if (!n) continue;
    accepted[id] = n; budget -= n * arm.costMs; used += n * arm.costMs; damage += n * arm.damage; count += n;
  }
  return { accepted, damage, count, lastAt: start + used };
}

// ---- The local (same-browser) server. Online play uses the Postgres functions instead; this mirrors them exactly.
export function createBossStore() { return { events: {}, weekly: {}, rewards: {}, closedWeeks: [] }; }
function eventRecord(store, event) {
  if (!store.events[event.id]) store.events[event.id] = { ...event, hp: event.maxHp, defeatedAt: null, players: {} };
  return store.events[event.id];
}
// Apply a batch of hits. Returns { ok, reason?, damage, hp }: the damage is computed here, not taken from the caller.
export function submitHits(store, { playerId, name, eventId, hits, x, z, city, bossX, bossZ, now }) {
  const record = store.events[eventId];
  if (!record) return { ok: false, reason: 'no-event', damage: 0 };
  const phase = phaseAt(record, now, record.hp, record.defeatedAt);
  if (phase !== 'active') return { ok: false, reason: phase, damage: 0, hp: record.hp };
  if (city !== record.city) return { ok: false, reason: 'wrong-city', damage: 0, hp: record.hp };
  if (!validHits(hits)) return { ok: false, reason: 'bad-input', damage: 0, hp: record.hp };
  if (Math.hypot(x - bossX, z - bossZ) > HIT_RANGE) return { ok: false, reason: 'out-of-range', damage: 0, hp: record.hp };
  const player = record.players[playerId] || (record.players[playerId] = { id: playerId, name, damage: 0, hits: 0, deaths: 0, lastAt: Math.max(record.startsAt, now - FIRE_WINDOW_MS), lastDeathAt: 0 });
  const spent = spendFireTime(player.lastAt, now, hits), damage = Math.min(record.hp, spent.damage);
  player.name = name; player.lastAt = spent.lastAt; player.damage += damage; player.hits += spent.count;
  record.hp -= damage;
  if (record.hp <= 0) { record.hp = 0; record.defeatedAt = now; }
  const week = weekOf(now), weekly = store.weekly[week] || (store.weekly[week] = {});
  weekly[playerId] = { id: playerId, name, damage: (weekly[playerId]?.damage || 0) + damage };
  return { ok: true, damage, accepted: spent.accepted, hp: record.hp };
}
export function reportDeath(store, { playerId, eventId, now }) {
  const player = store.events[eventId]?.players[playerId];
  if (!player || now - player.lastDeathAt < DEATH_COOLDOWN_MS) return false;
  player.deaths++; player.lastDeathAt = now; return true;
}
// Live ranking: rank, name, damage and share of all damage dealt in the event.
export function ranking(players, limit = 10) {
  const list = Object.values(players).filter(p => p.damage > 0).sort((a, b) => b.damage - a.damage || a.id.localeCompare(b.id));
  const total = list.reduce((sum, p) => sum + p.damage, 0);
  return { total, rows: list.slice(0, limit).map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, damage: p.damage, share: total ? p.damage / total : 0 })), rankOf: id => { const i = list.findIndex(p => p.id === id); return i < 0 ? null : i + 1; } };
}
export function eventState(store, now, playerId = null) {
  const event = currentEvent(now), record = store.events[event.id] || { ...event, hp: event.maxHp, defeatedAt: null, players: {} };
  if (phaseAt(event, now) === 'active') eventRecord(store, event);
  const board = ranking(record.players), me = playerId && record.players[playerId];
  return {
    id: event.id, city: event.city, seed: event.seed, startsAt: event.startsAt, endsAt: event.endsAt, maxHp: event.maxHp, hp: record.hp, defeatedAt: record.defeatedAt,
    phase: phaseAt(record, now, record.hp, record.defeatedAt), serverNow: now, top: board.rows, totalDamage: board.total,
    me: me ? { damage: me.damage, hits: me.hits, deaths: me.deaths, rank: board.rankOf(playerId) } : { damage: 0, hits: 0, deaths: 0, rank: null },
  };
}

// ---- Weekly leaderboard: weeks start on Monday 00:00 Philippine time.
export function weekOf(ms) { const day = phDay(ms), weekday = ((day + 3) % 7 + 7) % 7; return day - weekday; }
export const weekStartMs = week => week * DAY - PH;
export function rewardFor(rank, tiers = REWARDS) { return tiers.find(t => rank >= t.from && rank <= t.to) || null; }
// Close a finished week: final ranks and rewards for the top 100. Closing twice changes nothing.
export function closeWeek(store, week, tiers = REWARDS) {
  if (store.closedWeeks.includes(week)) return store.rewards[week] || [];
  const entries = Object.values(store.weekly[week] || {}).filter(e => e.damage > 0).sort((a, b) => b.damage - a.damage || a.id.localeCompare(b.id));
  store.rewards[week] = entries.slice(0, 100).map((e, i) => ({ week, rank: i + 1, id: e.id, name: e.name, damage: e.damage, reward: rewardFor(i + 1, tiers), claimed: false }));
  store.closedWeeks.push(week);
  return store.rewards[week];
}
// Weekly board for `now`; finished weeks are closed first (lazily, so no scheduler is required).
export function weeklyState(store, now, playerId = null) {
  const week = weekOf(now);
  for (const w of Object.keys(store.weekly).map(Number)) if (w < week) closeWeek(store, w);
  const list = Object.values(store.weekly[week] || {}).filter(e => e.damage > 0).sort((a, b) => b.damage - a.damage || a.id.localeCompare(b.id));
  const mine = Object.values(store.rewards).flat().filter(r => r.id === playerId && r.reward && !r.claimed);
  return { week, startsAt: weekStartMs(week), endsAt: weekStartMs(week + 7), rows: list.slice(0, 100).map((e, i) => ({ rank: i + 1, id: e.id, name: e.name, damage: e.damage })), myRank: playerId ? (list.findIndex(e => e.id === playerId) + 1 || null) : null, unclaimed: mine };
}
export function claimRewards(store, playerId) {
  let cash = 0;
  for (const r of Object.values(store.rewards).flat()) if (r.id === playerId && r.reward && !r.claimed) { r.claimed = true; cash += r.reward.cash; }
  return cash;
}
