import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, HUB, createSession, freePosition, generateBlocks, guidePoint, interact, promptFor, recover, setCourse, setWaypoint, stepWorld, toggleVehicle } from '../../src/models/worldTour/worldAdventure.js';
import { CITY_EDGE, MARINA, formT, islandFor, profile } from '../../src/models/worldTour/worldIsland.js';
import { ARRIVAL, inWater, voyage } from '../../src/models/worldTour/worldBoat.js';
import { METRO, STATIONS, arrivalIn, metroPillars, trainAt } from '../../src/models/worldTour/metro.js';
import { formatClock, parseEnvironmentOverride, philippineTime, sunPosition, weatherFront, worldConditions } from '../../src/models/worldTour/worldClock.js';

function quietSession(city = CITIES[0]) {
  const s = createSession(city); s.traffic = []; s.pedestrians = [];
  s.policeCars.forEach((c, i) => Object.assign(c, { x: 420, z: -420 + i * 12, route: [], loop: false }));
  return s;
}
const run = (s, seconds, input = {}, yaw = Math.PI, each) => { for (let i = 0; i < seconds * 20; i++) { stepWorld(s, input, 0.05, yaw); each?.(); } };
const ISLANDS = CITIES.map(c => islandFor(c.id));

test('every city has its own island: different coasts, landforms, forests and landmarks', () => {
  // Coastlines differ everywhere except the shared city waterfront.
  for (let a = 0; a < ISLANDS.length; a++) for (let b = a + 1; b < ISLANDS.length; b++) {
    const one = ISLANDS[a].coastline(90), two = ISLANDS[b].coastline(90);
    const diff = one.reduce((sum, p, i) => sum + Math.abs(Math.hypot(p.x, p.z) - Math.hypot(two[i].x, two[i].z)), 0) / 90;
    assert.ok(diff > 25, `${ISLANDS[a].id} and ${ISLANDS[b].id} coasts differ (${diff.toFixed(0)} m on average)`);
  }
  const by = id => islandFor(id), kinds = id => new Set(by(id).forms.map(f => f.kind));
  assert.ok(kinds('tokyo').has('volcano') && by('tokyo').forms.some(f => f.snow), 'Tokyo: snow-capped volcano');
  assert.ok(kinds('manila').has('volcano') && kinds('manila').has('terrace'), 'Manila: volcano and rice terraces');
  assert.ok(kinds('cape').has('frustum'), 'Cape Town: flat-topped mesa');
  assert.ok(kinds('rio').has('dome'), 'Rio: granite domes');
  assert.ok(by('dubai').trees.length < 200 && by('dubai').forms.filter(f => f.colors === 'dune').length >= 5, 'Dubai: desert dunes, few trees');
  assert.ok(by('tokyo').trees.some(t => t.kind === 'cherry') && by('miami').trees.some(t => t.kind === 'mangrove'));
  assert.equal(new Set(ISLANDS.map(i => i.landmarks.feature?.name)).size, CITIES.length, 'a different landmark on each island');
});

test('each island is consistent: the city fits, everything stands on land and off the roads', () => {
  for (const island of ISLANDS) {
    for (const [x, z] of [[455, 455], [-455, 455], [-455, -455], [455, -455]]) assert.ok(island.onIsland(x, z, 1), `${island.id} city corner`);
    assert.ok(!island.onIsland(CITY_EDGE + 5, 0) && !island.onIsland(0, -1900), `${island.id} ocean`);
    assert.ok(Math.abs(island.coastRadius(0) - CITY_EDGE) < 1, 'the waterfront is straight');
    for (const route of island.routes) for (const p of route.points) assert.ok(island.onIsland(p.x, p.z, 6), `${island.id} ${route.id} on land`);
    for (const f of island.forms) {
      assert.ok(island.roadDistance(f.x, f.z) > Math.min(f.rx, f.rz), `${island.id} ${f.name} off the roads`);
      assert.ok(island.terrainHeight(f.x, f.z) >= f.height - 1e-6, 'the terrain reaches each landform\'s peak');
    }
    for (const t of island.trees) {
      assert.ok(island.onIsland(t.x, t.z) && !island.inLake(t.x, t.z) && island.roadDistance(t.x, t.z) > 17, `${island.id} tree placement`);
      assert.ok(Math.abs(t.y - Math.max(0, island.terrainHeight(t.x, t.z) - 0.4)) < 0.01, 'trees stand on the ground');
    }
    for (const s of island.structures) if (s.house) assert.ok(island.onIsland(s.x, s.z, 3) && island.roadDistance(s.x, s.z) > 8, `${island.id} house off the road`);
    assert.ok(island.suburbs.length >= 1 && island.structures.filter(s => s.house).length >= 20, `${island.id} has a suburb`);
    assert.ok(island.lakes.length >= 1 && island.fields.length >= 3 && island.lamps.length > 30);
    const lh = island.landmarks.lighthouse; assert.ok(island.onIsland(lh.x, lh.z, 5) && island.regionAt(lh.x, lh.z) === 'Lighthouse');
  }
});

test('landform profiles are convex and match the physics hull', () => {
  for (const kind of ['cone', 'volcano', 'hill', 'terrace', 'dome']) for (let t = 0.05; t < 0.95; t += 0.05) {
    const f = { kind }, mid = profile(f, t), chord = (profile(f, t - 0.05) + profile(f, t + 0.05)) / 2;
    assert.ok(mid >= chord - 1e-9, `${kind} is convex at ${t.toFixed(2)}`);
  }
  const f = islandFor('cape').forms.find(x => x.kind === 'frustum');
  assert.ok(formT(f, f.x, f.z) === 0 && Math.abs(islandFor('cape').terrainHeight(f.x, f.z) - f.height) < 1e-6, 'the mesa is flat on top');
});

test('you can walk out into the countryside, but not into the sea, a lake or a mountain', () => {
  const s = quietSession(); s.player = { ...s.player, x: -430, z: 0 };
  run(s, 3, { forward: true, run: true }, -Math.PI / 2);
  assert.ok(s.player.x < -455, `walked west past the old city wall (x = ${s.player.x.toFixed(1)})`);
  s.player = { ...s.player, x: 440, z: 100, moveX: 0, moveZ: 0 };
  run(s, 3, { forward: true, run: true }, Math.PI / 2);
  assert.ok(s.player.x < CITY_EDGE, 'the shore stops you');
  const island = islandFor(s.city), lake = island.lakes[0];
  s.player = { ...s.player, x: lake.x + Math.cos(lake.turn) * (lake.rx + 14), z: lake.z + Math.sin(lake.turn) * (lake.rx + 14), moveX: 0, moveZ: 0 };
  const yaw = Math.atan2(lake.x - s.player.x, lake.z - s.player.z);
  run(s, 3, { forward: true, run: true }, yaw);
  assert.ok(!island.inLake(s.player.x, s.player.z), 'the lake shore stops you');
  const tokyo = quietSession(CITIES.find(c => c.id === 'tokyo')), peak = islandFor('tokyo').forms.find(f => f.kind === 'volcano');
  tokyo.player = { ...tokyo.player, x: peak.x + peak.rx + 6, z: peak.z, moveX: 0, moveZ: 0 };
  run(tokyo, 3, { forward: true, run: true }, -Math.PI / 2);
  assert.ok(formT(peak, tokyo.player.x, tokyo.player.z) > 0.6, 'the volcano is solid rock');
});

test('the car can leave the city along the ring road', () => {
  const s = quietSession(); s.player = { ...s.player, x: 3, z: -430 }; s.car = { ...s.car, x: 0, z: -430, heading: Math.PI, vx: 0, vz: 0 };
  toggleVehicle(s); assert.ok(s.driving);
  run(s, 6, { forward: true });
  assert.ok(s.car.z < -470 && islandFor(s.city).onIsland(s.car.x, s.car.z));
});

test('everyone arrives at the City Hub, a real building beside the spawn forecourt', () => {
  for (const city of CITIES) {
    const blocks = generateBlocks(city), hub = blocks.filter(b => b.hub);
    assert.equal(hub.length, 1); assert.ok(Math.hypot(hub[0].x - HUB.x, hub[0].z - HUB.z) < 45); assert.ok(freePosition(HUB.x, HUB.z, blocks));
  }
  const s = createSession(CITIES[2]); assert.deepEqual([s.player.x, s.player.z], [HUB.x, HUB.z]); assert.match(s.message, /City Hub/);
  s.player.x = 300; recover(s); assert.deepEqual([s.player.x, s.player.z], [HUB.x, HUB.z]);
});

test('the boat: board at the marina, sail round the island without beaching, land on the pier or a beach', () => {
  const s = quietSession(), island = islandFor(s.city);
  assert.ok(inWater(island, MARINA.mooring.x, MARINA.mooring.z), 'the boat is moored in open water');
  s.player = { ...s.player, x: MARINA.mooring.x, z: MARINA.z, moveX: 0, moveZ: 0 };
  assert.equal(promptFor(s).text, 'Take the boat');
  toggleVehicle(s); assert.ok(s.boating);
  run(s, 6, { forward: true, run: true });
  assert.ok(s.boat.x > MARINA.x1 + 60, `sailed out to sea (x = ${s.boat.x.toFixed(0)})`);
  run(s, 3, { forward: true, right: true, run: true });
  let minShore = Infinity; run(s, 10, { forward: true, run: true }, Math.PI, () => { minShore = Math.min(minShore, Math.hypot(s.boat.x, s.boat.z) - island.coastRadius(Math.atan2(s.boat.z, s.boat.x))); });
  assert.ok(minShore > 0, 'never on land');
  // Back alongside the pier, slow, and step off onto it.
  Object.assign(s.boat, { x: 520, z: MARINA.z + 9, speed: 0 });
  toggleVehicle(s); assert.ok(!s.boating && Math.abs(s.player.z - MARINA.z) < 1 && s.player.x > MARINA.x0);
  run(s, 1); assert.ok(Math.abs(s.player.z - MARINA.z) < 3, 'the pier holds you');
});

test('sailing to another island takes a real crossing in the right direction', () => {
  const miami = CITIES.find(c => c.id === 'miami'), tokyo = CITIES.find(c => c.id === 'tokyo'), rio = CITIES.find(c => c.id === 'rio');
  const east = voyage(miami, tokyo), south = voyage(miami, rio);
  assert.ok(Math.sin(east.bearing) > 0.9, 'Tokyo lies east of Miami'); assert.ok(Math.cos(south.bearing) > 0.8, 'Rio lies south of Miami');
  assert.ok(east.total > south.total && south.total >= 900);
  const s = quietSession(miami); assert.ok(setCourse(s, 'tokyo'));
  assert.equal(guidePoint(s).label, 'Marina pier', 'the GPS leads to the boat');
  s.boating = true; Object.assign(s.boat, { x: 1700, z: MARINA.z, heading: s.course.bearing, speed: 0 });
  let t = 0; while (!s.arrival && t < 400) { stepWorld(s, { forward: true, run: true }, 0.05); t += 0.05; }
  assert.equal(s.arrival, 'tokyo'); assert.ok(t > 30, `the crossing takes a while (${t.toFixed(0)} s)`);
  const arrived = createSession(tokyo, {}, null, 'boat');
  assert.ok(arrived.boating && arrived.boat.x === ARRIVAL.x && /marina/i.test(arrived.message));
});

test('the metro runs a timetable over the alleys and can be ridden between stations', () => {
  for (const p of metroPillars()) {
    const along = Math.abs(p.z) === 180 ? p.x : p.z;
    assert.ok(Math.abs(along - Math.round(along / 120) * 120) >= 20, 'pillars never stand in a road');
  }
  for (const city of CITIES) for (const p of metroPillars()) assert.ok(freePosition(p.x, p.z, generateBlocks(city), 0.8), 'pillars stand in the alleys, clear of buildings');
  const stops = new Set(); for (let t = 0; t < 200; t += 0.5) { const train = trainAt(t); if (train.station !== null) stops.add(train.station); }
  assert.equal(stops.size, STATIONS.length);
  const s = quietSession(); s.worldTime = 0;
  const st = STATIONS[1]; s.player = { ...s.player, x: st.exit.x, z: st.exit.z, moveX: 0, moveZ: 0 };
  assert.match(promptFor(s).text, /metro/); interact(s); assert.ok(s.metro && !s.riding);
  const wait = arrivalIn(0, 1); for (let t = 0; t <= wait + 1 && !s.riding; t += 0.05) { s.worldTime = t; stepWorld(s, {}, 0.05); }
  assert.ok(s.riding, 'boarded when the train stopped'); assert.equal(s.train.y, METRO.deck);
  let t = s.worldTime; while (t < 400) { t += 0.5; s.worldTime = t; stepWorld(s, {}, 0.05); if (s.train.station === 2) break; }
  interact(s); assert.ok(!s.riding && Math.hypot(s.player.x - STATIONS[2].exit.x, s.player.z - STATIONS[2].exit.z) < 1, 'got off at the next station');
});

test('GPS waypoints guide you and clear on arrival', () => {
  const s = quietSession(); setWaypoint(s, { x: 8, z: -120, label: 'Test point' });
  assert.equal(guidePoint(s).label, 'Test point');
  s.player = { ...s.player, x: 8, z: -115 }; stepWorld(s, {}, 0.05);
  assert.equal(s.waypoint, null); assert.match(s.message, /arrived/);
});

test('day and night follow Philippine time and the sun over Manila', () => {
  const noonPh = Date.UTC(2026, 8, 24, 4, 0), midnightPh = Date.UTC(2026, 8, 24, 16, 0);
  assert.equal(formatClock(philippineTime(noonPh)), '12:00 PM'); assert.equal(formatClock(philippineTime(midnightPh)), '12:00 AM');
  assert.ok(sunPosition(noonPh).elevation > 60 && sunPosition(midnightPh).elevation < -40);
  assert.equal(worldConditions(noonPh, 'clear').phase, 'day'); assert.equal(worldConditions(midnightPh, 'clear').phase, 'night');
  const at = (h, m) => sunPosition(Date.UTC(2026, 8, 23, 16 + h, m)).elevation;
  assert.ok(at(5, 30) < -0.83 && at(6, 0) > -0.83); assert.ok(at(17, 40) > -0.83 && at(18, 5) < -0.83);
});

test('weather is one shared function of time: every city and player sees the same sky', () => {
  const t = Date.UTC(2026, 6, 10, 7, 13);
  assert.deepEqual(worldConditions(t), worldConditions(t));
  const kinds = new Set(); let biggest = 0;
  for (let i = 0; i < 20000; i++) { const a = Date.UTC(2026, 0, 1) + i * 30 * 60000; kinds.add(worldConditions(a).kind); biggest = Math.max(biggest, Math.abs(weatherFront(a + 60000) - weatherFront(a))); }
  assert.deepEqual([...kinds].sort(), ['clear', 'cloudy', 'rain', 'storm']); assert.ok(biggest < 0.08);
  const preview = parseEnvironmentOverride('?clock=21:30&weather=storm', Date.UTC(2026, 8, 24, 4, 0));
  assert.equal(preview.weather, 'storm'); assert.equal(philippineTime(Date.UTC(2026, 8, 24, 4, 0) + preview.offset).hours, 21);
  assert.deepEqual(parseEnvironmentOverride('?clock=99:00&weather=snow', 0), { offset: 0, weather: null });
});
