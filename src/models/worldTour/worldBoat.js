// Your speedboat: moored at the marina pier on the east waterfront, it takes you round your island and across the open
// sea to the others. Boats are simple displacement craft (thrust, drag, rudder that bites with speed) on a flat sea;
// they cannot run onto land or through the pier. Heading uses the game's convention, atan2(dx, dz).
import { MARINA } from './worldIsland.js';
import { inputAxes } from './worldPhysics.js';

export const BOAT = Object.freeze({ radius: 3.2, thrust: 12, reverse: 5, drag: 0.42, top: 28, turn: 0.95 });
export function createBoat(at = MARINA.mooring) { return { id: 'boat', kind: 'boat', x: at.x, z: at.z, heading: at.heading, speed: 0, vx: 0, vz: 0, steer: 0, impact: 0 }; }
const onPier = (x, z, margin) => x > MARINA.x0 - margin - 4 && x < MARINA.x1 + margin && Math.abs(z - MARINA.z) < MARINA.width / 2 + margin;
// Open water: beyond the island's waterline and clear of the pier.
export function inWater(island, x, z, radius = BOAT.radius) {
  return !onPier(x, z, radius) && Math.hypot(x, z) > island.coastRadius(Math.atan2(z, x)) + radius - 2;
}
export function stepBoat(boat, island, input, dt) {
  const throttle = (input.forward ? 1 : 0) - (input.backward ? 1 : 0), steer = -inputAxes(input).right;
  const push = throttle > 0 ? BOAT.thrust * (input.run ? 1.25 : 1) : throttle < 0 ? -BOAT.reverse : 0;
  boat.speed += (push - boat.speed * BOAT.drag * (throttle ? 1 : 2.2)) * dt;
  boat.speed = Math.max(-8, Math.min(BOAT.top * (input.run ? 1.2 : 1), boat.speed));
  boat.steer += (steer - boat.steer) * (1 - Math.exp(-5 * dt));
  boat.heading += boat.steer * BOAT.turn * Math.min(1, Math.abs(boat.speed) / 7) * Math.sign(boat.speed || 1) * dt;
  const x = boat.x + Math.sin(boat.heading) * boat.speed * dt, z = boat.z + Math.cos(boat.heading) * boat.speed * dt;
  if (inWater(island, x, z)) { boat.x = x; boat.z = z; }
  else { boat.impact = Math.min(1, Math.abs(boat.speed) / 12); boat.speed *= -0.25; }
  boat.impact = Math.max(0, boat.impact - dt * 2);
  boat.vx = Math.sin(boat.heading) * boat.speed; boat.vz = Math.cos(boat.heading) * boat.speed;
}
// Where you step off: onto the pier if you are alongside it, otherwise the nearest beach within reach.
export function landingSpot(boat, island, isFree) {
  if (onPier(boat.x, boat.z, 12)) return { x: Math.max(MARINA.x0 + 2, Math.min(MARINA.x1 - 2, boat.x)), z: MARINA.z };
  const toward = Math.atan2(-boat.x, -boat.z);
  for (let d = 4; d <= 40; d += 2) for (const spread of [0, 0.35, -0.35, 0.7, -0.7]) {
    const x = boat.x + Math.sin(toward + spread) * d, z = boat.z + Math.cos(toward + spread) * d;
    if (island.onIsland(x, z, 1.5) && island.terrainHeight(x, z) === 0 && isFree(x, z)) return { x, z };
  }
  return null;
}

// ---- Sea voyages. The bearing between islands follows the world map; the crossing length grows with distance.
const chart = city => ({ x: city.map[0] * 10, z: city.map[1] * 4.4 });
export function voyage(from, to) {
  if (!from || !to || from.id === to.id) return null;
  const a = chart(from), b = chart(to), distance = Math.hypot(b.x - a.x, b.z - a.z);
  const total = Math.round(Math.max(900, Math.min(2400, distance * 3)) / 10) * 10;
  return { to: to.id, name: to.name, bearing: Math.atan2(b.x - a.x, b.z - a.z), total, remaining: total };
}
// Progress a voyage: it only counts once you are out in open sea and heading roughly along the bearing.
export function stepVoyage(course, boat, island, dt) {
  const out = Math.hypot(boat.x, boat.z) > island.seaLine;
  const align = Math.cos(Math.atan2(Math.sin(boat.heading - course.bearing), Math.cos(boat.heading - course.bearing)));
  course.openSea = out; course.onCourse = align > 0.5;
  if (out && align > 0.3 && boat.speed > 3) course.remaining = Math.max(0, course.remaining - boat.speed * align * dt);
  return course.remaining <= 0;
}
// Arriving by sea: offshore east of the new island, heading for its marina.
export const ARRIVAL = Object.freeze({ x: 1050, z: MARINA.z, heading: -Math.PI / 2 });
