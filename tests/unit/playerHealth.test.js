import test from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH, hurtPlayer, markCombat, regenerateHealth, syncEventHealth } from '../../src/models/worldTour/playerHealth.js';
import { ATTACKS, attackAt, beamPoint, kaijuHazards } from '../../src/models/worldTour/worldBoss.js';
import { CITIES, createSession, interact, promptFor, recover, stepWorld } from '../../src/models/worldTour/worldAdventure.js';

const event = { id: 'fight', city: 'miami', startsAt: 100000, endsAt: 3700000, hp: 1000000, defeatedAt: null };
const player = (extra = {}) => ({ city: 'miami', health: 100, maxHealth: 100, time: 0, heat: 0, down: 0, worldTime: 101, bossEvent: { ...event }, ...extra });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ~= ${b}`);

test('event grants +500 once, expires on defeat, departure or timeout, and never revives a dead player', () => {
  const s = player({ health: 40 }); syncEventHealth(s);
  assert.equal(s.health, 540); assert.equal(s.maxHealth, 600);
  hurtPlayer(s, 20); syncEventHealth(s); assert.equal(s.health, 520, 'polling or repeated simulation steps cannot stack the buff');
  for (const change of [{ city: 'tokyo' }, { worldTime: 3700 }, { bossEvent: { ...event, hp: 0, defeatedAt: 101000 } }]) {
    const end = { ...s, ...change }; syncEventHealth(end);
    assert.equal(end.maxHealth, 100); assert.equal(end.health, 100); assert.equal(end.healthBuffEvent, null);
  }
  const injured = { ...s, health: 23, worldTime: 3700 }; syncEventHealth(injured); assert.equal(injured.health, 23, 'expiry does not heal or kill an injured survivor');
  const dead = player({ health: 0 }); syncEventHealth(dead); assert.equal(dead.health, 0);
  const waiting = player({ worldTime: 99 }); syncEventHealth(waiting); assert.equal(waiting.maxHealth, 100);
  const away = player({ city: 'tokyo' }); syncEventHealth(away); assert.equal(away.health, 100);
});

test('regen waits eight safe seconds after escape, heals gradually, and damage or attacks restart the delay', () => {
  const s = player({ bossEvent: null, health: 40, heat: 3 }); syncEventHealth(s);
  regenerateHealth(s, 30); assert.equal(s.health, 40, 'no regen during a pursuit');
  s.heat = 0; regenerateHealth(s, 7.9); assert.equal(s.health, 40);
  regenerateHealth(s, 0.2); near(s.health, 40.5);
  regenerateHealth(s, 1); near(s.health, 45.5);
  hurtPlayer(s, 10); regenerateHealth(s, 8); near(s.health, 35.5);
  regenerateHealth(s, 1); near(s.health, 40.5);
  markCombat(s); regenerateHealth(s, 8); near(s.health, 40.5);
  regenerateHealth(s, 50); assert.equal(s.health, 100, 'normal max health is never exceeded');
});

test('regen is frame-rate independent and blocked by nearby hostiles, the event, or being wasted', () => {
  const a = player({ bossEvent: null, health: 30 }), b = { ...a };
  for (let i = 0; i < 600; i++) regenerateHealth(a, 1 / 60);
  for (let i = 0; i < 1200; i++) regenerateHealth(b, 1 / 120);
  near(a.health, 40); near(a.health, b.health);
  regenerateHealth(a, 20, true); near(a.health, 40); assert.equal(a.regenQuiet, 0);
  const fighting = player({ health: 40 }); syncEventHealth(fighting); hurtPlayer(fighting, 100);
  regenerateHealth(fighting, 30); assert.equal(fighting.health, 440);
  const dead = player({ bossEvent: null, health: 0, down: 4 }); regenerateHealth(dead, 30); assert.equal(dead.health, 0);
});

test('City Hub healing and recovery restore the event maximum; the simulation regenerates normal health', () => {
  const s = createSession(CITIES[0]); s.traffic = []; s.pedestrians = []; s.policeCars = [];
  s.bossEvent = { ...event }; s.worldTime = 101; stepWorld(s, {}, 0.01);
  assert.equal(s.health, 600); hurtPlayer(s, 150);
  s.car.x = 80;
  assert.equal(promptFor(s).text, 'Heal at the City Hub'); interact(s); assert.equal(s.health, 600);
  s.health = 0; s.down = 4; recover(s); assert.equal(s.health, 600); assert.equal(s.maxHealth, 600);
  s.worldTime = 3700; stepWorld(s, {}, 0.01); assert.equal(s.health, 100); assert.equal(s.maxHealth, 100);
  s.traffic = []; s.pedestrians = []; s.policeCars = []; hurtPlayer(s, 60);
  for (let i = 0; i < 200; i++) stepWorld(s, {}, 0.05);
  near(s.health, 50);
});

test('Kaiju attacks remain survivable with the event buff and one-off damage cannot repeat per frame', () => {
  const attacks = new Map();
  for (let i = 0; attacks.size < Object.keys(ATTACKS).length && i < 100; i++) { const a = attackAt(7, i); attacks.set(a.type, a); }
  assert.equal(attacks.size, 6);
  const fullHealth = HEALTH.base + HEALTH.eventBonus;
  for (const [type, a] of attacks) {
    const memory = new Set(); let total = 0;
    for (let t = a.impact; t < a.end; t += 1 / 120) {
      const at = type === 'laser' ? beamPoint(a, (t - a.impact) / (a.end - a.impact))
        : type === 'meteors' ? a.shells.reduce((nearest, shell) => Math.abs(t - shell.at) < Math.abs(t - nearest.at) ? shell : nearest, a.shells[0])
          : type === 'roar' ? { x: a.from.x + 100, z: a.from.z } : a.target;
      total += kaijuHazards(7, t, at, memory, 1 / 120).reduce((sum, hit) => sum + hit.damage, 0);
    }
    assert.ok(total > 0, `${type} still hurts`);
    assert.ok(total <= fullHealth * 0.25, `${type} deals ${total}; even a full attack stays below a quarter of event health`);
  }
});
