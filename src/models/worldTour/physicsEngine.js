import RAPIER from '@dimforge/rapier3d-compat';
import { RAGDOLLS } from './ragdollProfiles.js';
import { sceneryLayout } from './worldLayout.js';
import { ISLAND_EXTENT, MARINA, SHORE_INSET, formSurface, islandFor, lakeShore } from './worldIsland.js';
import { STATIONS, metroPillars } from './metro.js';

// Rapier (https://rapier.rs) runs World Tour's rigid bodies, vehicles, character movement, ragdolls and bullet rays.
// Gameplay code keeps plain session objects (x, z, vx, vz, heading...) as its source of truth: each substep this module
// pushes their intents/controls into Rapier, steps the world and writes the results back. When gameplay moves an actor
// directly (spawn, recovery, deployment, tests), the change is detected and synchronised into the body.
await RAPIER.init();

export const GRAVITY = 18;
const GROUP = { GROUND: 1, STATIC: 2, VEHICLE: 4, CHARACTER: 8, RAGDOLL: 16, PROP: 32, QUERY: 64 };
const ALL = 0xffff;
const groups = (member, filter) => (member << 16) | filter;
const SOLID = GROUP.GROUND | GROUP.STATIC | GROUP.PROP;
const WHEEL_RAYS = groups(GROUP.VEHICLE, GROUP.GROUND | GROUP.STATIC);
const CHARACTER_QUERY = groups(GROUP.CHARACTER, SOLID);
const SHOT_QUERY = groups(GROUP.QUERY, SOLID | GROUP.VEHICLE | GROUP.RAGDOLL);
const CHARACTER_FLAGS = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;

// Per-kind handling. Accelerations are in units/s²; forces are derived from mass.
export const VEHICLE_SPECS = {
  player: { scale: 1.7, mass: 1450, engine: 18, top: 55, reverse: 16, brake: 30, grip: 1.8, steer: 0.55 },
  police: { scale: 1.7, mass: 1600, engine: 16, top: 46, reverse: 14, brake: 30, grip: 1.9, steer: 0.55 },
  traffic: { scale: 1.5, mass: 1250, engine: 10, top: 30, reverse: 10, brake: 26, grip: 1.7, steer: 0.6 },
};
// Suspension force scales with chassis mass in Rapier's raycast vehicle, so static sag is gravity / (4 * stiffness).
const SUSPENSION = { rest: 0.3, travel: 0.22, stiffness: 120, compression: 9.9, relaxation: 12.8, static: GRAVITY / 480 };
const MAX_ACTIVE_RAGDOLLS = 12;

const worlds = new WeakMap();
const release = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(world => { try { world.free(); } catch { /* already freed */ } }) : null;
const yaw = heading => ({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) });
function rotate(q, v) {
  const { x, y, z, w } = q, ix = w * v.x + y * v.z - z * v.y, iy = w * v.y + z * v.x - x * v.z, iz = w * v.z + x * v.y - y * v.x, iw = -x * v.x - y * v.y - z * v.z;
  return { x: ix * w + iw * -x + iy * -z - iz * -y, y: iy * w + iw * -y + iz * -x - ix * -z, z: iz * w + iw * -z + ix * -y - iy * -x };
}
const multiply = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });

export function vehicleSpec(car) { return VEHICLE_SPECS[car.kind === 'player' ? 'player' : car.kind === 'police' ? 'police' : 'traffic']; }
// Chassis-space wheel layout matching src/car.js: order (-x,-z), (-x,+z), (+x,-z), (+x,+z); +z wheels steer, -z wheels drive.
export function wheelLayout(scale) {
  const radius = 0.34 * scale, y = radius + SUSPENSION.rest - SUSPENSION.static;
  return { radius, y, wheels: [-1, 1].flatMap(x => [-1, 1].map(z => ({ x: 0.73 * scale * x, y, z: 0.72 * scale * z, front: z > 0 }))) };
}

function createWorld(s) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.numSolverIterations = 6;
  const P = { world, events: new RAPIER.EventQueue(true), entries: new Map(), byCollider: new Map(), statics: null, props: [], ragdolls: [] };
  P.kcc = world.createCharacterController(0.04);
  P.kcc.setSlideEnabled(true); P.kcc.enableSnapToGround(0.4); P.kcc.setMaxSlopeClimbAngle(0.8); P.kcc.setApplyImpulsesToDynamicBodies(false);
  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(ISLAND_EXTENT, 1, ISLAND_EXTENT).setTranslation(0, -1, 0).setFriction(0.9).setCollisionGroups(groups(GROUP.GROUND, ALL)), fixed);
  buildIslandColliders(world, fixed, islandFor(s.city));
  const { posts, trees, spots } = sceneryLayout();
  // Stall carts and bus-shelter panels are solid; benches are not, so people can sit on them.
  for (const spot of spots) for (const prop of spot.props) if (prop.collider)
    world.createCollider(RAPIER.ColliderDesc.cuboid(prop.size[0] / 2, prop.height / 2, prop.size[1] / 2).setTranslation(prop.x, prop.y, prop.z).setCollisionGroups(groups(GROUP.PROP, ALL)), fixed);
  for (const tree of trees) world.createCollider(RAPIER.ColliderDesc.cylinder(tree.height / 2, tree.radius).setTranslation(tree.x, tree.height / 2, tree.z).setCollisionGroups(groups(GROUP.PROP, ALL)), fixed);
  // Lamp posts stay fixed until a hard vehicle impact knocks them over.
  s.props = posts.map(post => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(post.x, 4, post.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.cylinder(4, 0.2).setDensity(40).setCollisionGroups(groups(GROUP.PROP, ALL)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(1), body);
    const prop = { id: post.id, kind: 'post', x: post.x, y: 4, z: post.z, q: [0, 0, 0, 1], fallen: false };
    const entry = { kind: 'prop', owner: prop, body, collider };
    P.props.push(entry); P.byCollider.set(collider.handle, entry);
    return prop;
  });
  worlds.set(s, P); release?.register(s, world, P);
  return P;
}
// Everything solid on the island (worldIsland.js): shoreline walls (open where the marina pier runs out to sea),
// landforms as convex hulls of their surface, lake shores, trees, boulders, logs, buildings and lamp posts; plus the
// metro's pillars and station stairs in the city (metro.js).
function buildIslandColliders(world, fixed, island) {
  const box = (x, y, z, hx, hy, hz, heading = 0, group = GROUP.STATIC) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(yaw(heading)).setCollisionGroups(groups(group, ALL)), fixed);
  const wall = (a, b, half = 3, height = 80, base = 0) => { const length = Math.hypot(b.x - a.x, b.z - a.z); box((a.x + b.x) / 2, base + height / 2, (a.z + b.z) / 2, half, height / 2, length / 2 + 0.2, Math.atan2(b.x - a.x, b.z - a.z)); };
  const shore = island.coastline(180, SHORE_INSET - 3), pier = p => p.x > 400 && Math.abs(p.z - MARINA.z) < 24;
  const gap = [];
  shore.forEach((a, i) => { const b = shore[(i + 1) % shore.length]; if (pier(a) && pier(b)) gap.push(a, b); else wall(a, b); });
  if (gap.length) {
    // Close the shoreline around the pier: shore to pier on both sides, then both sides and the end of the pier.
    const north = gap.reduce((m, p) => p.z < m.z ? p : m), south = gap.reduce((m, p) => p.z > m.z ? p : m), half = MARINA.width / 2;
    wall(north, { x: north.x, z: MARINA.z - half - 3 }); wall({ x: south.x, z: MARINA.z + half + 3 }, south);
    wall({ x: north.x, z: MARINA.z - half - 3 }, { x: MARINA.x1 + 3, z: MARINA.z - half - 3 }); wall({ x: south.x, z: MARINA.z + half + 3 }, { x: MARINA.x1 + 3, z: MARINA.z + half + 3 });
    wall({ x: MARINA.x1 + 3, z: MARINA.z - half - 3 }, { x: MARINA.x1 + 3, z: MARINA.z + half + 3 });
  }
  for (const form of island.forms) {
    const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(formSurface(form, 8, 20).flat().flatMap(p => [p.x, p.y, p.z])));
    if (hull) world.createCollider(hull.setFriction(0.9).setCollisionGroups(groups(GROUP.STATIC, ALL)), fixed);
  }
  for (const lake of island.lakes) { const edge = lakeShore(lake, 48, 1); edge.forEach((a, i) => wall(a, edge[(i + 1) % edge.length], 1.5, 12)); }
  for (const tree of island.trees) world.createCollider(RAPIER.ColliderDesc.cylinder(tree.height / 2, tree.radius * tree.scale).setTranslation(tree.x, tree.y + tree.height / 2, tree.z).setCollisionGroups(groups(GROUP.PROP, ALL)), fixed);
  for (const rock of island.rocks) if (rock.solid) world.createCollider(RAPIER.ColliderDesc.ball(Math.min(rock.sx, rock.sz) * 0.8).setTranslation(rock.x, rock.y + rock.sy * 0.25, rock.z).setFriction(0.8).setCollisionGroups(groups(GROUP.STATIC, ALL)), fixed);
  for (const log of island.logs) box(log.x, log.radius, log.z, log.radius, log.radius, log.length / 2, log.heading, GROUP.PROP);
  for (const s of island.structures) if (s.solid) box(s.x, s.y + s.h / 2, s.z, s.w / 2, s.h / 2, s.d / 2, s.turn);
  for (const f of island.fields) {
    if (f.kind === 'paddy') continue;
    const w = f.width / 2 + 2, d = f.depth / 2 + 2, c = (x, z) => ({ x: f.x + x, z: f.z + z });
    for (const [a, b] of [[c(-w, d), c(w, d)], [c(-w, -d), c(-w, d)], [c(w, -d), c(w, d)], [c(-w, -d), c(-6, -d)], [c(6, -d), c(w, -d)]]) wall(a, b, f.kind === 'hedged' ? 0.8 : 0.15, f.kind === 'hedged' ? 1.8 : 1.3);
  }
  for (const lamp of island.lamps) world.createCollider(RAPIER.ColliderDesc.cylinder(4, 0.2).setTranslation(lamp.x, 4, lamp.z).setCollisionGroups(groups(GROUP.PROP, ALL)), fixed);
  const { lighthouse } = island.landmarks;
  world.createCollider(RAPIER.ColliderDesc.cylinder(lighthouse.height / 2, lighthouse.radius).setTranslation(lighthouse.x, lighthouse.height / 2, lighthouse.z).setCollisionGroups(groups(GROUP.STATIC, ALL)), fixed);
  for (const p of metroPillars()) world.createCollider(RAPIER.ColliderDesc.cylinder(4.5, 0.75).setTranslation(p.x, 4.5, p.z).setCollisionGroups(groups(GROUP.STATIC, ALL)), fixed);
  for (const st of STATIONS) { const across = st.z === 0 ? 'z' : 'x'; for (const side of [-1, 1]) box(st.x + (across === 'x' ? side * 16 : 0), 4.5, st.z + (across === 'z' ? side * 16 : 0), across === 'x' ? 1.5 : 3, 4.5, across === 'x' ? 3 : 1.5); }
}
// The kaiju during a world-boss event: a kinematic body (legs and torso) that walks its path. Cars and traffic crash
// into it; characters are shoved clear by the gameplay rules (worldBoss.js), since the character controller ignores
// kinematic bodies.
function syncKaiju(P, boss) {
  if (!boss) { if (P.kaiju) { P.world.removeRigidBody(P.kaiju); P.kaiju = null; } return; }
  if (!P.kaiju) {
    P.kaiju = P.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(boss.x, 0, boss.z).setRotation(yaw(boss.heading)));
    const part = desc => P.world.createCollider(desc.setCollisionGroups(groups(GROUP.STATIC, ALL)).setFriction(0.8), P.kaiju);
    for (const side of [-1, 1]) part(RAPIER.ColliderDesc.cylinder(26, 7.5).setTranslation(side * 9, 26, 0));
    part(RAPIER.ColliderDesc.ball(22).setTranslation(0, 74, -4)); part(RAPIER.ColliderDesc.cylinder(14, 10).setTranslation(0, 40, -30));
  }
  P.kaiju.setNextKinematicTranslation({ x: boss.x, y: boss.alive ? 0 : -Math.min(60, boss.dying * 3), z: boss.z });
  P.kaiju.setNextKinematicRotation(yaw(boss.heading));
}
export function physicsFor(s) { return worlds.get(s) || createWorld(s); }
export function disposePhysics(s) {
  const P = worlds.get(s); if (!P) return;
  release?.unregister(P); worlds.delete(s);
  try { P.world.free(); } catch { /* already freed */ }
}

// Building colliders follow the session's block list; replacing `s.blocks` rebuilds them.
function syncStatics(P, blocks) {
  if (P.statics?.blocks === blocks) return;
  if (P.statics) P.world.removeRigidBody(P.statics.body);
  const body = P.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  for (const b of blocks) {
    const height = b.height ?? 200;
    P.world.createCollider(RAPIER.ColliderDesc.cuboid(b.width / 2, height / 2, b.depth / 2).setTranslation(b.x, height / 2, b.z).setFriction(0.6).setCollisionGroups(groups(GROUP.STATIC, ALL)), body);
  }
  // Rapier only refreshes its query structure during step(); until then rays also test these boxes directly.
  P.statics = { blocks, body, fresh: true };
}

// ---------------------------------------------------------------- vehicles
function createVehicle(P, car) {
  const spec = vehicleSpec(car), s = spec.scale, { world } = P;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(car.x, car.y ?? 0, car.z).setRotation(yaw(car.heading || 0)).setLinvel(car.vx || 0, 0, car.vz || 0).setLinearDamping(0.05).setAngularDamping(0.8).setCcdEnabled(true));
  const [w, h, l] = [1.4 * s, 0.9 * s, 2.45 * s];
  const chassis = RAPIER.ColliderDesc.cuboid(0.7 * s, 0.25 * s, 1.22 * s).setTranslation(0, 0.62 * s, 0).setFriction(0.5).setRestitution(0.1)
    // A low centre of mass keeps the car planted in hard turns.
    .setMassProperties(spec.mass, { x: 0, y: 0.18 * s, z: 0 }, { x: spec.mass / 12 * (h * h + l * l), y: spec.mass / 12 * (w * w + l * l), z: spec.mass / 12 * (w * w + h * h) }, { x: 0, y: 0, z: 0, w: 1 });
  const cabin = RAPIER.ColliderDesc.cuboid(0.56 * s, 0.33 * s, 0.6 * s).setTranslation(0, 1.14 * s, -0.15 * s).setDensity(0).setFriction(0.5);
  const colliders = [chassis, cabin].map(desc => world.createCollider(desc.setCollisionGroups(groups(GROUP.VEHICLE, ALL)).setSolverGroups(groups(GROUP.VEHICLE, ALL & ~GROUP.CHARACTER)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(spec.mass * 20), body));
  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1; controller.setIndexForwardAxis = 2;
  const layout = wheelLayout(s);
  layout.wheels.forEach((wheel, i) => {
    controller.addWheel({ x: wheel.x, y: wheel.y, z: wheel.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, SUSPENSION.rest, layout.radius);
    controller.setWheelSuspensionStiffness(i, SUSPENSION.stiffness); controller.setWheelMaxSuspensionTravel(i, SUSPENSION.travel);
    controller.setWheelSuspensionCompression(i, SUSPENSION.compression); controller.setWheelSuspensionRelaxation(i, SUSPENSION.relaxation);
    controller.setWheelMaxSuspensionForce(i, spec.mass * GRAVITY * 4); controller.setWheelFrictionSlip(i, spec.grip); controller.setWheelSideFrictionStiffness(i, 1);
  });
  const entry = { kind: 'vehicle', owner: car, body, colliders, controller, spec, layout, flipped: 0, last: null };
  for (const collider of colliders) P.byCollider.set(collider.handle, entry);
  car.wheels = layout.wheels.map(() => ({ rotation: 0, steer: 0, suspension: SUSPENSION.rest - SUSPENSION.static }));
  return entry;
}
function syncVehicle(entry) {
  const car = entry.owner, last = entry.last, body = entry.body;
  if (last && car.x === last.x && car.z === last.z && car.heading === last.heading && car.vx === last.vx && car.vz === last.vz) return;
  // Gameplay moved or re-aimed this car (spawn, recovery, deliberate slowdown): carry the change into the body.
  const moved = !last || car.x !== last.x || car.z !== last.z || car.heading !== last.heading;
  if (moved) { body.setTranslation({ x: car.x, y: last ? body.translation().y : car.y ?? 0, z: car.z }, true); body.setRotation(yaw(car.heading || 0), true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  body.setLinvel({ x: car.vx || 0, y: moved ? 0 : body.linvel().y, z: car.vz || 0 }, true);
}
function driveWheels(entry, dt) {
  const { controller, spec, owner: car } = entry, c = car.control || { brake: 1 };
  const forward = car.speed || 0, mass = spec.mass;
  // Full torque up to roughly half of top speed, fading to zero at top speed.
  let engine = 0;
  if (c.throttle > 0) engine = c.throttle * spec.engine * mass * Math.max(0, Math.min(1, 1.8 * (1 - Math.max(0, forward) / spec.top)));
  else if (c.throttle < 0) engine = c.throttle * spec.engine * 0.7 * mass * Math.max(0, Math.min(1, 1.8 * (1 + Math.min(0, forward) / spec.reverse)));
  // Brakes are impulses per step; a little rolling resistance always acts.
  const brake = ((c.brake || 0) * spec.brake + 0.4) * mass * dt / 4;
  for (let i = 0; i < 4; i++) {
    const front = entry.layout.wheels[i].front;
    controller.setWheelSteering(i, front ? (c.steer || 0) : 0);
    // All-wheel drive with a rear bias keeps traction without lifting the nose.
    controller.setWheelEngineForce(i, engine * (front ? 0.15 : 0.35));
    const handbrake = !front && c.handbrake;
    controller.setWheelBrake(i, brake + (handbrake ? spec.brake * 1.4 * mass * dt / 4 : 0));
    controller.setWheelFrictionSlip(i, handbrake ? spec.grip * 0.45 : spec.grip);
  }
  controller.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, WHEEL_RAYS);
}
function readVehicle(entry, dt) {
  const { body, controller, owner: car } = entry, t = body.translation(), q = body.rotation(), v = body.linvel();
  const f = rotate(q, { x: 0, y: 0, z: 1 }), up = rotate(q, { x: 0, y: 1, z: 0 });
  // Cars left on their side or roof are set back on their wheels after a moment.
  entry.flipped = up.y < 0.35 && Math.hypot(v.x, v.z) < 4 ? entry.flipped + dt : 0;
  if (entry.flipped > 2.5) {
    const heading = Math.atan2(f.x, f.z);
    body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true); body.setRotation(yaw(heading), true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    entry.flipped = 0;
  }
  car.x = t.x; car.y = t.y; car.z = t.z; car.vx = v.x; car.vz = v.z;
  car.heading = Math.atan2(f.x, f.z); car.q = [q.x, q.y, q.z, q.w]; car.upright = up.y;
  // Forward speed from the body (the controller's own speed value is stale while parked).
  car.speed = v.x * f.x + v.z * f.z;
  car.yawRate = body.angvel().y;
  car.wheels.forEach((wheel, i) => { wheel.rotation = controller.wheelRotation(i) || 0; wheel.steer = controller.wheelSteering(i) || 0; wheel.suspension = controller.wheelSuspensionLength(i) ?? wheel.suspension; });
  entry.last = { x: car.x, z: car.z, heading: car.heading, vx: car.vx, vz: car.vz };
}

// ---------------------------------------------------------------- characters
const characterSize = person => { const scale = person.look?.scale || 1; return { radius: 0.5 * scale, half: 1 * scale }; };
function createCharacter(P, person) {
  const { radius, half } = characterSize(person);
  const body = P.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(person.x, (person.height || 0) + half + radius, person.z));
  const collider = P.world.createCollider(RAPIER.ColliderDesc.capsule(half, radius).setCollisionGroups(groups(GROUP.CHARACTER, SOLID | GROUP.VEHICLE)).setSolverGroups(groups(GROUP.CHARACTER, 0)), body);
  const entry = { kind: 'character', owner: person, body, collider, radius, half, last: null, push: { x: 0, z: 0 }, ragdoll: null };
  P.byCollider.set(collider.handle, entry);
  return entry;
}
function moveCharacter(P, entry, dt, vertical) {
  const person = entry.owner, body = entry.body, t = body.translation();
  if (!entry.last || person.x !== entry.last.x || person.z !== entry.last.z) {
    // Spawned, respawned or placed by gameplay (car exit, deployment): move the capsule there directly.
    body.setTranslation({ x: person.x, y: (person.height || 0) + entry.half + entry.radius, z: person.z }, true);
    entry.last = { x: person.x, z: person.z }; entry.push = { x: 0, z: 0 };
    return;
  }
  // People standing still on the ground (queues, benches, chats) skip the controller's shape casts entirely.
  if (entry.grounded && vertical <= 0 && Math.abs(person.vx || 0) + Math.abs(person.vz || 0) < 0.02 && !entry.push.x && !entry.push.z) return;
  const desired = { x: (person.vx || 0) * dt + entry.push.x, y: vertical * dt - (vertical <= 0 ? 0.02 : 0), z: (person.vz || 0) * dt + entry.push.z };
  entry.push = { x: 0, z: 0 };
  P.kcc.computeColliderMovement(entry.collider, desired, CHARACTER_FLAGS, CHARACTER_QUERY);
  const m = P.kcc.computedMovement();
  entry.grounded = P.kcc.computedGrounded();
  body.setNextKinematicTranslation({ x: t.x + m.x, y: Math.max(entry.half + entry.radius, t.y + m.y), z: t.z + m.z });
}
function readCharacter(entry) {
  const person = entry.owner, t = entry.body.translation();
  person.x = t.x; person.z = t.z; person.height = Math.max(0, t.y - entry.half - entry.radius);
  if (person.height < 0.12) person.height = 0; // the controller keeps a small collision skin above the ground
  person.grounded = !!entry.grounded || person.height === 0;
  if (person.grounded) { if (person.velocityY < 0) person.velocityY = 0; if (person.vy < 0) person.vy = 0; }
  entry.last = { x: person.x, z: person.z };
}
// Characters are not pushed by the contact solver (their capsules only generate contacts), so vehicle hits are read from
// the contact manifolds: the push-out keeps them outside the car and the closing speed drives gameplay damage.
function vehicleContacts(P, entry, hits) {
  const person = entry.owner;
  P.world.contactPairsWith(entry.collider, other => {
    const car = P.byCollider.get(other.handle);
    if (car?.kind !== 'vehicle') return;
    P.world.contactPair(entry.collider, other, manifold => {
      let depth = 0;
      for (let i = 0; i < manifold.numContacts(); i++) depth = Math.max(depth, -manifold.contactDist(i));
      if (depth <= 0) return;
      const n = manifold.normal(); let nx = n.x, nz = n.z, d = Math.hypot(nx, nz);
      if (d < 0.2) { nx = person.x - car.owner.x; nz = person.z - car.owner.z; d = Math.hypot(nx, nz) || 1; }
      nx /= d; nz /= d;
      if (nx * (person.x - car.owner.x) + nz * (person.z - car.owner.z) < 0) { nx = -nx; nz = -nz; }
      // Struck by the nose or tail: the push-out goes mostly sideways, out of the car's path, instead of carrying the
      // person along in front of the bumper.
      const fx = Math.sin(car.owner.heading), fz = Math.cos(car.owner.heading), side = (person.x - car.owner.x) * fz - (person.z - car.owner.z) * fx >= 0 ? 1 : -1;
      const sx = fz * side, sz = -fx * side, front = Math.abs(nx * fx + nz * fz) > 0.7;
      const px = front ? sx + nx * 0.3 : nx, pz = front ? sz + nz * 0.3 : nz, pd = Math.hypot(px, pz) || 1;
      entry.push.x += px / pd * Math.min(depth, 0.15); entry.push.z += pz / pd * Math.min(depth, 0.15);
      const v = car.body.linvel();
      hits.push({ person, car: car.owner, nx, nz, sx, sz, closing: Math.max(0, v.x * nx + v.z * nz) });
    });
  });
}

// ---------------------------------------------------------------- ragdolls
function spawnRagdoll(P, entry, profile) {
  const person = entry.owner, scale = person.look?.scale || 1, heading = person.heading || 0, rot = yaw(heading), { world } = P;
  const base = { x: person.x, y: (person.height || 0) + profile.lift * scale, z: person.z };
  const kick = { x: (person.moveX || 0) + (person.kickX || 0), y: Math.max(0, person.vy || 0), z: (person.moveZ || 0) + (person.kickZ || 0) };
  const bodies = {}, joints = [];
  for (const part of profile.parts) {
    const offset = rotate(rot, { x: part.center[0] * scale, y: part.center[1] * scale, z: part.center[2] * scale });
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(base.x + offset.x, base.y + offset.y, base.z + offset.z).setRotation(rot)
      .setLinvel(kick.x, kick.y, kick.z).setLinearDamping(0.15).setAngularDamping(1.4).setCcdEnabled(part.name === 'torso'));
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(part.half[0] * scale, part.half[1] * scale, part.half[2] * scale).setDensity(50).setFriction(0.8).setRestitution(0.05)
      .setCollisionGroups(groups(GROUP.RAGDOLL, SOLID | GROUP.VEHICLE | GROUP.QUERY)), body);
    P.byCollider.set(collider.handle, { kind: 'ragdoll', owner: person, part: part.name });
    bodies[part.name] = { body, collider };
    if (!part.parent) continue;
    const parent = profile.parts.find(p => p.name === part.parent), anchor = part.anchor || part.pivot;
    const local = (from) => ({ x: (anchor[0] - from.center[0]) * scale, y: (anchor[1] - from.center[1]) * scale, z: (anchor[2] - from.center[2]) * scale });
    const data = part.joint === 'revolute' ? RAPIER.JointData.revolute(local(parent), local(part), { x: 1, y: 0, z: 0 }) : RAPIER.JointData.spherical(local(parent), local(part));
    if (part.limits) { data.limitsEnabled = true; data.limits = part.limits; }
    const joint = world.createImpulseJoint(data, bodies[parent.name].body, body, true);
    joint.setContactsEnabled(false); joints.push(joint);
  }
  // A hit direction tips the upper body so the ragdoll topples the way it was struck.
  const torso = bodies.torso.body, head = bodies.head.body, push = Math.hypot(kick.x, kick.z);
  if (push > 0.5) head.applyImpulse({ x: kick.x / push * head.mass() * 2.5, y: 0, z: kick.z / push * head.mass() * 2.5 }, true);
  else torso.applyImpulse({ x: -Math.sin(heading) * torso.mass() * 0.6, y: 0, z: -Math.cos(heading) * torso.mass() * 0.6 }, true);
  const ragdoll = { entry, profile, bodies, joints, age: 0, scale };
  entry.ragdoll = ragdoll; entry.collider.setEnabled(false);
  person.ragdoll = { profile: profile === RAGDOLLS.player ? 'player' : 'npc', scale, parts: {} };
  P.ragdolls.push(ragdoll); readRagdoll(ragdoll);
  return ragdoll;
}
function readRagdoll(ragdoll) {
  const person = ragdoll.entry.owner, pose = person.ragdoll.parts;
  for (const [name, { body }] of Object.entries(ragdoll.bodies)) {
    const t = body.translation(), q = body.rotation();
    pose[name] = [t.x, t.y, t.z, q.x, q.y, q.z, q.w];
  }
  const torso = ragdoll.bodies.torso.body, t = torso.translation(), up = rotate(torso.rotation(), { x: 0, y: 1, z: 0 });
  person.x = t.x; person.z = t.z; person.fall = Math.acos(Math.max(-1, Math.min(1, up.y)));
}
function removeRagdoll(P, ragdoll) {
  for (const joint of ragdoll.joints) P.world.removeImpulseJoint(joint, true);
  for (const { body, collider } of Object.values(ragdoll.bodies)) { P.byCollider.delete(collider.handle); P.world.removeRigidBody(body); }
  P.ragdolls = P.ragdolls.filter(r => r !== ragdoll); ragdoll.entry.ragdoll = null;
}
// Standing back up: the capsule returns at the torso, and the rig's get-up animation starts from the pose it landed in.
function standUp(P, ragdoll) {
  const person = ragdoll.entry.owner, torso = ragdoll.bodies.torso.body, q = torso.rotation();
  const up = rotate(q, { x: 0, y: 1, z: 0 }), front = rotate(q, { x: 0, y: 0, z: 1 });
  const faceUp = front.y > 0;
  person.heading = faceUp ? Math.atan2(-up.x, -up.z) : Math.atan2(up.x, up.z);
  person.fallDir = faceUp ? -1 : 1; person.fall = Math.PI / 2; person.fallVelocity = 0; person.kickX = person.kickZ = person.moveX = person.moveZ = 0;
  const t = torso.translation(); person.x = t.x; person.z = t.z; person.height = 0;
  removeRagdoll(P, ragdoll);
  person.ragdoll = null; person.getUp = 0.45;
  ragdoll.entry.collider.setEnabled(true); ragdoll.entry.last = null;
}
function freezeRagdoll(P, ragdoll) { readRagdoll(ragdoll); ragdoll.entry.owner.ragdoll.frozen = true; removeRagdoll(P, ragdoll); }

// ---------------------------------------------------------------- stepping
function characterList(s) { return [s.player, ...s.pedestrians, ...s.enemies]; }
function wantsRagdoll(s, person) {
  if (person.child) return false;
  if (person === s.player) return (s.down > 0 && s.downReason === 'wasted') || person.knockdown > 0;
  return person.health <= 0 || person.knockdown > 0;
}

export function stepPhysics(s, dt) {
  const P = physicsFor(s), { world } = P, result = { impacts: [], hits: [], props: [] };
  syncStatics(P, s.blocks);
  const cars = [s.car, ...s.traffic, ...s.policeCars], people = characterList(s), live = new Set([...cars, ...people]);
  for (const [owner, entry] of P.entries) if (!live.has(owner)) {
    if (entry.ragdoll) removeRagdoll(P, entry.ragdoll);
    if (entry.kind === 'vehicle') { world.removeVehicleController(entry.controller); entry.colliders.forEach(c => P.byCollider.delete(c.handle)); }
    else P.byCollider.delete(entry.collider.handle);
    world.removeRigidBody(entry.body); P.entries.delete(owner);
  }
  for (const car of cars) {
    let entry = P.entries.get(car);
    if (!entry) { entry = createVehicle(P, car); P.entries.set(car, entry); }
    syncVehicle(entry); entry.before = entry.body.linvel(); driveWheels(entry, dt);
  }
  for (const person of people) {
    let entry = P.entries.get(person);
    if (!entry) { entry = createCharacter(P, person); P.entries.set(person, entry); }
    const profile = person === s.player ? RAGDOLLS.player : RAGDOLLS.npc;
    if (entry.ragdoll && !person.ragdoll) { removeRagdoll(P, entry.ragdoll); entry.collider.setEnabled(true); entry.last = null; }
    const wants = wantsRagdoll(s, person);
    if (wants && !entry.ragdoll && !person.ragdoll?.frozen) spawnRagdoll(P, entry, profile);
    if (entry.ragdoll) {
      entry.ragdoll.age += dt;
      const speed = entry.ragdoll.bodies.torso.body.linvel();
      if (!wants && (Math.hypot(speed.x, speed.y, speed.z) < 1.2 || entry.ragdoll.age > 4)) standUp(P, entry.ragdoll);
      continue;
    }
    if (person.ragdoll?.frozen) continue;
    const driving = person === s.player && s.driving, aboard = person === s.player && (s.boating || s.riding);
    entry.collider.setEnabled(!driving && !aboard);
    if (driving) { entry.body.setTranslation({ x: s.car.x, y: entry.half + entry.radius, z: s.car.z }, true); entry.last = { x: person.x, z: person.z }; continue; }
    // On the boat or the metro the body waits where you boarded (without blocking anyone) until you step off.
    if (aboard) { entry.last = { x: person.x, z: person.z }; continue; }
    moveCharacter(P, entry, dt, person === s.player ? person.velocityY || 0 : person.vy || 0);
  }
  // Keep only a handful of dead bodies simulated; the rest keep their final pose.
  const dead = P.ragdolls.filter(r => r.entry.owner.health <= 0 && r.entry.owner !== s.player);
  for (const ragdoll of dead) if (ragdoll.age > 12 || (ragdoll.age > 2 && Object.values(ragdoll.bodies).every(({ body }) => body.isSleeping()))) freezeRagdoll(P, ragdoll);
  while (P.ragdolls.length > MAX_ACTIVE_RAGDOLLS) { const oldest = P.ragdolls.filter(r => r.entry.owner.health <= 0).sort((a, b) => b.age - a.age)[0]; if (!oldest) break; freezeRagdoll(P, oldest); }

  syncKaiju(P, s.boss);
  world.timestep = dt;
  world.step(P.events);
  P.statics.fresh = false;

  // Collision events first: a broken lamp post restores the car's momentum before its state is read back.
  P.events.drainContactForceEvents(event => {
    const a = P.byCollider.get(event.collider1()), b = P.byCollider.get(event.collider2());
    for (const [self, other] of [[a, b], [b, a]]) {
      if (self?.kind === 'vehicle') result.impacts.push({ car: self.owner, other: other?.kind === 'vehicle' ? other.owner : null, impact: event.maxForceMagnitude() * dt / self.spec.mass, kind: other?.kind || 'static' });
      if (self?.kind === 'prop' && other?.kind === 'vehicle' && !self.owner.fallen) {
        const before = other.before, speed = Math.hypot(before.x, before.z);
        if (speed > 7) {
          // Knocked over: the post becomes a dynamic body and the car keeps most of its momentum.
          self.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          const mass = self.body.mass();
          self.body.applyImpulseAtPoint({ x: before.x * mass * 0.8, y: mass * 2, z: before.z * mass * 0.8 }, { x: self.owner.x, y: 5, z: self.owner.z }, true);
          other.body.setLinvel({ x: before.x * 0.75, y: 0, z: before.z * 0.75 }, true);
          self.owner.fallen = true; result.props.push(self.owner);
        }
      }
    }
  });
  for (const car of cars) readVehicle(P.entries.get(car), dt);
  for (const person of people) {
    const entry = P.entries.get(person);
    if (entry.ragdoll) readRagdoll(entry.ragdoll);
    else if (!(person === s.player && s.driving) && !person.ragdoll?.frozen) { readCharacter(entry); if (person.health !== 0) vehicleContacts(P, entry, result.hits); }
  }
  for (const entry of P.props) if (entry.owner.fallen) { const t = entry.body.translation(), q = entry.body.rotation(); Object.assign(entry.owner, { x: t.x, y: t.y, z: t.z, q: [q.x, q.y, q.z, q.w] }); }
  return result;
}

// ---------------------------------------------------------------- queries
// Distance along a ray to the first building box within `max`, or null (slab test).
function blockHit(blocks, o, d, max) {
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
// A bullet ray from `from` toward `to` (plain {x, z} points at chest height). Returns the first obstruction, or null.
// Cars, lamp posts and bodies are hit and pushed; the target's own collider (or car) counts as reaching the target.
export function castShot(s, from, to, { reach = null, ignore = [], target = null } = {}) {
  const P = physicsFor(s); syncStatics(P, s.blocks);
  const origin = { x: from.x, y: (from.height || 0) + 2.2, z: from.z }, dx = to.x - from.x, dz = to.z - from.z, flat = Math.hypot(dx, dz) || 1;
  const dy = to.y !== undefined ? to.y - origin.y : -0.2;
  const distance = reach ?? Math.hypot(flat, dy), dir = { x: dx / Math.hypot(flat, dy), y: dy / Math.hypot(flat, dy), z: dz / Math.hypot(flat, dy) };
  const skip = new Set(ignore.map(owner => P.entries.get(owner)).filter(Boolean).flatMap(e => e.kind === 'vehicle' ? e.colliders.map(c => c.handle) : [e.collider.handle]));
  const targetEntry = target && P.entries.get(target);
  const hit = P.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), distance, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, SHOT_QUERY, undefined, undefined, collider => !skip.has(collider.handle));
  const wall = P.statics.fresh ? blockHit(s.blocks, origin, dir, hit ? hit.timeOfImpact : distance) : null;
  if (wall !== null) return { x: origin.x + dir.x * wall, y: origin.y + dir.y * wall, z: origin.z + dir.z * wall, distance: wall, kind: 'static', owner: null };
  if (!hit) return null;
  const entry = P.byCollider.get(hit.collider.handle), point = { x: origin.x + dir.x * hit.timeOfImpact, y: origin.y + dir.y * hit.timeOfImpact, z: origin.z + dir.z * hit.timeOfImpact };
  if (targetEntry && entry === targetEntry) return null;
  const result = { ...point, distance: hit.timeOfImpact, kind: entry?.kind || 'static', owner: entry?.owner || null, part: entry?.part };
  const body = hit.collider.parent();
  if (body?.isDynamic()) body.applyImpulseAtPoint({ x: dir.x * body.mass() * (entry?.kind === 'ragdoll' ? 1.2 : 0.15), y: dir.y * body.mass() * 0.15, z: dir.z * body.mass() * (entry?.kind === 'ragdoll' ? 1.2 : 0.15) }, point, true);
  return result;
}
// The Rapier body behind a session object (vehicle, character or ragdoll torso), for tools and tests.
export function bodyOf(s, owner) { const entry = physicsFor(s).entries.get(owner); return entry?.ragdoll?.bodies.torso.body || entry?.body || null; }
