import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCheat, CHEAT_CODES } from '../../src/models/worldTour/cheatCodes.js';
import { CITIES, createSession, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { HELI, updateHelicopters } from '../../src/models/worldTour/policeAir.js';
import { disposePhysics } from '../../src/models/worldTour/physicsEngine.js';

const quiet = () => { const s = createSession(CITIES[0]); s.traffic = []; s.pedestrians = []; s.policeCars = []; s.car.x = 300; return s; };
const run = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 20; i++) stepWorld(s, input, 0.05); };

test('suggested local codes toggle, heal, clear wanted stars and reject arbitrary input', () => {
  const s = quiet();
  assert.ok(CHEAT_CODES.length >= 5); assert.match(applyCheat(s, 'help'), /SKYHIGH/);
  assert.match(applyCheat(s, ' /flash '), /ON/); assert.equal(s.cheats.speed, true);
  assert.match(applyCheat(s, 'FLASH'), /OFF/);
  s.health = 20; applyCheat(s, 'PATCHUP'); assert.equal(s.health, 100);
  s.heat = 5; applyCheat(s, 'GHOSTED'); assert.equal(s.heat, 0);
  const before = JSON.stringify(s.cheats); assert.match(applyCheat(s, 'alert(1)'), /Unknown/); assert.equal(JSON.stringify(s.cheats), before);
  s.down = 4; assert.match(applyCheat(s, 'SKYHIGH'), /back on your feet/); assert.equal(s.cheats.fly, undefined);
  s.down = 0; s.driving = true; assert.match(applyCheat(s, 'SKYHIGH'), /street first/);
  assert.equal(s.cash, 0); assert.deepEqual(s.bossHits, {});
});

test('flight rises, hovers, descends and resets to gravity using the real character controller', () => {
  const s = quiet(); applyCheat(s, 'SKYHIGH'); run(s, 1, { jump: true });
  assert.ok(s.player.height > 15, `rose to ${s.player.height}`);
  const hover = s.player.height; run(s, 1); assert.ok(Math.abs(s.player.height - hover) < 0.1, 'hover does not sink');
  run(s, 0.4, { descend: true }); assert.ok(s.player.height < hover - 5);
  const height = s.player.height; applyCheat(s, 'RESET'); run(s, 0.5); assert.ok(s.player.height < height - 1, 'gravity returns');
  assert.deepEqual(s.cheats, {}); disposePhysics(s);
});

test('FLASH runs faster, MOONBOOTS jumps higher, and movement modes carry across city travel', () => {
  const normal = quiet(), fast = quiet(); applyCheat(fast, 'FLASH');
  run(normal, 0.5, { forward: true }); run(fast, 0.5, { forward: true });
  assert.ok(fast.player.speed > normal.player.speed * 2.5);
  const a = quiet(), b = quiet(); applyCheat(b, 'MOONBOOTS'); run(a, 0.3, { jump: true }); run(b, 0.3, { jump: true });
  assert.ok(b.player.height > a.player.height * 1.5);
  assert.equal(createSession(CITIES[1], fast).cheats.speed, true);
  for (const s of [normal, fast, a, b]) disposePhysics(s);
});

test('police and media fly in from far away without remote spotlight locks; media never spots for police', () => {
  const s = quiet(); s.heat = 5; s.unseen = 0; s.lastSeen = { x: 8, z: 12 };
  const at = { x: 8, z: 12 }; let damage = 0;
  for (let i = 0; i < 160; i++) updateHelicopters(s, at, 0.05, { hurt: n => { damage += n; } });
  assert.ok(s.newsHelicopter, 'news coverage dispatched separately');
  for (const h of [...s.helicopters, s.newsHelicopter]) {
    assert.ok(Math.hypot(h.x - at.x, h.z - at.z) > HELI.sight);
    assert.equal(h.spotting, false);
    assert.ok(Math.hypot(h.light.x - at.x, h.light.z - at.z) > 100, 'distant beam stays near the aircraft');
    assert.ok(Math.hypot(h.light.x - h.x, h.light.z - h.z) <= HELI.sight + 0.01);
  }
  assert.equal(damage, 0, 'no marksman hits during the distant approach');
  const h = s.helicopters[0]; h.x = at.x + 30; h.z = at.z; h.y = 44; h.vx = h.vz = 0; h.light = { x: at.x + 40, z: at.z };
  updateHelicopters(s, at, 0.05); assert.equal(h.spotting, true);
  assert.ok(Math.abs(h.light.x - at.x) > 1, 'beam eases onto the player rather than snapping');
  s.heat = 0; for (let i = 0; i < 1200 && (s.helicopters.length || s.newsHelicopter); i++) updateHelicopters(s, at, 0.05);
  assert.equal(s.helicopters.length, 0); assert.equal(s.newsHelicopter, null);
});
