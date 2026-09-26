import { CITIES, LIMIT } from './worldAdventure.js';
import { cleanCharacter, cleanName, DEFAULT_CHARACTER, playerLook } from './characterProfile.js';
import { WEAPON_ORDER } from './weapons.js';
import { MAX_STARS, starsOf } from './wanted.js';

// Shared-world presence: every player broadcasts where they are, how they look and the attacks they make; everyone
// renders the others as "ghosts" (visible, not collidable) that aim, punch and fire. Traffic, pedestrians, police and
// contracts remain simulated per player, so an attack is replayed as a pose, tracer and blood, not as damage.
// Everything that arrives over the network is untrusted and goes through the cleaners below.
export const SEND_INTERVAL = 100, HEARTBEAT_INTERVAL = 1000, STALE_AFTER = 6000, RENDER_DELAY = 120, MAX_REMOTE = 24;
const MAX_MESSAGES_PER_SECOND = 25, BUFFER = 24, MAX_ACTIONS = 4, ACTION_QUEUE = 16, ACTION_EXPIRY = 1000;
export const LOBBY_CHANNEL = 'little-city:lobby';
export const cityChannel = city => `little-city:city:${city}`;
export const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);

const finite = (value, limit) => Number.isFinite(value) ? Math.max(-limit, Math.min(limit, value)) : null;
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

// What this player sends ~10 times a second (compact keys keep Realtime messages small). `actions` are the attacks made
// since the last message, numbered by the sender so receivers can drop repeats.
export function encodeState(s, now, actions = []) {
  // On a boat or the metro you are sent at the boat's or train's position (standing on the train's deck).
  const driving = !!s.driving, body = driving ? s.car : s.boating ? s.boat : s.riding ? s.train : s.player, q = s.car.q || [0, Math.sin(s.car.heading / 2), 0, Math.cos(s.car.heading / 2)];
  return {
    v: 1, t: Math.round(now), x: round(body.x), z: round(body.z), y: round(driving ? s.car.y || 0 : s.riding ? s.train.y + 0.4 : s.boating ? 0 : s.player.height || 0), h: round(body.heading || 0, 3),
    s: round(Math.min(80, Math.abs(body.speed || 0)), 1), d: driving ? 1 : 0, ...(s.boating ? { b: 1 } : {}),
    ...(driving ? { q: q.map(n => round(n, 3)) } : {}), k: s.down > 0 ? 1 : 0, w: Math.max(0, WEAPON_ORDER.indexOf(s.weapon)), a: s.aimTime > 0 ? 1 : 0, ...(s.heat > 0 ? { st: starsOf(s.heat) } : {}), ...(s.seated ? { si: 1 } : {}),
    ...(actions.length ? { e: actions.slice(-MAX_ACTIONS).map(a => ({ i: a.id, k: a.kind === 'shot' ? 's' : 'p', c: a.combo, x: round(a.x), z: round(a.z), b: a.blood ? 1 : 0 })) } : {}),
  };
}
export function cleanState(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  const x = finite(raw.x, LIMIT), z = finite(raw.z, LIMIT), y = finite(raw.y, 300), h = finite(raw.h, 1e4), speed = finite(raw.s, 80);
  if ([x, z, y, h, speed].includes(null)) return null;
  const state = { x, z, y: Math.max(0, y), h: Math.atan2(Math.sin(h), Math.cos(h)), s: Math.abs(speed), d: raw.d === 1, b: raw.b === 1 && raw.d !== 1, k: raw.k === 1, w: Number.isInteger(raw.w) && raw.w > 0 && raw.w < WEAPON_ORDER.length ? WEAPON_ORDER[raw.w] : null, a: raw.a === 1, st: Number.isInteger(raw.st) && raw.st >= 0 && raw.st <= MAX_STARS ? raw.st : 0, si: raw.si === 1 && raw.d !== 1 && raw.b !== 1 };
  if (state.d) {
    const q = Array.isArray(raw.q) && raw.q.length === 4 ? raw.q.map(n => finite(n, 1)) : null, norm = q && !q.includes(null) ? Math.hypot(...q) : 0;
    state.q = norm > 0.5 ? q.map(n => n / norm) : [0, Math.sin(state.h / 2), 0, Math.cos(state.h / 2)];
  }
  return state;
}
export function cleanActions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ACTIONS).flatMap(a => {
    const x = finite(a?.x, LIMIT), z = finite(a?.z, LIMIT);
    if (!Number.isSafeInteger(a?.i) || a.i < 1 || (a.k !== 's' && a.k !== 'p') || x === null || z === null) return [];
    return [{ id: a.i, kind: a.k === 's' ? 'shot' : 'punch', combo: [0, 1, 2].includes(a.c) ? a.c : 0, x, z, blood: a.b === 1 }];
  });
}
// Name, look and city: sent on join and whenever they change.
export function encodeProfile(character, city) { return { v: 1, name: cleanName(character?.name), look: cleanCharacter(character) || { ...DEFAULT_CHARACTER }, city }; }
export function cleanProfile(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  const look = cleanCharacter(raw.look) || { ...DEFAULT_CHARACTER };
  return { name: cleanName(raw.name) || 'Traveller', look: { ...look, name: undefined }, scale: playerLook(look).scale, city: CITIES.some(c => c.id === raw.city) ? raw.city : null };
}

// ---- The roster of other players in this city, with a short snapshot buffer each for smooth interpolation.
export function createRoster() { return { players: new Map(), version: 0 }; }
function entry(roster, id) {
  let player = roster.players.get(id);
  if (!player) { player = { id, snapshots: [], actions: [], lastAction: 0, profile: null, seen: 0, window: 0, count: 0 }; roster.players.set(id, player); roster.version++; }
  return player;
}
export function receiveState(roster, id, raw, now) {
  if (!validId(id)) return false;
  const state = cleanState(raw); if (!state) return false;
  const player = entry(roster, id);
  // Flooding clients are ignored for the rest of the second rather than trusted.
  if (now - player.window > 1000) { player.window = now; player.count = 0; }
  if (++player.count > MAX_MESSAGES_PER_SECOND) return false;
  player.snapshots.push({ at: now, ...state }); player.seen = now;
  if (player.snapshots.length > BUFFER) player.snapshots.shift();
  for (const action of cleanActions(raw.e)) {
    if (action.id <= player.lastAction) continue;
    player.lastAction = action.id; player.actions.push({ at: now, ...action });
  }
  if (player.actions.length > ACTION_QUEUE) player.actions.splice(0, player.actions.length - ACTION_QUEUE);
  return true;
}
export function hasProfile(roster, id) { return !!roster.players.get(id)?.profile; }
export function receiveProfile(roster, id, raw, now) {
  if (!validId(id)) return false;
  const profile = cleanProfile(raw); if (!profile) return false;
  const player = entry(roster, id); player.profile = profile; player.seen = Math.max(player.seen, now); roster.version++;
  return true;
}
export function removePlayer(roster, id) { if (roster.players.delete(id)) roster.version++; }
export function clearRoster(roster) { roster.players.clear(); roster.version++; }
export function pruneRoster(roster, now) { for (const [id, player] of roster.players) if (now - player.seen > STALE_AFTER) removePlayer(roster, id); }

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function slerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], sign = dot < 0 ? -1 : 1; dot *= sign;
  const q = a.map((n, i) => n + (b[i] * sign - n) * t), norm = Math.hypot(...q) || 1;
  return q.map(n => n / norm);
}
// A player's pose at `time` (RENDER_DELAY behind the newest snapshot keeps two snapshots to blend between).
// Long gaps snap instead of sliding; beyond the newest snapshot the pose holds (no guessing ahead).
export function samplePlayer(player, time) {
  const list = player.snapshots; if (!list.length) return null;
  const at = time - RENDER_DELAY;
  if (at <= list[0].at) return { ...list[0] };
  for (let i = list.length - 1; i > 0; i--) {
    const a = list[i - 1], b = list[i];
    if (at < a.at || at > b.at) continue;
    if (b.at - a.at > 1000 || a.d !== b.d) return { ...b };
    const t = (at - a.at) / (b.at - a.at);
    const pose = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, h: lerpAngle(a.h, b.h, t), s: a.s + (b.s - a.s) * t, d: b.d, b: b.b, k: b.k, w: b.w, a: b.a, st: b.st, si: b.si };
    if (b.d) pose.q = slerp(a.q, b.q, t);
    return pose;
  }
  return { ...list[list.length - 1] };
}
// Attacks due to play at `time`, on the same RENDER_DELAY as the poses so shots line up with the aiming body.
// Each is returned once; ones that waited too long (the player was off screen) are dropped unplayed.
export function dueActions(player, time) {
  const at = time - RENDER_DELAY, due = [];
  player.actions = player.actions.filter(action => {
    if (action.at > at) return true;
    if (at - action.at <= ACTION_EXPIRY) due.push(action);
    return false;
  });
  return due;
}
// The other players worth drawing: those with a known look and a pose, nearest first, capped.
export function visiblePlayers(roster, near, time) {
  const out = [];
  for (const player of roster.players.values()) {
    if (!player.profile) continue;
    const pose = samplePlayer(player, time); if (pose) out.push({ id: player.id, player, profile: player.profile, pose, distance: Math.hypot(pose.x - near.x, pose.z - near.z) });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, MAX_REMOTE);
}
// Lobby presence (who is online and where) summarised per city.
export function cityCounts(lobby, selfId) {
  const counts = {};
  for (const [id, raw] of Object.entries(lobby || {})) { if (id === selfId) continue; const profile = cleanProfile(raw); if (profile?.city) counts[profile.city] = (counts[profile.city] || 0) + 1; }
  return counts;
}
