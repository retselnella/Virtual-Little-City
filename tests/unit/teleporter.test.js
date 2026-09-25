import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, atTeleporter, createSession, freePosition, generateBlocks, interact, promptFor, startContract, teleporterAt, travelBlocked } from '../../src/models/worldTour/worldAdventure.js';
import { sceneryLayout } from '../../src/models/worldTour/worldLayout.js';

test('every city has a teleporter pad on the City Hub forecourt, clear of buildings and street furniture', () => {
  const { spots } = sceneryLayout();
  for (const city of CITIES) {
    const blocks = generateBlocks(city), pad = teleporterAt(blocks), hub = blocks.find(b => b.hub);
    assert.ok(freePosition(pad.x, pad.z, blocks, 2.5), city.id);
    assert.ok(Math.hypot(pad.x - hub.x, pad.z - hub.z) < 30, `${city.id}: beside the City Hub`);
    for (const spot of spots) assert.ok(Math.hypot(spot.x - pad.x, spot.z - pad.z) > 8, `${city.id}: clear of ${spot.id}`);
  }
});

test('standing on the pad offers teleporting; it is locked while wanted, on a contract or down', () => {
  const s = createSession(CITIES[0]); s.pedestrians = [];
  assert.equal(atTeleporter(s), false);
  s.player.x = s.teleporter.x; s.player.z = s.teleporter.z;
  assert.equal(promptFor(s).text, 'Teleport to another island');
  interact(s); assert.equal(s.teleporting, true);
  s.teleporting = false; s.heat = 1; interact(s); assert.equal(s.teleporting, false); assert.match(s.message, /locked.*police/);
  s.heat = 0; startContract(s, 'courier'); assert.match(travelBlocked(s), /contract/); interact(s); assert.equal(s.teleporting, false);
  s.driving = true; assert.equal(atTeleporter(s), false, 'on foot only');
});

test('teleporting arrives on the destination pad, facing the City Hub, with progress kept', () => {
  const s = createSession(CITIES.find(c => c.id === 'dubai'), { cash: 900, owned: ['pistol', 'rifle'] }, null, 'teleport');
  assert.ok(Math.hypot(s.player.x - s.teleporter.x, s.player.z - s.teleporter.z) < 7, 'beside the pad');
  assert.ok(freePosition(s.player.x, s.player.z, s.blocks, 1));
  assert.match(s.message, /Teleported to Dubai/); assert.equal(s.cash, 900); assert.deepEqual(s.owned, ['pistol', 'rifle']);
  assert.equal(s.boating, false);
});
