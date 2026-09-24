import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CITIES, createSession, attack, stepWorld, clearSight } from '../../src/models/worldTour/worldAdventure.js';
import { vehicle, fits, roadRoute } from '../../src/models/worldTour/worldPhysics.js';
import { stepPhysics, bodyOf } from '../../src/models/worldTour/physicsEngine.js';
import { createStreetNpc } from '../../src/scenes/shared/streetNpc.js';
import { createRagdollRig } from '../../src/scenes/shared/ragdollRig.js';
import { RAGDOLLS } from '../../src/models/worldTour/ragdollProfiles.js';

// A session with no traffic, patrols parked far away and no pedestrians, for isolated physics checks.
function quietSession(city = CITIES[0]) {
  const s = createSession(city); s.traffic = []; s.pedestrians = [];
  s.policeCars.forEach((c, i) => Object.assign(c, { x: 420, z: -420 + i * 12, route: [], loop: false }));
  return s;
}
const run = (s, seconds, input = {}, each) => { for (let i = 0; i < seconds * 20; i++) { stepWorld(s, input, 0.05); each?.(); } };

test('every civilian, gang and police rig has two jointed arms, hands, legs and knees', () => {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshBasicMaterial();
  const kit = { box(size, color, position, parent) { const box = new THREE.Mesh(geometry, material); box.scale.set(...size); box.position.set(...position); parent.add(box); return box; } };
  for (const options of [{}, { armed: true }, { armed: true, police: true }, { role: 'kid', look: { scale: 0.6 } }, { role: 'business' }]) {
    const model = createStreetNpc(scene, kit, options);
    for (const side of ['left', 'right']) for (const part of ['shoulder', 'elbow', 'hand', 'hip', 'knee']) assert.ok(model.avatar.getObjectByName(`${side}-${part}`));
    assert.ok(model.avatar.getObjectByName('neck'), 'the head hangs from a neck joint for ragdolls');
    model.update({ x: 0, z: 0, health: 100, speed: 3, heading: 0 }, 0.1);
    assert.notEqual(model.avatar.getObjectByName('left-hip').rotation.x, 0);
    model.update({ x: 0, z: 0, health: 0, speed: 0, fall: 1, heading: 0 }, 0.1);
    assert.equal(model.avatar.getObjectByName('torso').parent.rotation.x, 1);
  }
  geometry.dispose(); material.dispose();
});

test('after a ragdoll ends, every joint returns to the animated pose (no stuck neck or twisted hips)', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshBasicMaterial();
  const kit = { box(size, color, position, parent) { const box = new THREE.Mesh(geometry, material); box.scale.set(...size); box.position.set(...position); parent.add(box); return box; } };
  // A lying, twisted pose: the whole body tipped backward around the feet with the head turned and tilted.
  const tip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.45), twist = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.9, 0.4));
  const pose = { profile: 'npc', scale: 1, parts: {} };
  for (const part of RAGDOLLS.npc.parts) {
    const at = new THREE.Vector3(part.center[0] + 0.3, part.center[1] + 0.15, part.center[2]).applyQuaternion(tip), q = tip.clone();
    if (part.name === 'head') q.multiply(twist);
    pose.parts[part.name] = [at.x + 2, at.y, at.z - 1, q.x, q.y, q.z, q.w];
  }
  const snapshot = model => ['hips', 'neck', 'left-shoulder', 'right-elbow', 'left-hip', 'right-knee'].map(name => {
    const node = model.avatar.getObjectByName(name); return [...node.position.toArray(), ...node.quaternion.toArray()];
  });
  const walker = { x: 0, z: 0, heading: 0, health: 100, speed: 1.5, fall: 0 };
  for (const getUp of [0, 0.45]) {
    const fresh = createStreetNpc(new THREE.Group(), kit), model = createStreetNpc(new THREE.Group(), kit), rig = createRagdollRig(model.avatar, 'npc');
    const person = { ...walker, ragdoll: pose };
    rig.before(person); model.update(person, 0.1); rig.after(person, 0.1); fresh.update(walker, 0.1);
    assert.ok(Math.abs(model.avatar.getObjectByName('neck').quaternion.x) > 0.1, 'the ragdoll pose drives the neck');
    Object.assign(person, { ragdoll: null, getUp });
    for (let i = 0; i < 8; i++) { rig.before(person); model.update(person, 0.1); rig.after(person, 0.1); fresh.update(walker, 0.1); }
    snapshot(model).forEach((values, i) => values.forEach((v, j) => assert.ok(Math.abs(v - snapshot(fresh)[i][j]) < 1e-6, `joint ${i} channel ${j} restored (${getUp ? 'stood up' : 'respawned'})`)));
  }
  geometry.dispose(); material.dispose();
});

test('a car driven hard into a thin wall never tunnels through it and is damaged', () => {
  const s = quietSession(); s.blocks = [{ x: 0, z: 40, width: 60, depth: 0.4, height: 12 }];
  Object.assign(s.car, { x: 0, z: 0, heading: 0, vx: 0, vz: 50 }); s.driving = true;
  let furthest = 0;
  run(s, 3, { forward: true }, () => { furthest = Math.max(furthest, s.car.z); });
  assert.ok(furthest < 40 - 2, 'the front of the car stops at the wall: ' + furthest);
  assert.ok(s.car.damage > 5); assert.ok(s.health < 100, 'the driver is hurt by the crash');
  assert.ok(fits(s.car.x, s.car.z, s.blocks, 1.5));
});

test('vehicle collisions exchange momentum, lose energy and damage both cars without overlap', () => {
  const s = quietSession(); s.driving = false;
  const hitter = vehicle('hitter', 0, -30, 0); hitter.control = {}; s.traffic = [hitter];
  Object.assign(s.car, { x: 0, z: 0, heading: Math.PI / 2 });
  run(s, 0.5);
  Object.assign(hitter, { vx: 0, vz: 25 });
  const energy = 1250 * 25 ** 2;
  let contact = false, closest = Infinity;
  for (let i = 0; i < 150; i++) {
    hitter.route = []; hitter.control = {}; stepPhysics(s, 1 / 60);
    closest = Math.min(closest, Math.hypot(hitter.x - s.car.x, hitter.z - s.car.z));
    if (s.car.vz > 1.5) contact = true;
  }
  assert.ok(contact, 'the struck car is shoved along the impact direction');
  assert.ok(hitter.vz < 25, 'the hitting car loses speed');
  assert.ok(1250 * (hitter.vx ** 2 + hitter.vz ** 2) + 1450 * (s.car.vx ** 2 + s.car.vz ** 2) < energy, 'the crash dissipates energy');
  assert.ok(closest > 2.2, 'bodies do not pass through each other: ' + closest);
});

test('stopped traffic yields without jumping, then drives around a parked car', () => {
  const s = quietSession(); s.driving = false;
  const car = vehicle('traffic', 4, -60, 0); car.route = [{ x: 4, z: 200 }]; car.loop = false; s.traffic = [car];
  Object.assign(s.car, { x: 4, z: -20, heading: 0 }); s.player.x = 300; s.player.z = 300;
  let previous = { x: car.x, z: car.z }, closest = Infinity, passed = false;
  for (let i = 0; i < 400; i++) {
    stepWorld(s, {}, 0.05);
    assert.ok(Math.hypot(car.x - previous.x, car.z - previous.z) < 1.5, 'motion is continuous');
    previous = { x: car.x, z: car.z }; closest = Math.min(closest, Math.hypot(car.x - s.car.x, car.z - s.car.z));
    if (car.z > s.car.z + 8) { passed = true; break; }
  }
  assert.ok(closest > 3, 'it stops short of the parked car: ' + closest);
  assert.ok(passed, 'after waiting it passes the parked car');
  assert.ok(s.car.damage === 0);
});

test('reverse input brakes before reversing; steering yaws the car while it stays on its wheels', () => {
  const s = quietSession(); s.driving = true;
  Object.assign(s.car, { x: 0, z: -300, heading: 0, vx: 0, vz: 40 });
  stepWorld(s, { backward: true }, 0.05);
  assert.ok(s.car.speed > 35, 'braking is progressive, not an instant reversal');
  run(s, 3, { backward: true });
  assert.ok(Math.abs(s.car.speed) < 3, 'it brakes to a stop');
  run(s, 2, { backward: true });
  assert.ok(s.car.speed < -2, 'then reverses');
  Object.assign(s.car, { x: 0, z: -300, heading: 0, vx: 0, vz: 30 });
  let upright = 1;
  run(s, 1.5, { forward: true, left: true }, () => { upright = Math.min(upright, s.car.upright); });
  assert.ok(s.car.heading > 0.3, 'left steering turns the car toward +x (left of a car facing +z)');
  assert.ok(upright > 0.9, 'the car stays planted');
  assert.equal(s.car.wheels.length, 4); assert.ok(s.car.wheels.some(w => w.steer > 0.05));
});

test('defeated characters become jointed ragdolls that fall away from the hit and come to rest', () => {
  const s = quietSession(); s.blocks = [];
  const thug = { id: 'thug', kind: 'gang', x: 8, z: 18, heading: Math.PI, health: 30, cooldown: 60 };
  s.enemies = [thug]; stepWorld(s, {}, 0.05);
  attack(s);
  assert.equal(thug.health, 0);
  run(s, 0.1);
  assert.ok(thug.ragdoll && Object.keys(thug.ragdoll.parts).length === 10, 'ten bodies: torso, head, arms, forearms, thighs, shins');
  run(s, 3);
  const torso = thug.ragdoll.parts.torso;
  assert.ok(torso[1] < 1.2, 'the torso ends up near the ground: ' + torso[1]);
  assert.ok(Object.values(thug.ragdoll.parts).every(part => part[1] > 0), 'no body part sinks through the ground');
  assert.ok(thug.z > 18.5, 'the body is carried away from the shooter');
  assert.ok(thug.fall > 1, 'the body lies down');
  run(s, 12);
  assert.ok(thug.ragdoll.frozen, 'settled bodies stop simulating and keep their pose');
});

test('a knockdown ragdolls the target, which then gets back up and walks again', () => {
  const s = quietSession(); s.blocks = []; s.weapon = 'fists';
  const thug = { id: 'thug', kind: 'gang', x: 8, z: 15, heading: Math.PI, health: 300, cooldown: 60 };
  s.enemies = [thug]; stepWorld(s, {}, 0.05);
  for (let i = 0; i < 3; i++) { attack(s); run(s, 0.5); }
  assert.ok(thug.ragdoll, 'the hook knocks the target into a ragdoll');
  let stood = false;
  for (let i = 0; i < 120 && !stood; i++) { stepWorld(s, {}, 0.05); stood = !thug.ragdoll; }
  assert.ok(stood, 'the target recovers');
  assert.ok(thug.health > 0 && thug.getUp > 0 || thug.fall < Math.PI / 2);
  const before = { x: thug.x, z: thug.z };
  Object.assign(s.player, { x: thug.x + 40, z: thug.z });
  run(s, 3);
  assert.ok(Math.hypot(thug.x - before.x, thug.z - before.z) > 3, 'the capsule is active again and the fighter moves');
});

test('the character controller stops at walls, stands beside parked cars and lands after a jump', () => {
  const s = quietSession(); s.blocks = [{ x: 0, z: 0, width: 10, depth: 10, height: 20 }];
  Object.assign(s.player, { x: 0, z: 7 });
  run(s, 3, { forward: true });
  assert.ok(s.player.z > 5.4 && s.player.z < 6, 'the capsule stops at the wall face: ' + s.player.z);
  s.blocks = []; Object.assign(s.car, { x: 0, z: 0, heading: 0 }); Object.assign(s.player, { x: 0, z: 6 });
  run(s, 3, { forward: true });
  assert.ok(Math.hypot(s.player.x - s.car.x, s.player.z - s.car.z) > 1.4, 'the player is kept outside the parked car');
  Object.assign(s.player, { x: 30, z: 30 }); run(s, 0.2);
  let peak = 0;
  stepWorld(s, { jump: true }, 0.05); run(s, 1.2, {}, () => { peak = Math.max(peak, s.player.height); });
  assert.ok(peak > 1, 'the jump leaves the ground: ' + peak); assert.equal(s.player.height, 0, 'and lands');
});

test('bullets are physics rays: a car between shooter and target takes the hit', () => {
  const s = quietSession(); s.blocks = [];
  Object.assign(s.car, { x: 8, z: 22, heading: Math.PI / 2 });
  const thug = { id: 'thug', kind: 'gang', x: 8, z: 32, heading: Math.PI, health: 100, cooldown: 60 };
  s.enemies = [thug]; run(s, 0.3);
  const damage = s.car.damage;
  attack(s);
  assert.equal(thug.health, 100, 'the gang member behind the car is not hit');
  assert.ok(s.car.damage > damage, 'the car absorbs the bullet');
  assert.ok(Math.abs(s.shots.at(-1).tz - 22) < 2, 'the tracer ends at the car');
  thug.cooldown = 0; const health = s.health;
  for (let i = 0; i < 20; i++) { thug.cooldown = Math.min(thug.cooldown, 0); stepWorld(s, {}, 0.05); }
  assert.equal(s.health, health, 'the car is cover against return fire too');
});

test('a fast car knocks a lamp post over and keeps most of its speed; a crawling car does not', () => {
  const s = quietSession(); s.driving = true;
  const post = s.props?.[0] || (stepWorld(s, {}, 0.05), s.props[0]);
  Object.assign(s.car, { x: post.x, z: post.z - 30, heading: 0, vx: 0, vz: 28 });
  let after = 0;
  run(s, 2, { forward: true }, () => { if (post.fallen && !after) after = s.car.speed; });
  assert.ok(post.fallen, 'the post breaks off');
  assert.ok(after > 12, 'the car ploughs through: ' + after);
  const other = s.props[1];
  Object.assign(s.car, { x: other.x, z: other.z - 8, heading: 0, vx: 0, vz: 3 });
  let touched = false;
  run(s, 4, {}, () => { touched ||= Math.hypot(s.car.x - other.x, s.car.z - other.z) < 3; });
  assert.ok(touched, 'the coasting car reaches the post');
  assert.equal(other.fallen, false, 'a gentle bump does not break it');
});

test('a car striking an adult throws them as a ragdoll; a child is only pushed aside', () => {
  const s = quietSession(); s.blocks = [];
  const [adult, child] = [createSession(CITIES[0]).pedestrians.find(p => !p.child), createSession(CITIES[0]).pedestrians.find(p => p.child)];
  for (const [person, x] of [[adult, 0], [child, 60]]) Object.assign(person, { x, z: 30, leader: null, idle: 99, pause: 99, axis: 'z', lane: x });
  s.pedestrians = [adult, child];
  const strike = x => { Object.assign(s.car, { x, z: 0, heading: 0, vx: 0, vz: 22 }); s.driving = true; };
  strike(0); let thrown = false, bled = false;
  run(s, 2, { forward: true }, () => { thrown ||= !!adult.ragdoll; bled ||= s.impacts.some(hit => hit.kind === 'car' && hit.blood); });
  assert.ok(thrown, 'the adult is thrown as a ragdoll'); assert.ok(adult.health < 60, 'and badly hurt: ' + adult.health); assert.ok(bled);
  strike(60); let carried = 0;
  run(s, 2, { forward: true }, () => { if (Math.abs(child.x - 60) < 1.5 && child.z > 34) carried++; });
  assert.ok(carried < 6, 'the child is pushed aside, not carried along by the bumper');
  assert.equal(child.health, 100); assert.ok(!child.ragdoll, 'children are never ragdolled or injured');
  assert.ok(Math.abs(child.x - 60) > 1 || Math.abs(child.z - 30) > 1, 'but they are pushed clear of the car');
});

test('a car left on its roof is set back on its wheels', () => {
  const s = quietSession(); s.driving = false;
  stepWorld(s, {}, 0.05);
  bodyOf(s, s.car).setRotation({ x: 0, y: 0, z: 1, w: 0 }, true);
  run(s, 0.5); assert.ok(s.car.upright < 0, 'upside down');
  run(s, 4);
  assert.ok(s.car.upright > 0.95, 'righted after a moment');
});

test('a wasted player collapses as a ragdoll until recovery', () => {
  const s = quietSession();
  s.health = 0; stepWorld(s, {}, 0.05);
  assert.equal(s.downReason, 'wasted'); run(s, 0.5);
  assert.ok(s.player.ragdoll, 'the player collapses as a ragdoll');
  run(s, 1.5); assert.ok(s.player.ragdoll.parts.torso[1] < 1.3, 'and falls to the ground');
  run(s, 3);
  assert.equal(s.player.ragdoll, undefined, 'recovery brings back a fresh player');
  assert.equal(s.health, 100); assert.equal(s.downReason, '');
});

test('police dispatch existing cars, travel continuously, stop and deploy officers at their doors', () => {
  const s = createSession(CITIES[0]); s.traffic = []; s.pedestrians = [];
  const original = s.policeCars.map(c => c.id); attack(s);
  for (let i = 0; i < 50; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.enemies.length, 0, 'no officers materialize after a shot');
  let deployed = false;
  for (let i = 0; i < 800; i++) {
    const positions = s.policeCars.map(c => ({ x: c.x, z: c.z })); stepWorld(s, {}, 0.05);
    s.policeCars.forEach((c, index) => { assert.equal(c.id, original[index]); assert.ok(Math.hypot(c.x - positions[index].x, c.z - positions[index].z) < 2.4, 'patrol movement is continuous'); assert.ok(fits(c.x, c.z, s.blocks, 1.2)); });
    if (s.enemies.length) {
      for (const officer of s.enemies) {
        const car = s.policeCars.find(c => c.id === officer.unit); assert.ok(car); assert.equal(car.state, 'onscene');
        assert.ok(Math.hypot(car.vx, car.vz) < 1.2); assert.ok(Math.hypot(officer.x - car.x, officer.z - car.z) < 4.5); assert.ok(clearSight(car, s.player, s.blocks));
      }
      deployed = true; break;
    }
  }
  assert.ok(deployed, 'a patrol reaches the player and officers get out');
});

test('road routes stay outside buildings from every district corner', () => {
  const s = createSession(CITIES[0]);
  for (const from of [{ x: 360, z: -80 }, { x: -120, z: 220 }, { x: 215, z: -240 }]) {
    let previous = from;
    for (const point of roadRoute(from, { x: 8, z: 12 })) { assert.ok(clearSight(previous, point, s.blocks)); previous = point; }
  }
});
