import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, createSession, clearSight, interact, promptFor, talk, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { nearbyNpc, endNpcDialogue, stepNpcDialogue } from '../../src/models/worldTour/npcDialogue.js';
import { stepPedestrians } from '../../src/models/worldTour/worldPedestrians.js';

function scene() {
  const s = createSession(CITIES[0]);
  const person = s.pedestrians.find(p => p.guide);
  s.pedestrians = [person]; s.traffic = []; s.policeCars = [];
  return { s, person };
}
test('each city has a bounded, denser downtown and an accessible welcome conversation', () => {
  for (const city of CITIES) {
    const s = createSession(city);
    assert.ok(s.pedestrians.length >= 120 && s.pedestrians.length <= 150, `${city.id}: ${s.pedestrians.length}`);
    assert.ok(s.pedestrians.filter(p => Math.hypot(p.x, p.z) < 190).length >= 32);
    assert.equal(promptFor(s)?.action, 'talk');
    assert.ok(talk(s)); assert.ok(s.npcDialogue.text);
  }
});
test('random dialogue does not immediately repeat, input is rate limited, and history stays bounded', () => {
  const { s, person } = scene(), seen = new Set();
  for (let i = 0; i < 30; i++) {
    const before = s.npcDialogue?.text;
    assert.ok(talk(s)); assert.notEqual(s.npcDialogue.text, before);
    const current = s.npcDialogue;
    assert.equal(talk(s), false); assert.equal(s.npcDialogue, current);
    seen.add(current.text); s.time += 0.7;
  }
  assert.equal(seen.size, 3); assert.equal(person.lastDialogue, s.npcDialogue.text);
});
test('talk requires proximity, sight, matching height, and an available player and NPC', () => {
  const { s, person } = scene();
  assert.equal(nearbyNpc(s, clearSight), person);
  s.blocks = [{ x: 10.5, z: 14, width: 1, depth: 6 }]; assert.equal(talk(s), false);
  s.blocks = []; person.height = 8; assert.equal(talk(s), false); person.height = 0;
  person.x = 60; assert.equal(talk(s), false); person.x = 13;
  for (const flag of ['driving', 'boating', 'riding', 'seated', 'metro', 'down', 'stun']) {
    s[flag] = 1; assert.equal(talk(s), false, flag); s[flag] = false;
  }
  for (const state of [{ health: 0 }, { health: 100, knockdown: 1 }, { knockdown: 0, ragdoll: {} }]) {
    Object.assign(person, state); assert.equal(talk(s), false);
  }
});
test('dialogue uses roles and danger context, while hub healing keeps priority over E chat', () => {
  const { s, person } = scene();
  s.health = 50; interact(s); assert.equal(s.health, 100); assert.equal(s.npcDialogue, undefined);
  interact(s); assert.equal(s.npcDialogue.role, 'Neighborhood guide');
  s.time += 1; s.boss = { alive: true }; talk(s); assert.match(s.npcDialogue.text, /Aegis Titan/);
  s.time += 1; s.heat = 1; talk(s); assert.match(s.npcDialogue.text, /safe|sirens|crossing/);
  s.time += 1; s.heat = 0; s.boss = null; person.child = true; person.role = 'kid'; person.guide = false;
  talk(s); assert.equal(s.npcDialogue.role, 'Young explorer');
});
test('chat pauses a walker, walking away or timeout releases them, and danger never holds them still', () => {
  const { s, person } = scene(); person.idle = 0; person.pause = 99;
  talk(s); stepPedestrians(s, s.player, 0.05);
  assert.equal(person.moveZ, 0); assert.ok(person.talking);
  s.time = 10; stepNpcDialogue(s, clearSight); assert.equal(s.npcDialogue, null);
  stepPedestrians(s, s.player, 0.05); assert.ok(Math.abs(person.moveZ) > 0);
  talk(s); s.player.z = 60; stepNpcDialogue(s, clearSight); assert.equal(person.chatUntil, 0);
  s.player.z = 12; s.time += 1; talk(s);
  s.alarm = { x: person.x, z: person.z, radius: 50, time: s.time };
  stepPedestrians(s, s.player, 0.05); assert.ok(person.panic); assert.ok(Math.abs(person.moveZ) > 0);
  endNpcDialogue(s); assert.equal(person.talking, false);
});
test('conversations do not stop people in crossings and distant wanted activity does not panic the whole city', () => {
  const { s, person } = scene(); Object.assign(person, { x: 13, z: 0, idle: 0, pause: 99 });
  Object.assign(s.player, { x: 13, z: 3 }); talk(s);
  stepPedestrians(s, s.player, 0.05); assert.ok(Math.abs(person.moveZ) > 0);
  s.heat = 1; s.quiet = 0; s.player.x = 300;
  stepPedestrians(s, s.player, 0.05); assert.equal(person.panic, false);
});
test('a complete simulation keeps conversation motion finite and clears it when the player leaves on a vehicle', () => {
  const { s, person } = scene(); talk(s);
  for (let i = 0; i < 30; i++) stepWorld(s, {}, 0.05);
  assert.ok([person.x, person.z, person.heading, person.speed].every(Number.isFinite));
  assert.ok(s.npcDialogue); s.driving = true; stepWorld(s, {}, 0.05);
  assert.equal(s.npcDialogue, null); assert.equal(person.talking, false);
});
