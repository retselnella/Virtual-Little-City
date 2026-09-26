import test from 'node:test';
import assert from 'node:assert/strict';
import { LOUNGE, SEATS, seatNear, venueAt } from '../../src/models/worldTour/venues.js';
import { CITIES, attack, createSession, generateBlocks, interact, promptFor, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { cleanState, encodeState } from '../../src/models/worldTour/multiplayer.js';
import { ambientGroups } from '../../src/models/worldTour/ambientLife.js';
import { islandFor } from '../../src/models/worldTour/worldIsland.js';

const miami = CITIES.find(c => c.id === 'miami');

test('every city has a lounge on a block of its own by the City Hub', () => {
  for (const city of CITIES) {
    const blocks = generateBlocks(city);
    assert.ok(!blocks.some(b => Math.abs(b.x - LOUNGE.x) < 60 && Math.abs(b.z - LOUNGE.z) < 60), `${city.id}: the lounge block is clear`);
    assert.ok(blocks.some(b => Math.abs(b.x + 60) < 60 && Math.abs(b.z + 60) < 60), `${city.id}: the old cinema block has its buildings back`);
    assert.ok(blocks.some(b => b.hub) && blocks.island, 'the City Hub stays');
  }
  assert.equal(venueAt(LOUNGE.x, LOUNGE.z + 20), 'lounge'); assert.equal(venueAt(-60, -60), null); assert.equal(venueAt(8, 12), null);
  assert.ok(SEATS.lounge.length >= 12, 'plenty of seats');
});

test('sit on a sofa with E, facing the dance floor; move to get up', () => {
  const s = createSession(miami); s.traffic = []; s.pedestrians = []; s.policeCars = [];
  const sofa = SEATS.lounge[0]; s.player = { ...s.player, x: sofa.x + 0.8, z: sofa.z };
  assert.equal(promptFor(s).text, 'Sit on the sofa');
  interact(s); assert.ok(s.seated && s.player.seated); assert.equal(s.player.heading, sofa.heading);
  for (let i = 0; i < 20; i++) stepWorld(s, {}, 0.05);
  assert.ok(Math.hypot(s.player.x - sofa.x, s.player.z - sofa.z) < 0.3, 'stays seated'); assert.equal(s.venue, 'lounge');
  s.cooldown = 0; const ammo = s.mags.pistol; attack(s); assert.equal(s.mags.pistol, ammo, 'no shooting from the sofa');
  assert.equal(promptFor(s).text, 'Get up');
  stepWorld(s, { forward: true }, 0.05); assert.equal(s.seated, null, 'moving gets you up'); assert.equal(s.player.seated, false);
  // Sofas other players are sitting on are taken.
  const other = SEATS.lounge[3];
  assert.equal(seatNear(other, new Set([`${other.x},${other.z}`]), 0.5), null);
  s.player = { ...s.player, x: other.x + 0.5, z: other.z }; assert.equal(promptFor(s).text, 'Sit on the sofa'); interact(s);
  assert.equal(s.seated.venue, 'lounge'); assert.equal(s.player.heading, other.heading, 'facing the dance floor');
  assert.equal(cleanState(encodeState(s, 1000)).si, true, 'other players see you sitting');
  interact(s); assert.equal(s.seated, null, 'E gets you up too');
  s.heat = 2; s.player = { ...s.player, x: other.x + 0.5, z: other.z }; assert.equal(promptFor(s), null, 'no sitting down while wanted');
});

test('the lounge has dancers (a bigger crowd at night) and a bar', () => {
  const groups = ambientGroups(islandFor('miami'), generateBlocks(miami), 3);
  const day = groups.find(g => g.id === 'lounge-day'), night = groups.find(g => g.id === 'lounge-night');
  assert.ok(night.members.length > day.members.length && day.members.every(m => m.pose === 'dance' && venueAt(m.x, m.z) === 'lounge'));
  assert.ok(groups.some(g => g.id === 'lounge-bar')); assert.ok(!groups.some(g => g.kind === 'cinema'), 'no cinema crowd');
});
