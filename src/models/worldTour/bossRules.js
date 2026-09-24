// World boss rules: the schedule, HP, weapon damage, rate limits, rankings and weekly rewards. These are the rules the
// server enforces (supabase/world-boss.sql implements exactly the same rules in Postgres, and tests check that both
// agree); the browser only uses them to run the same-browser local mode and to predict what the server will answer.
// All times are epoch milliseconds; the event follows Philippine time (UTC+8), like the game's clock.
export const BOSS_NAME = 'Kaiju';
export const BOSS_HP = 1_000_000_000;
export const EVENT = Object.freeze({ hourPh: 12, durationMs: 60 * 60 * 1000, warningMs: 60 * 60 * 1000 });
export const CITY_ORDER = Object.freeze(['miami', 'tokyo', 'manila', 'london', 'dubai', 'rio', 'cape']);
// Damage per hit is decided here, never by the client. Cooldowns cap how many hits a player can land per second.
export const WEAPONS = Object.freeze({ shot: { damage: 45_000, cooldown: 0.3 }, punch: { damage: 80_000, cooldown: 0.45 } });
export const HIT_RANGE = 220, DEATH_COOLDOWN_MS = 8000, MAX_BATCH_SECONDS = 5;
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

// Validate a batch of hits against the time since the player's last accepted batch (at most MAX_BATCH_SECONDS count).
export function allowedHits(sinceLastMs) {
  const seconds = Math.max(0, Math.min(MAX_BATCH_SECONDS, sinceLastMs / 1000));
  return { shot: Math.floor(seconds / WEAPONS.shot.cooldown) + 1, punch: Math.floor(seconds / WEAPONS.punch.cooldown) + 1 };
}
export function hitDamage(shots, punches) { return shots * WEAPONS.shot.damage + punches * WEAPONS.punch.damage; }

// ---- The local (same-browser) server. Online play uses the Postgres functions instead; this mirrors them exactly.
export function createBossStore() { return { events: {}, weekly: {}, rewards: {}, closedWeeks: [] }; }
function eventRecord(store, event) {
  if (!store.events[event.id]) store.events[event.id] = { ...event, hp: event.maxHp, defeatedAt: null, players: {} };
  return store.events[event.id];
}
// Apply a batch of hits. Returns { ok, reason?, damage, hp }: the damage is computed here, not taken from the caller.
export function submitHits(store, { playerId, name, eventId, shots = 0, punches = 0, x, z, city, bossX, bossZ, now }) {
  const record = store.events[eventId];
  if (!record) return { ok: false, reason: 'no-event', damage: 0 };
  const phase = phaseAt(record, now, record.hp, record.defeatedAt);
  if (phase !== 'active') return { ok: false, reason: phase, damage: 0, hp: record.hp };
  if (city !== record.city) return { ok: false, reason: 'wrong-city', damage: 0, hp: record.hp };
  if (!Number.isInteger(shots) || !Number.isInteger(punches) || shots < 0 || punches < 0) return { ok: false, reason: 'bad-input', damage: 0, hp: record.hp };
  if (Math.hypot(x - bossX, z - bossZ) > HIT_RANGE) return { ok: false, reason: 'out-of-range', damage: 0, hp: record.hp };
  const player = record.players[playerId] || (record.players[playerId] = { id: playerId, name, damage: 0, hits: 0, deaths: 0, lastAt: Math.max(record.startsAt, now - 1000), lastDeathAt: 0 });
  const cap = allowedHits(now - player.lastAt);
  const s = Math.min(shots, cap.shot), p = Math.min(punches, cap.punch), damage = Math.min(record.hp, hitDamage(s, p));
  player.name = name; player.lastAt = now; player.damage += damage; player.hits += s + p;
  record.hp -= damage;
  if (record.hp <= 0) { record.hp = 0; record.defeatedAt = now; }
  const week = weekOf(now), weekly = store.weekly[week] || (store.weekly[week] = {});
  weekly[playerId] = { id: playerId, name, damage: (weekly[playerId]?.damage || 0) + damage };
  return { ok: true, damage, accepted: { shots: s, punches: p }, hp: record.hp };
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
