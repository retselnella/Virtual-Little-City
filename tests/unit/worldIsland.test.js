import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, HUB, createSession, freePosition, generateBlocks, recover, stepWorld, toggleVehicle } from '../../src/models/worldTour/worldAdventure.js';
import { BUSHES, CABINS, CITY_EDGE, COUNTRY_TREES, FIELDS, FLOWERS, LAKE, LANDMARKS, LOGS, MOUNTAINS, ROAD_LAMPS, ROCKS, ROUTES, coastRadius, coastline, forestDensity, inLake, onIsland, regionAt, roadDistance, terrainHeight } from '../../src/models/worldTour/worldIsland.js';
import { formatClock, parseEnvironmentOverride, philippineTime, sunPosition, weatherFront, worldConditions } from '../../src/models/worldTour/worldClock.js';

function quietSession(city = CITIES[0]) {
  const s = createSession(city); s.traffic = []; s.pedestrians = [];
  s.policeCars.forEach((c, i) => Object.assign(c, { x: 420, z: -420 + i * 12, route: [], loop: false }));
  return s;
}
const run = (s, seconds, input = {}, yaw = Math.PI) => { for (let i = 0; i < seconds * 20; i++) stepWorld(s, input, 0.05, yaw); };

test('the city sits on an island with an organic, non-square coastline', () => {
  const radii = coastline(360).map(p => Math.hypot(p.x, p.z));
  assert.ok(Math.max(...radii) - Math.min(...radii) > 500, 'the coast is far from a square or circle');
  for (const [x, z] of [[455, 455], [-455, 455], [-455, -455], [455, -455]]) assert.ok(onIsland(x, z, 1), 'every city corner is on land');
  assert.ok(!onIsland(CITY_EDGE + 5, 0) && !onIsland(0, -1500) && !onIsland(-1600, 0), 'the ocean is not');
  assert.ok(onIsland(-900, 0) && onIsland(0, 900) && onIsland(0, -900), 'land continues well past the old city limits');
  // The east side is the city's straight waterfront; elsewhere the coast wanders.
  assert.ok(Math.abs(coastRadius(0) - CITY_EDGE) < 1);
});

test('roads, lamps, trees and mountains all fit on the island without overlapping', () => {
  for (const route of ROUTES) for (const p of route.points) assert.ok(onIsland(p.x, p.z, 8), `${route.id} stays on land`);
  for (const lamp of ROAD_LAMPS) assert.ok(onIsland(lamp.x, lamp.z, 1) && roadDistance(lamp.x, lamp.z) > 9, 'lamps stand beside the road');
  assert.ok(MOUNTAINS.length >= 20 && MOUNTAINS.some(m => m.snow) && MOUNTAINS.some(m => m.kind === 'hill'));
  for (const m of MOUNTAINS) {
    assert.ok(Math.hypot(m.x, m.z) + m.radius < coastRadius(Math.atan2(m.z, m.x)), `${m.id} is inland`);
    assert.ok(roadDistance(m.x, m.z) > m.radius, `${m.id} leaves the roads clear`);
    assert.ok(Math.abs(m.x) > CITY_EDGE + m.radius || Math.abs(m.z) > CITY_EDGE + m.radius, `${m.id} is outside the city`);
  }
  for (const tree of COUNTRY_TREES) {
    assert.ok(onIsland(tree.x, tree.z) && roadDistance(tree.x, tree.z) > 17 && !inLake(tree.x, tree.z), 'trees stay off roads and water');
    assert.ok(Math.abs(tree.y - Math.max(0, terrainHeight(tree.x, tree.z) - 0.4)) < 0.01, 'trees stand on the ground, including slopes');
  }
  assert.ok(terrainHeight(MOUNTAINS[0].x, MOUNTAINS[0].z) > 200 && terrainHeight(0, 0) === 0);
  assert.equal(regionAt(0, 0, 'Ocean Drive'), 'Ocean Drive');
  assert.equal(regionAt(MOUNTAINS[0].x, MOUNTAINS[0].z), 'Mount Alon');
  assert.equal(regionAt(-1170, 40), 'Lighthouse Cape');
});

test('city contract sites and spawn points are unchanged by the island', () => {
  for (const city of CITIES) {
    const blocks = generateBlocks(city);
    assert.ok(freePosition(8, 12, blocks));
    assert.ok(!freePosition(0, -1500, blocks));
  }
});

test('you can walk out of the city into the countryside, but not off the island', () => {
  const s = quietSession(); s.player = { ...s.player, x: -430, z: 0 };
  run(s, 3, { forward: true, run: true }, -Math.PI / 2);
  assert.ok(s.player.x < -455, `walked west past the old city wall (x = ${s.player.x.toFixed(1)})`);
  // East of the waterfront is the ocean: the shoreline stops you.
  s.player = { ...s.player, x: 440, z: 0, moveX: 0, moveZ: 0 };
  run(s, 3, { forward: true, run: true }, Math.PI / 2);
  assert.ok(s.player.x < CITY_EDGE, `stopped at the shore (x = ${s.player.x.toFixed(1)})`);
  // The summit is solid rock.
  const peak = MOUNTAINS[0]; s.player = { ...s.player, x: peak.x + peak.radius + 6, z: peak.z, moveX: 0, moveZ: 0 };
  run(s, 3, { forward: true, run: true }, -Math.PI / 2);
  assert.ok(Math.hypot(s.player.x - peak.x, s.player.z - peak.z) > peak.radius * 0.6, 'you cannot walk through a mountain');
});

test('the car can leave the city along the ring road', () => {
  const s = quietSession(); s.player = { ...s.player, x: 3, z: -430 }; s.car = { ...s.car, x: 0, z: -430, heading: Math.PI, vx: 0, vz: 0 };
  toggleVehicle(s); assert.ok(s.driving);
  run(s, 6, { forward: true });
  assert.ok(s.car.z < -470, `drove north out of the city (z = ${s.car.z.toFixed(1)})`);
  assert.ok(onIsland(s.car.x, s.car.z));
});

test('day and night follow Philippine time and the sun over Manila', () => {
  const noonPh = Date.UTC(2026, 8, 24, 4, 0), midnightPh = Date.UTC(2026, 8, 24, 16, 0);
  assert.equal(philippineTime(noonPh).hours, 12); assert.equal(formatClock(philippineTime(noonPh)), '12:00 PM');
  assert.equal(formatClock(philippineTime(midnightPh)), '12:00 AM');
  assert.ok(sunPosition(noonPh).elevation > 60 && sunPosition(midnightPh).elevation < -40);
  assert.equal(worldConditions(noonPh, 'clear').phase, 'day'); assert.equal(worldConditions(midnightPh, 'clear').phase, 'night');
  assert.ok(worldConditions(midnightPh, 'clear').night > 0.99 && worldConditions(noonPh, 'clear').daylight > 0.99);
  // Sunrise in Manila on 24 September is about 5:45 AM; sunset about 5:52 PM.
  const at = (h, m) => sunPosition(Date.UTC(2026, 8, 23, 16 + h, m)).elevation;
  assert.ok(at(5, 30) < -0.83 && at(6, 0) > -0.83); assert.ok(at(17, 40) > -0.83 && at(18, 5) < -0.83);
});

test('weather is one shared function of time: every city and player sees the same sky', () => {
  const t = Date.UTC(2026, 6, 10, 7, 13);
  assert.equal(weatherFront(t), weatherFront(t)); assert.deepEqual(worldConditions(t), worldConditions(t));
  // Over a long stretch every kind of weather occurs, and it changes gradually (no flicker minute to minute).
  const kinds = new Set(); let biggest = 0;
  for (let i = 0; i < 20000; i++) { const a = Date.UTC(2026, 0, 1) + i * 30 * 60000; kinds.add(worldConditions(a).kind); biggest = Math.max(biggest, Math.abs(weatherFront(a + 60000) - weatherFront(a))); }
  assert.deepEqual([...kinds].sort(), ['clear', 'cloudy', 'rain', 'storm']);
  assert.ok(biggest < 0.08, 'weather drifts smoothly');
  const rain = worldConditions(t, 'rain'), storm = worldConditions(t, 'storm');
  assert.equal(rain.kind, 'rain'); assert.ok(rain.rain > 0.5); assert.equal(storm.kind, 'storm');
  const preview = parseEnvironmentOverride('?clock=21:30&weather=storm', Date.UTC(2026, 8, 24, 4, 0));
  assert.equal(preview.weather, 'storm'); assert.equal(philippineTime(Date.UTC(2026, 8, 24, 4, 0) + preview.offset).hours, 21);
  assert.deepEqual(parseEnvironmentOverride('?clock=99:00&weather=snow', 0), { offset: 0, weather: null });
});

test('the countryside is a dense open world: forests, pines on the slopes, rocks, plants, fields, cabins and a lake', () => {
  const kinds = COUNTRY_TREES.reduce((n, t) => ({ ...n, [t.kind]: (n[t.kind] || 0) + 1 }), {});
  assert.ok(COUNTRY_TREES.length > 2500 && kinds.pine > 1000 && kinds.broad > 1000 && kinds.palm > 50, JSON.stringify(kinds));
  assert.ok(COUNTRY_TREES.filter(t => t.y > 0).length > 200, 'pines climb the mountainsides');
  // Forest is thick in the northern woods and thin on the southern farmland.
  const north = COUNTRY_TREES.filter(t => t.z < -600 && t.y === 0).length, south = COUNTRY_TREES.filter(t => t.z > 600 && t.x > -200 && t.y === 0).length;
  assert.ok(north > south * 2, `north ${north} vs south ${south}`);
  assert.ok(ROCKS.length >= 600 && ROCKS.some(r => r.solid) && ROCKS.some(r => r.y > 0) && LOGS.length >= 40);
  assert.ok(BUSHES.length >= 1000 && FLOWERS.length >= 1000);
  assert.ok(FIELDS.length >= 5 && CABINS.length >= 4);
  for (const c of [...CABINS, ...FIELDS]) assert.ok(onIsland(c.x, c.z, 10) && terrainHeight(c.x, c.z) === 0 && roadDistance(c.x, c.z) > 20);
  for (const t of COUNTRY_TREES) for (const c of CABINS) assert.ok(Math.hypot(t.x - c.x, t.z - c.z) > 12, 'no tree grows through a cabin');
  assert.ok(forestDensity(0, -900) > forestDensity(150, 700));
  assert.equal(regionAt(LANDMARKS.campsite.x, LANDMARKS.campsite.z), 'Lakeside Campsite');
});

test('the lake and the forest are solid: you walk around them, not through', () => {
  const s = quietSession(); s.player = { ...s.player, x: LAKE.x + LAKE.rx + 12, z: LAKE.z, moveX: 0, moveZ: 0 };
  run(s, 3, { forward: true, run: true }, -Math.PI / 2);
  assert.ok(!inLake(s.player.x, s.player.z), `stopped at the lake shore (x = ${s.player.x.toFixed(1)})`);
  const tree = COUNTRY_TREES.find(t => t.y === 0 && t.kind === 'broad');
  s.player = { ...s.player, x: tree.x - 4, z: tree.z, moveX: 0, moveZ: 0 };
  run(s, 1.5, { forward: true }, Math.PI / 2);
  assert.ok(Math.hypot(s.player.x - tree.x, s.player.z - tree.z) > 0.5, 'trees are solid');
});

test('everyone arrives at the City Hub, a real building beside the spawn forecourt', () => {
  for (const city of CITIES) {
    const hub = generateBlocks(city).filter(b => b.hub);
    assert.equal(hub.length, 1, city.id);
    assert.ok(Math.hypot(hub[0].x - HUB.x, hub[0].z - HUB.z) < 45, 'the hub is right next to the spawn point');
    assert.ok(freePosition(HUB.x, HUB.z, generateBlocks(city)), 'the forecourt itself is open');
  }
  const s = createSession(CITIES[2]);
  assert.deepEqual([s.player.x, s.player.z], [HUB.x, HUB.z]); assert.match(s.message, /City Hub/);
  s.player.x = 300; recover(s); assert.deepEqual([s.player.x, s.player.z], [HUB.x, HUB.z]); assert.match(s.message, /City Hub/);
});
