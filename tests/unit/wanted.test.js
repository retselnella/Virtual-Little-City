import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, createSession, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { MAX_STARS, crewUnits, escapeTime, helicoptersFor, recordKill, starsOf, unitsFor } from '../../src/models/worldTour/wanted.js';
import { HELI, heliSees, underCover, updateHelicopters } from '../../src/models/worldTour/policeAir.js';
import { islandFor } from '../../src/models/worldTour/worldIsland.js';

const miami = CITIES.find(c => c.id === 'miami');

test('killing people raises the wanted level up to five stars', () => {
  const s = { heat: 0, quiet: 0 }, levels = [];
  for (let i = 0; i < 12; i++) { recordKill(s); levels.push(starsOf(s.heat)); }
  assert.deepEqual(levels, [2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5]);
  assert.equal(MAX_STARS, 5); assert.equal(starsOf(9), 5, 'never above five');
  assert.deepEqual([1, 2, 3, 4, 5].map(n => helicoptersFor(n)), [0, 0, 0, 1, 2], 'helicopters at four and five stars');
  assert.deepEqual([1, 3, 5].map(n => crewUnits(n, 1)), [3, 5, 7], 'a crew of wanted players brings more units'); assert.equal(helicoptersFor(5, 1), 3); assert.equal(crewUnits(0, 2), 0);
  assert.deepEqual([1, 3, 5].map(unitsFor), [1, 3, 5]);
  assert.ok(escapeTime(5) > escapeTime(1), 'harder to get away at higher levels');
  assert.equal(createSession(miami).policeCars.length, 5, 'enough patrol cars for five stars');
});

test('police helicopters hunt from the air: they fly in, circle and shoot, and cannot see under trees or through towers', () => {
  const s = createSession(miami); s.traffic = []; s.pedestrians = []; s.heat = 4.5; s.quiet = 0; s.lastSeen = { x: 8, z: 12 }; s.unseen = 0;
  const at = { x: 8, z: 12 }, hits = [];
  for (let i = 0; i < 600; i++) updateHelicopters(s, at, 0.05, { hurt: n => hits.push(n) });
  assert.equal(s.helicopters.length, 2, 'two helicopters at five stars');
  for (const h of s.helicopters) {
    assert.ok(Math.hypot(h.x - at.x, h.z - at.z) < HELI.orbit + 15, 'circling overhead'); assert.ok(h.y > 30 && h.y < 60);
  }
  assert.ok(s.helicopters.some(h => h.spotting), 'the searchlight is on you'); assert.ok(hits.length > 0, 'marksmen fire at five stars');
  // Towers in the way hide you; so do trees.
  const heli = { x: 0, y: 40, z: 0 }, tower = [{ x: 0, z: 30, width: 20, depth: 20, height: 120 }];
  assert.equal(heliSees({ ...s, blocks: [] }, heli, { x: 0, z: 60 }), true);
  assert.equal(heliSees({ ...s, blocks: tower }, heli, { x: 0, z: 60 }), false, 'behind a tower');
  const tree = islandFor('miami').trees.find(t => t.kind !== 'palm' && (t.scale || 1) > 0.8);
  assert.equal(underCover(s, tree), true, 'under a tree canopy');
  assert.equal(heliSees(s, { x: tree.x + 5, y: 40, z: tree.z }, tree), false);
  // Wanted level gone: they fly home and disappear.
  s.heat = 0;
  for (let i = 0; i < 800 && s.helicopters.length; i++) updateHelicopters(s, at, 0.05);
  assert.equal(s.helicopters.length, 0, 'the helicopters have left');
});

test('get away from a five-star pursuit and the stars fade to zero; the city calms down', () => {
  const s = createSession(miami); s.traffic = []; s.pedestrians = [];
  s.heat = 5; s.quiet = 20; s.incident = false; s.lastSeen = { x: 8, z: 12 };
  stepWorld(s, {}, 0.05); assert.equal(starsOf(s.heat), 5);
  // Run far away from everyone (the search stays around the last sighting) and hide in a wood out of town.
  const tree = islandFor('miami').trees.find(t => t.kind !== 'palm' && (t.scale || 1) > 0.8 && Math.hypot(t.x, t.z) > 500);
  s.player.x = tree.x; s.player.z = tree.z; s.searched = true;
  let messages = new Set();
  for (let i = 0; i < 2400 && s.heat > 0; i++) { stepWorld(s, {}, 0.05); s.quiet = 99; s.player.x = tree.x; s.player.z = tree.z; messages.add(s.message); }
  assert.equal(s.down, 0, 'not wasted: the helicopters never saw you'); assert.equal(s.health, 100);
  assert.equal(s.heat, 0, 'the stars faded');
  assert.ok([...messages].some(m => /got away/.test(m)), 'you are told you got away');
  for (let i = 0; i < 600; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.helicopters.filter(h => h.state !== 'leaving').length, 0, 'no helicopters hunting');
  assert.ok(s.policeCars.every(c => !['responding', 'onscene', 'regroup'].includes(c.state)), 'patrols stood down');
  assert.equal(s.kills, 0);
});

test('air traffic: the airliner lands on the runway and takes off again, jets and helicopters fly over, the same for everyone', async () => {
  const { AIRLINER_CYCLE, RUNWAY, airTraffic, airlinerAt } = await import('../../src/models/worldTour/airTraffic.js');
  assert.deepEqual(airTraffic(1234.5), airTraffic(1234.5), 'a function of the shared clock');
  const onGround = [], samples = Array.from({ length: AIRLINER_CYCLE * 2 }, (_, i) => airlinerAt(i / 2));
  for (const a of samples) if (a.visible && a.y < 3) onGround.push(a);
  assert.ok(onGround.length > 20, 'it spends time on the ground');
  assert.ok(onGround.every(a => Math.abs(a.x - RUNWAY.x) < 12 && a.z > RUNWAY.z0 - 25 && a.z < RUNWAY.z1 + 5), 'only on the runway');
  assert.ok(samples.some(a => a.visible && a.y > 300), 'and climbs away');
  for (let i = 1; i < samples.length; i++) if (samples[i].visible && samples[i - 1].visible) assert.ok(Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z) < 80, 'smooth flight');
  const kinds = new Set(Array.from({ length: 300 }, (_, i) => airTraffic(i * 3)).flat().map(a => a.kind));
  assert.deepEqual([...kinds].sort(), ['airliner', 'helicopter', 'jet']);
});

test('killing the officers on scene does not end the pursuit: their car is out of action and reinforcements come', () => {
  const s = createSession(miami); s.traffic = []; s.pedestrians = [];
  s.heat = 3; s.quiet = 0; s.lastSeen = { x: 8, z: 12 };
  // Every patrol car arrived, dropped its officers, and they were all killed.
  for (const car of s.policeCars) { car.state = 'onscene'; car.deployed = true; for (const side of [-1, 1]) s.enemies.push({ id: car.id + side, unit: car.id, kind: 'police', x: car.x + side * 3, z: car.z, health: 0, deadAt: 0, cooldown: 9 }); }
  stepWorld(s, {}, 0.05);
  assert.ok(s.policeCars.filter(c => c.state === 'down').length === 5, 'the empty cars are out of action');
  for (let i = 0; i < 200; i++) { stepWorld(s, {}, 0.05); s.quiet = 0; }
  const responding = s.policeCars.filter(c => c.state === 'responding');
  assert.ok(responding.length >= 3 && responding.every(c => c.reinforcement), `reinforcements are on the way (${responding.length})`);
  assert.ok(s.policeCars.length <= 12);
  // Once it is all over and you are far away, the abandoned cars go back and the reinforcements leave.
  s.heat = 0; s.player.x = 380; s.player.z = 380;
  for (let i = 0; i < 40; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.policeCars.filter(c => c.state === 'down').length, 0, 'no abandoned cars left');
  assert.ok(s.policeCars.filter(c => c.reinforcement).every(c => c.state === 'returning'));
});
