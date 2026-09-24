import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CONTRACTS, createSession, interact, missionSteps, startContract, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { missionTask } from '../../src/models/worldTour/presentation.js';

const miami = CITIES[0];
// Put the player's current body (on foot here) at a point, then run one simulation step.
const visit = (s, point) => { s.player.x = point.x; s.player.z = point.z; stepWorld(s, {}, 0.02); };
const quiet = s => { s.traffic = []; s.policeCars = []; s.pedestrians = []; };

test('six contracts per city, 42 in all, each with reachable steps', () => {
  assert.equal(CONTRACTS.length, 6);
  assert.deepEqual(CONTRACTS.map(c => c.id), ['courier', 'crew', 'escape', 'race', 'tour', 'bounty']);
  for (const city of CITIES) for (const c of CONTRACTS) assert.ok(missionSteps(city.id, c.id).length >= 2, `${city.id} ${c.id}`);
});

test('the ring road sprint: checkpoints in order, a clock that starts at the first, a retry when time runs out', () => {
  const s = createSession(miami); quiet(s);
  assert.ok(startContract(s, 'race'));
  const steps = missionSteps('miami', 'race');
  assert.equal(steps.length, 7); assert.match(missionTask(s, CONTRACTS[3]), /first checkpoint/);
  visit(s, steps[2]); assert.equal(s.mission.stage, 0, 'checkpoints only count in order');
  visit(s, steps[0]); assert.equal(s.mission.stage, 1); assert.ok(s.mission.deadline > s.time);
  assert.match(missionTask(s, CONTRACTS[3]), /Checkpoint 2\/7 · 150 s left/);
  s.player.x = 8; s.player.z = 12; s.time = s.mission.deadline + 1; stepWorld(s, {}, 0.02); assert.equal(s.mission.stage, 0, 'out of time: back to the start');
  for (const point of steps) visit(s, point);
  assert.equal(s.mission, null); assert.equal(s.cash, 1100); assert.ok(s.completed.includes('miami:race'));
});

test('the island tour visits each sight in order and pays at the last one, once the police have lost you', () => {
  const s = createSession(CITIES.find(c => c.id === 'dubai')); quiet(s);
  startContract(s, 'tour'); const steps = missionSteps('dubai', 'tour');
  assert.equal(steps.at(-1).label, 'The marina', 'islands without a campsite end at the marina');
  for (const point of steps.slice(0, -1)) visit(s, point);
  s.heat = 1; visit(s, steps.at(-1)); assert.ok(s.mission, 'no payout while wanted');
  s.heat = 0; visit(s, steps.at(-1)); assert.equal(s.mission, null); assert.equal(s.cash, 800);
});

test('the bounty: a tough boss with bodyguards; report to the City Hub once the boss is down', () => {
  const s = createSession(miami); quiet(s);
  startContract(s, 'bounty');
  const boss = s.enemies.find(e => e.boss);
  assert.equal(boss.health, 300); assert.equal(s.enemies.filter(e => e.kind === 'gang').length, 3);
  const [target] = missionSteps('miami', 'bounty');
  s.player.x = target.x; s.player.z = target.z; interact(s); assert.equal(s.mission.stage, 0, 'the boss must be taken down first');
  boss.health = 0; stepWorld(s, {}, 0.02); assert.equal(s.mission.stage, 1);
  s.heat = 0; s.player.x = 8; s.player.z = 12; interact(s);
  assert.equal(s.mission, null); assert.equal(s.cash, 1600);
});
