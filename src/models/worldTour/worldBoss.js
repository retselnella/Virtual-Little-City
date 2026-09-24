// The kaiju's behaviour during an event: where it walks, which attack it makes when, what each attack hits and what it
// destroys. Everything is a pure function of the server-issued event (start time and seed) and the time since it
// started, so every player sees the same kaiju in the same place wrecking the same buildings, and a player who joins
// late sees all the destruction so far. The server uses the same path for its range check (supabase/world-boss.sql).
export const KAIJU = Object.freeze({ height: 150, bodyRadius: 22, crushRadius: 21, wadeSpeed: 5, walkSpeed: 2.5, attackEvery: 8, firstAttack: 20 });
const ENTRY = { from: { x: 760, z: -240 }, to: { x: 240, z: -240 } }, WADE = (ENTRY.from.x - ENTRY.to.x) / KAIJU.wadeSpeed;
const LOOP = [{ x: 240, z: -240 }, { x: 240, z: 240 }, { x: -240, z: 240 }, { x: -240, z: -240 }], SIDE = 480;

// Where the kaiju stands `t` seconds into the event, and which way it faces (atan2(dx, dz)).
export function kaijuPose(t) {
  if (t < WADE) return { x: ENTRY.from.x - KAIJU.wadeSpeed * Math.max(0, t), z: ENTRY.from.z, heading: -Math.PI / 2, wading: true };
  const d = ((t - WADE) * KAIJU.walkSpeed) % (SIDE * 4), side = Math.floor(d / SIDE), along = d - side * SIDE;
  const a = LOOP[side], b = LOOP[(side + 1) % 4];
  return { x: a.x + (b.x - a.x) * along / SIDE, z: a.z + (b.z - a.z) * along / SIDE, heading: Math.atan2(b.x - a.x, b.z - a.z), wading: false };
}
// How far the kaiju has walked (for footsteps and crushing along its path).
const walked = t => t < WADE ? KAIJU.wadeSpeed * Math.max(0, t) : ENTRY.from.x - ENTRY.to.x + (t - WADE) * KAIJU.walkSpeed;

function rng(seed, n) { let h = Math.imul((seed * 2654435761) ^ (n * 40503 + 7), 2246822519); h ^= h >>> 15; h = Math.imul(h, 3266489917); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
export const ATTACKS = Object.freeze({
  fire: { name: 'Fire breath', windup: 1.2, active: 3.2, cooldown: 2 },
  laser: { name: 'Atomic beam', windup: 2.0, active: 2.0, cooldown: 3 },
  slam: { name: 'Ground slam', windup: 1.5, active: 0.6, cooldown: 1 },
  roar: { name: 'Roar', windup: 0.8, active: 0.8, cooldown: 4 },
  meteors: { name: 'Fireball barrage', windup: 1.0, active: 3.6, cooldown: 2 },
  tail: { name: 'Tail sweep', windup: 1.0, active: 1.2, cooldown: 1 },
});
const ORDER = ['fire', 'laser', 'slam', 'roar', 'meteors', 'tail'];
// The i-th attack of an event: its type (never the same twice running, and respecting each attack's cooldown), timing
// and where it lands.
const attackCache = new Map();
export function attackAt(seed, i) {
  const key = `${seed}:${i}`;
  if (attackCache.has(key)) return attackCache.get(key);
  const start = KAIJU.firstAttack + i * KAIJU.attackEvery, pose = kaijuPose(start), prev = i > 0 ? attackAt(seed, i - 1) : null, prev2 = i > 1 ? attackAt(seed, i - 2) : null;
  const options = ORDER.filter(type => type !== prev?.type && !(ATTACKS[type].cooldown > 2 && type === prev2?.type));
  const type = options[Math.floor(rng(seed, i * 3) * options.length)], spec = ATTACKS[type];
  const reach = type === 'slam' ? 45 + rng(seed, i * 3 + 1) * 30 : 60 + rng(seed, i * 3 + 1) * 80, aim = pose.heading + (rng(seed, i * 3 + 2) - 0.5) * 1.2;
  const target = { x: pose.x + Math.sin(aim) * reach, z: pose.z + Math.cos(aim) * reach };
  const attack = { id: i, type, name: spec.name, start, impact: start + spec.windup, end: start + spec.windup + spec.active, from: { x: pose.x, z: pose.z }, heading: pose.heading, target };
  if (type === 'laser') { const side = aim + Math.PI / 2; attack.sweep = [{ x: target.x - Math.sin(side) * 45, z: target.z - Math.cos(side) * 45 }, { x: target.x + Math.sin(side) * 45, z: target.z + Math.cos(side) * 45 }]; }
  if (type === 'meteors') attack.shells = Array.from({ length: 5 }, (_, k) => ({ at: attack.impact + 0.5 + k * 0.6, x: target.x + (rng(seed, i * 11 + k) - 0.5) * 80, z: target.z + (rng(seed, i * 13 + k) - 0.5) * 80 }));
  if (type === 'tail') { const back = pose.heading + Math.PI; attack.target = { x: pose.x + Math.sin(back) * 40, z: pose.z + Math.cos(back) * 40 }; }
  attackCache.set(key, attack);
  if (attackCache.size > 4000) attackCache.clear();
  return attack;
}
export const attackIndex = t => Math.floor((t - KAIJU.firstAttack) / KAIJU.attackEvery);
// The attack in progress at time t (from its wind-up to its end), if any.
export function currentAttack(seed, t) {
  const i = attackIndex(t); if (i < 0) return null;
  const a = attackAt(seed, i); return t >= a.start && t < a.end ? a : null;
}
// Beam ground point `u` (0…1) along a laser sweep.
export const beamPoint = (a, u) => ({ x: a.sweep[0].x + (a.sweep[1].x - a.sweep[0].x) * u, z: a.sweep[0].z + (a.sweep[1].z - a.sweep[0].z) * u });
const segmentDistance = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
// The areas an attack wrecks (circles and lines), used for destruction.
export function blastZones(a) {
  if (a.type === 'slam') return [{ x: a.target.x, z: a.target.z, r: 34, at: a.impact }];
  if (a.type === 'tail') return [{ x: a.target.x, z: a.target.z, r: 46, at: a.impact + 0.4 }];
  if (a.type === 'meteors') return a.shells.map(s => ({ x: s.x, z: s.z, r: 13, at: s.at }));
  if (a.type === 'laser') return [{ line: a.sweep, r: 9, at: a.impact }];
  if (a.type === 'fire') return [{ cone: { x: a.from.x, z: a.from.z, heading: Math.atan2(a.target.x - a.from.x, a.target.z - a.from.z), range: 170, spread: 0.28 }, trees: true, at: a.impact }];
  return [];
}
const inZone = (zone, p, pad = 0) => zone.line ? segmentDistance(p, zone.line[0], zone.line[1]) < zone.r + pad
  : zone.cone ? (() => { const d = Math.hypot(p.x - zone.cone.x, p.z - zone.cone.z), off = Math.atan2(Math.sin(Math.atan2(p.x - zone.cone.x, p.z - zone.cone.z) - zone.cone.heading), Math.cos(Math.atan2(p.x - zone.cone.x, p.z - zone.cone.z) - zone.cone.heading)); return d < zone.cone.range && d > 20 && Math.abs(off) < zone.cone.spread; })()
  : Math.hypot(p.x - zone.x, p.z - zone.z) < zone.r + pad;

// Everything destroyed by time t: buildings (block index), trees and lamp posts (layout ids), and craters in the road.
// Buildings are crushed by the kaiju's body as it walks past and wrecked by blasts; the fire breath burns trees.
export function destructionAt(seed, t, blocks, layout) {
  const ruined = new Set(), trees = new Set(), posts = new Set(), craters = [];
  if (t <= 0) return { ruined, trees, posts, craters };
  const distance = walked(t), step = 6;
  for (let d = 0; d <= distance; d += step) {
    const at = d < ENTRY.from.x - ENTRY.to.x ? { x: ENTRY.from.x - d, z: ENTRY.from.z } : kaijuPose(WADE + (d - (ENTRY.from.x - ENTRY.to.x)) / KAIJU.walkSpeed);
    blocks.forEach((b, i) => { if (!ruined.has(i) && Math.abs(b.x - at.x) < b.width / 2 + KAIJU.crushRadius && Math.abs(b.z - at.z) < b.depth / 2 + KAIJU.crushRadius) ruined.add(i); });
    layout.trees.forEach((tree, i) => { if (Math.hypot(tree.x - at.x, tree.z - at.z) < KAIJU.crushRadius) trees.add(i); });
    layout.posts.forEach(post => { if (Math.hypot(post.x - at.x, post.z - at.z) < KAIJU.crushRadius) posts.add(post.id); });
  }
  for (let i = 0; i <= attackIndex(t); i++) {
    const a = attackAt(seed, i);
    for (const zone of blastZones(a)) {
      if (zone.at > t) continue;
      if (!zone.cone) blocks.forEach((b, k) => { if (!ruined.has(k) && inZone(zone, b, Math.min(b.width, b.depth) / 2)) ruined.add(k); });
      layout.trees.forEach((tree, k) => { if (inZone(zone, tree)) trees.add(k); });
      layout.posts.forEach(post => { if (inZone(zone, post)) posts.add(post.id); });
      if (!zone.cone && !zone.line) craters.push({ x: zone.x, z: zone.z, r: zone.r * 0.55 });
    }
  }
  return { ruined, trees, posts, craters };
}
// Blocks as they stand at time t: ruined ones are reduced to a low rubble pile (so physics, sight lines and the camera
// follow the destruction). The array keeps the island it stands on (see generateBlocks).
export function standingBlocks(blocks, ruined) {
  const next = blocks.map((b, i) => ruined.has(i) ? { ...b, height: 3.5, ruined: true } : b);
  if (blocks.island) Object.defineProperty(next, 'island', { value: blocks.island });
  return next;
}

// What the kaiju does to you this step: damage, knockback and stun. `at` is where you are (on foot, in a car or a boat).
// Returns a list of hits ({ damage, from, push, lift, stun, id }); one-off attacks hit once each (tracked in `memory`).
export function kaijuHazards(seed, t, at, memory, dt) {
  const hits = [], pose = kaijuPose(t), d = Math.hypot(at.x - pose.x, at.z - pose.z);
  const once = (id, hit) => { if (!memory.has(id)) { memory.add(id); hits.push({ id, ...hit }); } };
  // Its body and feet: you are shoved clear every step, and stamped on (once per footfall) if you linger underfoot.
  if (d < KAIJU.bodyRadius) {
    const id = `stomp:${Math.floor(t / 1.2)}`;
    hits.push({ id, damage: memory.has(id) ? 0 : 12, from: pose, push: 14, lift: 4, body: KAIJU.bodyRadius - d }); memory.add(id);
  }
  const a = currentAttack(seed, t);
  if (!a || t < a.impact) return hits;
  if (a.type === 'fire') {
    const zone = blastZones(a)[0];
    if (inZone(zone, at)) hits.push({ id: `fire:${a.id}`, damage: 14 * dt, from: a.from, push: 1, burning: true });
  } else if (a.type === 'laser') {
    const u = Math.min(1, (t - a.impact) / (a.end - a.impact)), beam = beamPoint(a, u);
    if (Math.hypot(at.x - beam.x, at.z - beam.z) < 8) once(`laser:${a.id}`, { damage: 45, from: beam, push: 10, lift: 3 });
  } else if (a.type === 'slam') {
    const r = Math.hypot(at.x - a.target.x, at.z - a.target.z);
    if (r < 55) once(`slam:${a.id}`, { damage: Math.round(12 + 38 * (1 - r / 55)), from: a.target, push: 18 * (1 - r / 70), lift: 6, knockdown: 1.2 });
  } else if (a.type === 'roar') {
    if (d < 260) once(`roar:${a.id}`, { damage: 4, from: pose, push: 3, stun: 1.4 });
  } else if (a.type === 'meteors') {
    a.shells.forEach((s, k) => { if (t >= s.at && t < s.at + 0.4 && Math.hypot(at.x - s.x, at.z - s.z) < 16) once(`meteor:${a.id}:${k}`, { damage: 30, from: s, push: 12, lift: 5 }); });
  } else if (a.type === 'tail') {
    if (t >= a.impact + 0.4 && Math.hypot(at.x - a.target.x, at.z - a.target.z) < 50) once(`tail:${a.id}`, { damage: 32, from: pose, push: 20, lift: 4 });
  }
  return hits;
}
// Can the player hit the kaiju from here? Returns the distance, or null if out of reach or aimed away.
export function kaijuInReach(player, aim, gun, t) {
  const pose = kaijuPose(t), d = Math.hypot(pose.x - player.x, pose.z - player.z);
  if (d > (gun ? 170 : 32)) return null;
  const off = Math.abs(Math.atan2(Math.sin(Math.atan2(pose.x - player.x, pose.z - player.z) - aim), Math.cos(Math.atan2(pose.x - player.x, pose.z - player.z) - aim)));
  return off < (gun ? Math.atan2(KAIJU.bodyRadius + 10, Math.max(1, d)) + 0.2 : 1.3) ? d : null;
}
