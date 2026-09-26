import { currentAttack, kaijuPose } from './worldBoss.js';

// Free aim: the player points with the mouse, and the shot goes where the pointer is. The scene turns the pointer into
// a ray from the camera ({ o, d } with d a unit vector, plus `near`: how far the player is from the camera, so nothing
// between the camera and the player is hit). This finds the first thing along that ray: the kaiju (any part of its
// body, from its feet to its head), a person, a building or the ground.

// Distance along a ray to the first building box within `max`, or null (slab test).
export function blockHit(blocks, o, d, max) {
  let best = null;
  for (const b of blocks) {
    const h = b.height ?? 200, lo = [b.x - b.width / 2, 0, b.z - b.depth / 2], hi = [b.x + b.width / 2, h, b.z + b.depth / 2], O = [o.x, o.y, o.z], D = [d.x, d.y, d.z];
    let enter = 0, exit = max;
    for (let i = 0; i < 3 && enter <= exit; i++) {
      if (Math.abs(D[i]) < 1e-9) { if (O[i] < lo[i] || O[i] > hi[i]) exit = -1; continue; }
      const a = (lo[i] - O[i]) / D[i], c = (hi[i] - O[i]) / D[i];
      enter = Math.max(enter, Math.min(a, c)); exit = Math.min(exit, Math.max(a, c));
    }
    if (enter <= exit && (best === null || enter < best)) best = enter;
  }
  return best;
}
// Distance along a ray to a capsule (segment a–b, radius r), or null. Close enough for aiming: the entry point is taken
// where the ray passes nearest the segment, stepped back by the radius.
export function capsuleHit(o, d, a, b, r) {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, w = { x: o.x - a.x, y: o.y - a.y, z: o.z - a.z };
  const dot = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z, A = dot(d, d), B = dot(d, u), C = dot(u, u), D = dot(d, w), E = dot(u, w), det = A * C - B * B;
  let s = det > 1e-9 ? (B * E - C * D) / det : 0, t = det > 1e-9 ? (A * E - B * D) / det : 0;
  t = Math.max(0, Math.min(1, t)); s = Math.max(0, (B * t - D) / A);
  const gap = Math.hypot(w.x + d.x * s - u.x * t, w.y + d.y * s - u.y * t, w.z + d.z * s - u.z * t);
  if (gap > r) return null;
  return Math.max(0, s - Math.sqrt(r * r - gap * gap));
}

// The kaiju's body for aiming, as capsules in its own frame (x to its right, y up, z forward; metres), following the
// model in kaijuScene.js (built at 1/10 scale): legs that swing as it walks, belly and chest, the plates on its back,
// neck, head, arms and a tail that curls up behind it and sways.
const SCALE = 10;
const rotX = (p, a) => ({ x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) });
const rotY = (p, a) => ({ x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y, z: p.z + q.z });
const scaled = p => ({ x: p.x * SCALE, y: p.y * SCALE, z: p.z * SCALE });
const FIXED = [
  { part: 'body', a: { x: 0, y: 54, z: 0 }, b: { x: 0, y: 106, z: 3 }, r: 18.5 },
  { part: 'body', a: { x: 0, y: 56, z: -13 }, b: { x: 0, y: 126, z: -9 }, r: 7 }, // dorsal plates
  { part: 'body', a: { x: 0, y: 112, z: 9 }, b: { x: 0, y: 126, z: 14 }, r: 10 }, // neck
  ...[-1, 1].map(side => ({ part: 'arm', a: { x: side * 17, y: 104, z: 13 }, b: { x: side * 16, y: 88, z: 27 }, r: 6 })),
];
// Its pose at `t` seconds into the event, with the attack moves the scene plays (seeded like the attacks themselves):
// leaning into a slam, twisting for a tail sweep, raising or dipping its head.
export function kaijuHitbox(t, seed = null) {
  const stride = (t < 104 ? t * 5 : 520 + (t - 104) * 2.5) / 22 * Math.PI, parts = [...FIXED];
  const attack = seed === null ? null : currentAttack(seed, t), wind = attack ? Math.min(1, (t - attack.start) / (attack.impact - attack.start)) : 0, live = attack && t >= attack.impact;
  const lean = attack?.type === 'slam' ? (live ? 0.35 : 0.2 * wind) : 0;
  const turn = attack?.type === 'tail' ? Math.sin(Math.min(1, (t - attack.start) / (attack.end - attack.start)) * Math.PI) * 0.9 : 0;
  const nod = { fire: live ? 0.25 : -0.3 * wind, laser: 0.2, roar: -0.55 * wind, meteors: -0.4 }[attack?.type] || 0;
  const head = p => scaled(add({ x: 0, y: 13.1, z: 2 }, rotX(p, nod)));
  parts.push({ part: 'head', a: head({ x: 0, y: 0.3, z: -0.2 }), b: head({ x: 0, y: 0.1, z: 2.2 }), r: 9.5 });
  for (const side of [-1, 1]) {
    const swing = Math.sin(stride + (side > 0 ? 0 : Math.PI)), hipAngle = swing * 0.35, kneeAngle = Math.max(0, -swing) * 0.5, hip = { x: side * 1.05, y: 5.2, z: 0 };
    const inHip = p => add(hip, rotX(p, hipAngle)), knee = inHip({ x: 0, y: -2.5, z: 0.2 }), inKnee = p => inHip(add({ x: 0, y: -2.5, z: 0.2 }, rotX(p, kneeAngle)));
    parts.push({ part: 'leg', a: scaled(hip), b: scaled(knee), r: 8.5 }, { part: 'leg', a: scaled(knee), b: scaled(inKnee({ x: 0, y: -2.2, z: 0.1 })), r: 6.5 },
      { part: 'leg', a: scaled(inKnee({ x: 0, y: -2.35, z: -0.6 })), b: scaled(inKnee({ x: 0, y: -2.35, z: 1.6 })), r: 4 });
  }
  // The tail: nine segments, each turned a little more than the one before (as the scene animates them).
  let at = { x: 0, y: 4.6, z: -1.8 }, yaw = 0, pitch = 0, size = 1.8;
  for (let k = 0; k < 9; k++) {
    if (k) at = add(at, rotY(rotX({ x: 0, y: -0.12, z: -1.35 }, pitch), yaw));
    yaw += Math.sin(t * 0.9 - k * 0.5) * 0.12 * (1 + k * 0.15); pitch += 0.05 + k * 0.01;
    const end = add(at, rotY(rotX({ x: 0, y: 0, z: -1.4 }, pitch), yaw));
    parts.push({ part: 'tail', a: scaled(at), b: scaled(end), r: size * 0.42 * SCALE });
    size *= 0.84;
  }
  // The whole body bobs and rolls a little with each step.
  const roll = Math.sin(stride) * 0.04, bob = Math.abs(Math.sin(stride)) * 0.25 * SCALE;
  const body = p => { const q = rotX(rotY({ x: p.x * Math.cos(roll) - p.y * Math.sin(roll), y: p.x * Math.sin(roll) + p.y * Math.cos(roll), z: p.z }, turn), lean); return { ...q, y: q.y + bob }; };
  return parts.map(c => ({ ...c, a: body(c.a), b: body(c.b) }));
}
// How high the kaiju stands `t` seconds into the event: it rises out of the sea over the first 40 seconds.
export const kaijuRise = t => -70 * (1 - Math.min(1, Math.max(0, t) / 40));
export function kaijuRayHit(o, d, t, pose = kaijuPose(t), seed = null) {
  const c = Math.cos(pose.heading), s = Math.sin(pose.heading), y0 = kaijuRise(t);
  const world = p => ({ x: pose.x + p.x * c + p.z * s, y: y0 + p.y, z: pose.z - p.x * s + p.z * c });
  let best = null;
  for (const part of kaijuHitbox(t, seed)) {
    const hit = capsuleHit(o, d, world(part.a), world(part.b), part.r * 1.1); // a little generous at the edges
    if (hit !== null && hit >= 0 && (!best || hit < best.distance)) best = { distance: hit, part: part.part };
  }
  return best && { ...best, x: o.x + d.x * best.distance, y: Math.max(0, o.y + d.y * best.distance), z: o.z + d.z * best.distance };
}

const FAR = 600;
// What the pointer is on. Returns { kind: 'kaiju' | 'person' | 'building' | 'ground' | 'sky', x, y, z, distance,
// target?, part? }; the point is where the shot is going.
export function aimFromRay(s, ray) {
  const { o, d } = ray, near = Math.max(0, (ray.near || 0) - 1.5);
  let best = { kind: 'sky', distance: FAR };
  const consider = (distance, hit) => { if (distance !== null && distance >= near && distance < best.distance) best = { distance, ...hit }; };
  if (s.boss?.alive) { const k = kaijuRayHit(o, d, s.boss.t, s.boss, s.bossEvent?.seed ?? null); if (k) consider(k.distance, { kind: 'kaiju', part: k.part }); }
  for (const e of [...(s.enemies || []), ...(s.pedestrians || [])]) {
    if (e.health <= 0 || e.child) continue;
    const h = e.height || 0, scale = e.look?.scale || 1;
    consider(capsuleHit(o, d, { x: e.x, y: h + 0.5, z: e.z }, { x: e.x, y: h + 2.1 * scale, z: e.z }, 0.8), { kind: 'person', target: e });
  }
  consider(blockHit(s.blocks || [], o, d, best.distance), { kind: 'building' });
  if (d.y < -1e-6) consider(-o.y / d.y, { kind: 'ground' });
  return { ...best, x: o.x + d.x * best.distance, y: Math.max(0, o.y + d.y * best.distance), z: o.z + d.z * best.distance };
}
// The direction (yaw) the player faces to aim along the ray: towards the ground point under the reticle, or along the
// ray when it points at the sky.
export function aimYawFrom(player, ray) {
  const { o, d } = ray, t = d.y < -0.02 ? -o.y / d.y : 300, x = o.x + d.x * t, z = o.z + d.z * t;
  return Math.hypot(x - player.x, z - player.z) > 1 ? Math.atan2(x - player.x, z - player.z) : Math.atan2(d.x, d.z);
}
