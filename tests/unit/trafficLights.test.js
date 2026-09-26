import test from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE, SIGNAL, STOP_LINE, signalAt, signalHeads, stopLineAhead } from '../../src/models/worldTour/trafficLights.js';
import { vehicle } from '../../src/models/worldTour/worldPhysics.js';
import { CITIES, createSession, stepWorld } from '../../src/models/worldTour/worldAdventure.js';

test('the two directions take turns and are never green together; the cycle is shared by everyone', () => {
  let greens = { ns: 0, ew: 0 };
  for (let t = 0; t < CYCLE; t += 0.1) {
    const ns = signalAt(t, 'ns'), ew = signalAt(t, 'ew');
    assert.ok(!(ns !== 'red' && ew !== 'red'), `both open at ${t.toFixed(1)}: ${ns}/${ew}`);
    if (ns === 'green') greens.ns += 0.1; if (ew === 'green') greens.ew += 0.1;
  }
  assert.ok(Math.abs(greens.ns - SIGNAL.green) < 0.3 && Math.abs(greens.ew - SIGNAL.green) < 0.3, 'equal green time');
  assert.equal(signalAt(1_700_000_000.5, 'ns'), signalAt(1_700_000_000.5 + CYCLE * 3, 'ns'), 'the world clock decides, for every player');
  assert.equal(signalHeads().length, 49 * 8);
});

test('drivers stop at the line on red, run a late yellow, and ignore lights off the avenues', () => {
  const red = SIGNAL.green + SIGNAL.yellow + 0.5, yellow = SIGNAL.green + 0.5; // for north–south traffic
  const car = { x: -4, z: -50, heading: 0, vx: 0, vz: 10 };
  assert.equal(stopLineAhead(car, red), 50 - STOP_LINE);
  assert.equal(stopLineAhead(car, 0), null, 'green');
  assert.equal(stopLineAhead({ ...car, z: -16, vz: 15 }, yellow), null, 'too close to stop on yellow: go');
  assert.equal(typeof stopLineAhead({ ...car, z: -45, vz: 8 }, yellow), 'number', 'far enough: stop on yellow');
  assert.equal(stopLineAhead({ ...car, z: -5 }, red), null, 'already in the crossing: clear it');
  assert.equal(stopLineAhead({ ...car, x: -60 }, red), null, 'not on an avenue');
  assert.equal(stopLineAhead({ ...car, z: -200 }, red), null, 'too far from the next crossing to care yet');
  const eastbound = { x: -160, z: 4, heading: Math.PI / 2, vx: 10, vz: 0 };
  assert.equal(stopLineAhead(eastbound, 0), 40 - STOP_LINE, 'east–west traffic is red while north–south is green');
});

test('in the city, a traffic car waits at a red light and drives on at green', () => {
  const s = createSession(CITIES[0]); s.pedestrians = []; s.policeCars = []; s.player.x = 300; s.player.z = 300;
  const car = vehicle('t', -4, -80, 0); car.route = [{ x: -4, z: 100 }]; car.loop = false; s.traffic = [car];
  s.worldTime = SIGNAL.green + SIGNAL.yellow + 0.1; // north–south red for a while
  for (let i = 0; i < 160; i++) { stepWorld(s, {}, 0.05); s.worldTime += 0.05; }
  assert.ok(car.z < -STOP_LINE + 1 && car.z > -STOP_LINE - 8, `stopped at the line: z=${car.z.toFixed(1)}`);
  assert.ok(Math.hypot(car.vx, car.vz) < 0.5);
  for (let i = 0; i < 400 && car.z < 20; i++) { stepWorld(s, {}, 0.05); s.worldTime += 0.05; }
  assert.ok(car.z >= 20, 'went on when the light turned green');
  assert.ok(signalAt(s.worldTime, 'ns') !== 'red' || car.z >= 20);
});

test('people wait at the kerb for the walk signal and a gap, and cars stop behind the crosswalk', () => {
  const s = createSession(CITIES[0]); s.policeCars = []; s.traffic = []; s.player.x = -30; s.player.z = -40;
  const walker = s.pedestrians.find(p => p.leader === null && !p.child);
  s.pedestrians = [walker]; s.respawnCheck = 1e9; // nobody is sent off to fill street spots mid-test
  Object.assign(walker, { axis: 'x', lane: -13, x: -20, z: -13, direction: 1, idle: 0, pause: 999, mode: 'walk', spotCheck: 999, home: null, walk: 1.6, role: 'business' });
  // North–south traffic has green: the walker waits at the kerb before crossing the north–south road at x = 0.
  s.worldTime = 1; for (let i = 0; i < 100; i++) { stepWorld(s, {}, 0.05); s.worldTime += 0.05; }
  assert.ok(walker.x < -10.4 && walker.x > -14, `waiting at the kerb (x=${walker.x.toFixed(1)})`);
  // When north–south traffic gets red, they cross, briskly.
  s.worldTime = SIGNAL.green + SIGNAL.yellow + 0.2;
  for (let i = 0; i < 260 && walker.x < 11; i++) { stepWorld(s, {}, 0.05); s.worldTime += 0.05; }
  assert.ok(walker.x > 11, `crossed on red for the cars (x=${walker.x.toFixed(1)})`);
  // A car waiting at red stops clear of the crosswalk (13 m from the crossing's centre).
  const car = vehicle('t', -4, -80, 0); car.route = [{ x: -4, z: 100 }]; car.loop = false; s.traffic = [car]; s.pedestrians = [];
  s.worldTime = SIGNAL.green + SIGNAL.yellow + 0.1;
  for (let i = 0; i < 160; i++) { stepWorld(s, {}, 0.05); s.worldTime += 0.05; }
  assert.ok(car.z + car.radius < -13.5, `front of the car behind the crosswalk (z=${car.z.toFixed(1)})`);
});
