// Driving AI, road routes and character intents for World Tour. The simulation itself (vehicle dynamics, collisions,
// character movement, ragdolls) runs in Rapier through src/physicsEngine.js; these functions only decide what each
// actor wants to do: drivers produce throttle/brake/steer, characters produce a desired velocity.
export const ROAD_GRID = [-360, -240, -120, 0, 120, 240, 360];
export const length = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function vehicle(id, x, z, heading = 0, kind = 'traffic') {
  return { id, kind, x, z, heading, speed: 0, vx: 0, vz: 0, radius: 2.3, steer: 0, impact: 0, damage: 0, hitCooldown: 0, route: [], waypoint: 0, control: { brake: 1 } };
}
export function fits(x, z, blocks, radius = 1) {
  return Math.abs(x) < 440 - radius && Math.abs(z) < 440 - radius && !blocks.some(b => Math.abs(x - b.x) < b.width / 2 + radius && Math.abs(z - b.z) < b.depth / 2 + radius);
}
// Player driving: input becomes throttle, brake, steering and handbrake. Parked cars hold their brakes.
export function driveVehicle(car, input, dt) {
  const forward = car.speed || 0, steer = Number(!!input.left) - Number(!!input.right);
  let throttle = 0, brake = input.park ? 1 : 0;
  if (input.forward) { if (forward < -1) brake = 1; else throttle = 1; }
  if (input.backward) { if (forward > 1) brake = 1; else throttle = -1; }
  // Less steering lock at speed keeps fast driving stable.
  car.steer += (steer * 0.55 / (1 + Math.abs(forward) / 25) - car.steer) * (1 - Math.exp(-9 * dt));
  car.control = { throttle, brake, steer: car.steer, handbrake: !!input.brake || !!input.park };
}
// AI driving: a speed controller for throttle/brake and a heading controller for steering.
function driveToward(car, targetSpeed, heading, dt) {
  const forward = car.speed || 0, turn = angleDelta(heading, car.heading), reversing = targetSpeed < 0;
  car.steer += (clamp((reversing ? -turn : turn) * 1.5, -0.6, 0.6) - car.steer) * (1 - Math.exp(-10 * dt));
  const error = targetSpeed - forward;
  let throttle = 0, brake = 0;
  if (reversing) { if (forward > 0.5) brake = 1; else throttle = clamp(error * 0.4, -1, 0); }
  else if (forward < -0.5) brake = 1;
  else if (error > 0) throttle = clamp(error * 0.4, 0, 1);
  else if (error < -0.5) brake = clamp(-error * 0.25, 0, 1);
  if (targetSpeed === 0 && Math.abs(forward) < 1) brake = 1;
  car.control = { throttle, brake, steer: car.steer, handbrake: false };
}
const nearest = value => ROAD_GRID.reduce((best, n) => Math.abs(value - n) < Math.abs(value - best) ? n : best, 0);
function roadAnchor(point) {
  const x = nearest(point.x), z = nearest(point.z);
  return { node: { x, z }, projection: Math.abs(point.x - x) < Math.abs(point.z - z) ? { x, z: point.z } : { x: point.x, z } };
}
export function roadRoute(from, to) {
  const a = roadAnchor(from), b = roadAnchor(to);
  const sameVertical = a.projection.x === b.projection.x && ROAD_GRID.includes(a.projection.x);
  const sameHorizontal = a.projection.z === b.projection.z && ROAD_GRID.includes(a.projection.z);
  const points = sameVertical || sameHorizontal ? [a.projection, b.projection] : [a.projection, a.node, { x: b.node.x, z: a.node.z }, b.node, b.projection];
  const route = points.filter((point, index) => length(point, index ? points[index - 1] : from) > 1);
  // A car already driving in a lane should not swerve to the centre line or turn back to a point behind it.
  if (route.length > 1) {
    const [first, second] = route, behind = (first.x - from.x) * (second.x - first.x) + (first.z - from.z) * (second.z - first.z) < 0;
    if (length(from, first) < 6 || (behind && length(from, first) < 20)) route.shift();
  }
  return route;
}
// Loops are offset to the right of travel, so neighbouring loops never share a lane head-on.
function laneLoop(nodes, offset = 4) {
  return nodes.map((node, i) => {
    const before = nodes[(i + nodes.length - 1) % nodes.length], after = nodes[(i + 1) % nodes.length];
    const right = (a, b) => { const d = length(a, b) || 1; return { x: -(b.z - a.z) / d, z: (b.x - a.x) / d }; };
    const r1 = right(before, node), r2 = right(node, after);
    return { x: node.x + (r1.x + r2.x) * offset, z: node.z + (r1.z + r2.z) * offset };
  });
}
export function createTraffic(count = 18) {
  return Array.from({ length: count }, (_, i) => {
    const col = i % 6, row = Math.floor(i / 6) * 2 % 6, x = ROAD_GRID[col], z = ROAD_GRID[row];
    const route = laneLoop([{ x, z }, { x, z: z + 120 }, { x: x + 120, z: z + 120 }, { x: x + 120, z }]);
    const start = i % 4, car = vehicle('traffic-' + i, route[start].x, route[start].z);
    car.route = route; car.waypoint = (start + 1) % 4; car.loop = true;
    car.heading = Math.atan2(route[car.waypoint].x - car.x, route[car.waypoint].z - car.z);
    return car;
  });
}
// Patrol loops start and end at the base intersection, driving in the same right-hand lanes as traffic.
export function patrolRoute({ x, z }) {
  const route = laneLoop([{ x, z }, { x, z: z + 120 }, { x: x + 120, z: z + 120 }, { x: x + 120, z }]);
  return [...route.slice(1), route[0]];
}
export function createPatrols() {
  return [[0, -240], [240, 0], [-240, 120]].map(([x, z], i) => {
    const base = { x, z }, route = patrolRoute(base), start = route[route.length - 1];
    return { ...vehicle('patrol-' + i, start.x, start.z, 0, 'police'), state: 'patrol', base: { ...start }, home: base, route, loop: true, replan: 0, deployed: false };
  });
}
// `hazards` may be one pedestrian, a list of pedestrians, or null. `car.ignore` lets a pursuing car close on its suspect.
export function steerVehicle(car, cars, hazards, dt, desiredSpeed = 13) {
  if (car.detour && length(car, car.detour) < 3.5) { car.detour = null; car.detourAround = null; }
  let target = car.route[car.waypoint];
  if (target && length(car, target) < 3.5) { car.waypoint++; if (car.loop) car.waypoint %= car.route.length; target = car.route[car.waypoint]; }
  if (target && car.detour) target = car.detour;
  if (car.reverse > 0) {
    // Unstick: back away from the obstacle while turning toward the next waypoint.
    car.reverse -= dt;
    driveToward(car, -7, target ? Math.atan2(target.x - car.x, target.z - car.z) : car.heading, dt);
    return;
  }
  let speed = target ? desiredSpeed : 0;
  let desiredHeading = target ? Math.atan2(target.x - car.x, target.z - car.z) : car.heading;
  const turn = angleDelta(desiredHeading, car.heading);
  speed *= Math.max(0.15, 1 - Math.abs(turn) / Math.PI);
  // Brake ahead of a sharp corner so fast cars do not overshoot the next road.
  const next = car.detour ? null : car.route[car.waypoint + 1] ?? (car.loop ? car.route[(car.waypoint + 1) % car.route.length] : null);
  if (target && next) {
    const corner = Math.abs(angleDelta(Math.atan2(next.x - target.x, next.z - target.z), desiredHeading));
    if (corner > 0.5) speed = Math.min(speed, Math.sqrt((4 + (Math.PI - corner) * 3) ** 2 + 16 * length(car, target)));
  }
  if (target && !car.loop && !car.chasing && !car.detour && car.waypoint === car.route.length - 1) speed = Math.min(speed, Math.sqrt(8 * length(car, target)));
  // Creep around a stationary blocker; a real car has to roll forward to turn.
  if (car.detour) speed = Math.min(speed, 6);
  const wanted = speed, moving = Math.hypot(car.vx, car.vz);
  const stopping = 7 + moving ** 2 / 12;
  const extra = Array.isArray(hazards) ? hazards : hazards ? [hazards] : [];
  let blocker = null;
  for (const list of [cars, extra]) for (const other of list) {
    if (other === car || other === car.ignore || other === car.detourAround) continue;
    const dx = other.x - car.x, dz = other.z - car.z, ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading), across = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    if (ahead > 0 && ahead < stopping && across < car.radius + (other.radius || 0.8)) {
      const limit = Math.max(0, (ahead - 6) * 0.8);
      if (limit < speed) { speed = limit; blocker = other; }
    }
  }
  // Waiting behind something that is not moving (a parked car, a stalled head-on car, someone standing in the road):
  // after a few seconds, pass it on the left instead of waiting forever.
  const stationary = blocker && Math.hypot(blocker.vx || 0, blocker.vz || 0) < 0.5;
  car.waiting = stationary && speed < 0.5 && wanted > 3 ? (car.waiting || 0) + dt : 0;
  if (car.waiting > 4) {
    const lx = Math.cos(car.heading), lz = -Math.sin(car.heading), reach = (blocker.radius || 0.8) + 1;
    car.detour = { x: blocker.x + lx * 5.5 + Math.sin(car.heading) * reach, z: blocker.z + lz * 5.5 + Math.cos(car.heading) * reach };
    car.detourAround = blocker; car.waiting = 0;
  }
  // A car that wants to move, is not yielding, yet barely moves is wedged against something.
  car.stuck = wanted > 3 && speed > wanted - 0.5 && moving < 1.2 ? (car.stuck || 0) + dt : 0;
  if (car.stuck > 1.6) { car.stuck = 0; car.reverse = 1.1; }
  driveToward(car, speed, desiredHeading, dt);
}
export function pushCharacter(person, dx, dz, strength, lift = 0) {
  const d = Math.hypot(dx, dz) || 1;
  person.kickX = (person.kickX || 0) + dx / d * strength; person.kickZ = (person.kickZ || 0) + dz / d * strength;
  person.flinch = 0.35;
  if (lift) person.vy = Math.max(person.vy || 0, lift);
}
// Deterministic session random numbers (same generator as the seeded city layout).
export function random(s) { s.seed = ((s.seed ?? 1) * 1664525 + 1013904223) >>> 0; return s.seed / 4294967296; }
// Updates a character's intended velocity (walking plus knockback) and timers; Rapier moves the body.
export function stepCharacterBody(person, dx, dz, dt) {
  const blend = 1 - Math.exp(-12 * dt);
  person.moveX = (person.moveX || 0) + (dx - (person.moveX || 0)) * blend;
  person.moveZ = (person.moveZ || 0) + (dz - (person.moveZ || 0)) * blend;
  person.vx = person.moveX + (person.kickX || 0); person.vz = person.moveZ + (person.kickZ || 0);
  person.kickX = (person.kickX || 0) * Math.exp(-5 * dt); person.kickZ = (person.kickZ || 0) * Math.exp(-5 * dt);
  person.flinch = Math.max(0, (person.flinch || 0) - dt); person.speed = Math.hypot(person.moveX, person.moveZ);
  // NPC vertical velocity (hops, blows); the physics step integrates it and clears it on landing.
  if (person.vy > 0 || person.height > 0) person.vy = (person.vy || 0) - 22 * dt;
  if (person.knockdown > 0) person.knockdown = Math.max(0, person.knockdown - dt);
  if (person.health <= 0 || person.knockdown > 0) { person.fallVelocity = (person.fallVelocity || 0) + 7 * dt; person.fall = Math.min(Math.PI / 2, (person.fall || 0) + person.fallVelocity * dt); }
  else if (person.fall) { person.fall = Math.max(0, person.fall - 2.4 * dt); person.fallVelocity = 0; }
}
