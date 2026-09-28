import { blockHit } from './aiming.js';
import { islandFor } from './worldIsland.js';
import { random } from './worldPhysics.js';
import { helicoptersFor, starsOf } from './wanted.js';

// Police helicopters. At four stars one joins the pursuit, at five a second one, with marksmen aboard. A helicopter
// flies in from beyond the city, circles overhead while it can see you (searchlight on you), and searches a widening
// circle around where you were last seen when it cannot. It sees you within HELI.sight metres unless tall buildings
// are in the way or you are under trees, and it is slower than a fast car, so you can outdrive it, lose it among the
// towers or hide in a forest. When the stars fade (or you are busted or wasted) the helicopters fly home.
export const HELI = Object.freeze({ speed: 34, climb: 9, altitude: 44, approach: 80, sight: 90, orbit: 24, spawnAt: 460, leaveAt: 800, accel: 14 });
const canopy = t => (t.kind === 'pine' ? 3.6 : t.kind === 'broad' ? 4.6 : 5.5) * (t.scale || 1);

// Under a tree canopy, hidden from the air.
export function underCover(s, at) {
  return islandFor(s.city).treesAround(at.x, at.z, 10).some(t => Math.hypot(t.x - at.x, t.z - at.z) < canopy(t) * 0.9);
}
// Can this helicopter see the suspect at `at` (a person or the car they drive)?
export function heliSees(s, heli, at) {
  if (Math.hypot(at.x - heli.x, at.z - heli.z) > HELI.sight || underCover(s, at)) return false;
  const target = { x: at.x, y: (at.height || 0) + 1.5, z: at.z }, v = { x: target.x - heli.x, y: target.y - heli.y, z: target.z - heli.z }, len = Math.hypot(v.x, v.y, v.z) || 1;
  return blockHit(s.blocks || [], heli, { x: v.x / len, y: v.y / len, z: v.z / len }, len - 1) === null;
}
function spawn(s, at) {
  const a = random(s) * Math.PI * 2;
  s.heliSeq = (s.heliSeq || 0) + 1;
  return { id: 'heli-' + s.heliSeq, x: at.x + Math.sin(a) * HELI.spawnAt, y: 110, z: at.z + Math.cos(a) * HELI.spawnAt, vx: 0, vy: 0, vz: 0, heading: a + Math.PI, state: 'pursuit', orbit: random(s) * 6, search: random(s) * 6, cooldown: 3, spotting: false, light: null };
}
// Move toward a point at up to `speed`, easing in, and settle at `altitude`.
function fly(h, aim, altitude, speed, dt) {
  const dx = aim.x - h.x, dz = aim.z - h.z, d = Math.hypot(dx, dz), want = Math.min(speed, d * 0.9);
  const tx = d > 0.01 ? dx / d * want : 0, tz = d > 0.01 ? dz / d * want : 0, k = Math.min(1, HELI.accel * dt / Math.max(1, Math.hypot(tx - h.vx, tz - h.vz)));
  h.vx += (tx - h.vx) * k; h.vz += (tz - h.vz) * k;
  h.vy = Math.max(-HELI.climb, Math.min(HELI.climb, (altitude - h.y) * 0.8));
  h.x += h.vx * dt; h.z += h.vz * dt; h.y += h.vy * dt;
}
// Radio sightings guide the aircraft, not the beam. Sweep nearby ground until this aircraft sees the player itself.
function searchlight(h, at, dt) {
  const target = h.spotting ? at : { x: h.x + Math.sin(h.heading) * 20 + Math.cos(h.search) * 12, z: h.z + Math.cos(h.heading) * 20 + Math.sin(h.search) * 12 };
  h.light ||= { x: h.x, z: h.z };
  const blend = 1 - Math.exp(-2 * dt);
  h.light.x += (target.x - h.light.x) * blend; h.light.z += (target.z - h.light.z) * blend;
  const dx = h.light.x - h.x, dz = h.light.z - h.z, d = Math.hypot(dx, dz);
  if (d > HELI.sight) { h.light.x = h.x + dx / d * HELI.sight; h.light.z = h.z + dz / d * HELI.sight; }
}

// News coverage arrives separately at five stars. It never spots for police or fires at the player.
function updateNews(s, at, dt) {
  const wanted = starsOf(s.heat) >= 5 && !s.down;
  s.newsDelay = wanted ? (s.newsDelay ?? 7) - dt : 7;
  if (wanted && !s.newsHelicopter && s.newsDelay <= 0) s.newsHelicopter = { ...spawn(s, at), id: 'news-chase', livery: 'news' };
  const h = s.newsHelicopter; if (!h) return;
  if (!wanted) h.state = 'leaving';
  if (h.state === 'leaving') {
    const dx = h.x - at.x, dz = h.z - at.z, d = Math.hypot(dx, dz) || 1;
    fly(h, { x: h.x + dx / d * 200, z: h.z + dz / d * 200 }, 150, HELI.speed, dt);
    h.spotting = false; h.light = null;
    if (d > HELI.leaveAt) s.newsHelicopter = null;
  } else {
    h.spotting = heliSees(s, h, at); h.orbit += dt * 0.25; h.search += dt * 0.35;
    const last = h.spotting ? at : s.lastSeen || at;
    const aim = { x: last.x + Math.cos(h.orbit) * 50, z: last.z + Math.sin(h.orbit) * 50 };
    fly(h, aim, 85, HELI.speed, dt); searchlight(h, at, dt);
  }
  if (Math.hypot(h.vx, h.vz) > 3) h.heading = Math.atan2(h.vx, h.vz);
}
// One step for every police helicopter. `at` is where the suspect is (on foot or their car); `hurt(amount)` applies a
// marksman's hit. Returns whether any helicopter can see the suspect now.
export function updateHelicopters(s, at, dt, { hurt } = {}) {
  s.helicopters ||= [];
  const want = helicoptersFor(s.heat, s.crew), active = s.helicopters.filter(h => h.state !== 'leaving');
  s.heliDelay = (s.heliDelay ?? 3) - dt;
  if (active.length < want && s.heliDelay <= 0) { s.helicopters.push(spawn(s, at)); s.heliDelay = 8; }
  for (const h of active.slice(want)) h.state = 'leaving';
  if (!want) s.heliDelay = 3;
  const marksmen = starsOf(s.heat) >= 5 && !(s.down > 0);
  let sees = false;
  for (const h of s.helicopters) {
    if (h.state === 'leaving') {
      // Home: away from the suspect, climbing.
      const dx = h.x - at.x, dz = h.z - at.z, d = Math.hypot(dx, dz) || 1;
      fly(h, { x: h.x + dx / d * 200, z: h.z + dz / d * 200 }, 140, HELI.speed * 1.2, dt);
      h.spotting = false; h.light = null;
      if (d > HELI.leaveAt) h.gone = true;
    } else {
      h.spotting = heliSees(s, h, at); sees ||= h.spotting;
      const tracking = h.spotting || (s.unseen ?? 99) < 3, last = s.lastSeen || at;
      let aim;
      if (tracking) {
        // Circle above the suspect, leading a moving car a little.
        h.orbit += dt * 0.45;
        const lead = { x: at.x + (at.vx || 0) * 0.8, z: at.z + (at.vz || 0) * 0.8 };
        aim = { x: lead.x + Math.cos(h.orbit) * HELI.orbit, z: lead.z + Math.sin(h.orbit) * HELI.orbit };
      } else {
        // Search a widening circle around the last sighting.
        h.search += dt * 0.35;
        const r = Math.min(160, 40 + (s.unseen || 0) * 3);
        aim = { x: last.x + Math.cos(h.search) * r, z: last.z + Math.sin(h.search) * r };
      }
      const far = Math.hypot(aim.x - h.x, aim.z - h.z) > 150;
      fly(h, aim, far ? HELI.approach : HELI.altitude, HELI.speed, dt);
      searchlight(h, at, dt);
      if (marksmen && h.spotting) {
        h.cooldown -= dt;
        if (h.cooldown <= 0) {
          h.cooldown = 1.4 + random(s) * 0.8;
          const moving = Math.min(1, Math.hypot(at.vx || 0, at.vz || 0) / 25), hit = random(s) < 0.6 - moving * 0.4;
          const miss = hit ? 0 : 2 + random(s) * 3, a = random(s) * Math.PI * 2;
          s.shots.push({ x: h.x, y: h.y - 1.5, z: h.z, tx: at.x + Math.cos(a) * miss, ty: hit ? (at.height || 0) + 1.4 : 0.2, tz: at.z + Math.sin(a) * miss, ttl: 0.14, police: true });
          if (hit) hurt?.(7);
        }
      }
    }
    const moving = Math.hypot(h.vx, h.vz);
    if (moving > 3) h.heading = Math.atan2(h.vx, h.vz);
    else if (h.state !== 'leaving') h.heading = Math.atan2(at.x - h.x, at.z - h.z);
  }
  s.helicopters = s.helicopters.filter(h => !h.gone);
  updateNews(s, at, dt);
  return sees;
}
