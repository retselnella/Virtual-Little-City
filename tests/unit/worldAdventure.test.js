import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CONTRACTS, generateBlocks, createSession, cleanWorldSave, freePosition, clearSight, startContract, interact, toggleVehicle, attack, stepWorld, recover, missionSteps } from '../../src/models/worldTour/worldAdventure.js';

test('all seven cities have distinct deterministic districts and reachable contract sites', () => {
  assert.equal(CITIES.length, 7);
  for (const city of CITIES) {
    const blocks = generateBlocks(city);
    assert.equal(blocks.length, 144); assert.deepEqual(blocks, generateBlocks(city));
    assert.ok(freePosition(8, 12, blocks));
    for (const mission of CONTRACTS) for (const point of missionSteps(city.id, mission.id)) assert.ok(freePosition(point.x, point.z, blocks, 1), `${city.name} ${mission.id} ${point.label}`);
    assert.ok(!freePosition(blocks[0].x, blocks[0].z, blocks));
    // The island: the east waterfront ends at the beach, the countryside is open, the ocean is not.
    assert.ok(!freePosition(480, 0, blocks)); assert.ok(!freePosition(0, -1500, blocks));
    assert.ok(freePosition(-700, 0, blocks) && freePosition(0, 800, blocks));
  }
  assert.notDeepEqual(generateBlocks(CITIES[0]), generateBlocks(CITIES[1]));
});
test('delivery requires pickup, proximity, stopping and awards once', () => {
  const s = createSession(CITIES[0]);
  assert.ok(startContract(s, 'courier')); assert.equal(startContract(s, 'crew'), false);
  interact(s); assert.equal(s.mission.stage, 0);
  Object.assign(s.player, CONTRACTS[0].finish); interact(s); assert.equal(s.cash, 0);
  Object.assign(s.player, CONTRACTS[0].target, { speed: 10 }); interact(s); assert.equal(s.mission.stage, 0);
  s.player.speed = 0; interact(s); assert.equal(s.mission.stage, 1);
  Object.assign(s.player, CONTRACTS[0].finish); s.heat = 1; interact(s); assert.equal(s.cash, 0);
  s.heat = 0; interact(s); assert.equal(s.cash, 650); assert.equal(s.mission, null);
  interact(s); assert.equal(s.cash, 650); assert.equal(startContract(s, 'courier'), false);
});
test('combat respects line of sight, range, cooldown, ammunition and enemy death', () => {
  const s = createSession(CITIES[0]); s.blocks = [];
  s.enemies = [{ id: 'one', x: 8, z: 22, health: 100, kind: 'gang', cooldown: 5 }];
  attack(s); assert.equal(s.enemies[0].health, 60); assert.equal(s.mags.pistol, 47); assert.equal(s.heat, 1);
  attack(s); assert.equal(s.mags.pistol, 47);
  s.cooldown = 0; s.blocks = [{ x: 8, z: 17, width: 4, depth: 2 }];
  assert.equal(clearSight(s.player, s.enemies[0], s.blocks), false);
  attack(s); assert.equal(s.enemies[0].health, 60);
  s.blocks = []; s.cooldown = 0; attack(s); s.cooldown = 0; attack(s); assert.equal(s.enemies[0].health, 0);
  s.mags.pistol = 0; s.cooldown = 0; attack(s); assert.equal(s.mags.pistol, 0);
  s.weapon = 'fists'; s.enemies[0].health = 100; attack(s); assert.equal(s.enemies[0].health, 100);
  s.enemies[0].z = 14; s.cooldown = 0; attack(s); assert.equal(s.enemies[0].health, 66);
});
test('combat contract clears only after every gang member dies, then pays at the safehouse', () => {
  const s = createSession(CITIES[0]); startContract(s, 'crew');
  assert.equal(s.enemies.length, 4); stepWorld(s, {}, 0.05); assert.equal(s.mission.stage, 0);
  s.enemies.forEach(e => e.health = 0); stepWorld(s, {}, 0.05); assert.equal(s.mission.stage, 1);
  interact(s); assert.equal(s.cash, 1200); assert.ok(s.completed.includes('miami:crew'));
});
test('police pursuit starts after case pickup, cools down, and enemies damage the player', () => {
  const s = createSession(CITIES[0]); startContract(s, 'escape'); Object.assign(s.player, CONTRACTS[2].target); interact(s); assert.equal(s.heat, 2);
  s.enemies = [{ id: 'cop', kind: 'police', x: s.player.x, z: s.player.z + 5, health: 100, cooldown: 0 }];
  stepWorld(s, {}, 0.05); assert.ok(s.health < 100);
  s.player.x = -400; s.player.z = 400;
  for (let i = 0; i < 700; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.heat, 0);
  const health = s.health; stepWorld(s, {}, 0.05); assert.equal(s.health, health, 'officers stand down instead of firing after heat is lost');
});
test('vehicle entry requires proximity; fast exits are blocked; movement respects buildings', () => {
  const s = createSession(CITIES[0]); s.player.x = 80; toggleVehicle(s); assert.equal(s.driving, false);
  s.player.x = 8; toggleVehicle(s); assert.equal(s.driving, true);
  s.car.speed = 20; toggleVehicle(s); assert.equal(s.driving, true);
  s.car.speed = 0; toggleVehicle(s); assert.equal(s.driving, false);
  s.blocks = [{ x: 0, z: 0, width: 10, depth: 10 }]; s.player.x = 0; s.player.z = 7;
  for (let i = 0; i < 100; i++) stepWorld(s, { forward: true }, 0.05, Math.PI);
  // The Rapier capsule (radius 0.5) stops against the wall face at z = 5.
  assert.ok(s.player.z >= 5.45 && s.player.z < 6, 'stopped at the wall: ' + s.player.z);
});
test('death respawns, cancels the contract and keeps earned rewards; reload restores ammunition', () => {
  const s = createSession(CITIES[0], { cash: 650, completed: ['miami:courier'] }); startContract(s, 'crew'); s.health = 0;
  stepWorld(s, {}, 0.05); assert.ok(s.down > 0);
  for (let i = 0; i < 82; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.health, 100); assert.equal(s.mission, null); assert.equal(s.cash, 650); assert.deepEqual(s.completed, ['miami:courier']);
  s.mags.pistol = 0; s.reload = 1.5; for (let i = 0; i < 31; i++) stepWorld(s, {}, 0.05); assert.equal(s.mags.pistol, 48);
  recover(s); assert.equal(s.cash, 650);
});
test('saves sanitize invalid data and keep city-specific completion', () => {
  assert.deepEqual(cleanWorldSave(null), { city: 'miami', cash: 0, completed: [], owned: ['pistol'] });
  assert.deepEqual(cleanWorldSave({ city: 'invalid', cash: -50, completed: ['miami:courier', 'miami:courier', 'unknown'] }), { city: 'miami', cash: 0, completed: ['miami:courier'], owned: ['pistol'] });
  const save = cleanWorldSave({ city: 'tokyo', cash: 900, completed: ['miami:courier'] });
  const s = createSession(CITIES[1], save); assert.ok(startContract(s, 'courier')); assert.equal(s.cash, 900);
});
