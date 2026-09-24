// The island every city sits on. The street grid stays in the middle (|x|, |z| < 455) with its waterfront on the east
// coast; around it are countryside, a ring road, beaches, a lighthouse cape and a mountain range to the north-west.
// Shared by the renderer (visuals), the physics world (coast walls, mountain and tree colliders) and gameplay (where
// actors may stand), so all three always agree. Angles are atan2(z, x): 0 is east, +90° south, ±180° west, -90° north.
export const CITY_EDGE = 470, ISLAND_EXTENT = 1400, SHORE_INSET = 14, RING_RADIUS = 580, ROAD_WIDTH = 17;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

// Radius of the organic coast by compass angle (degrees), smoothed with a periodic Catmull-Rom spline.
const COAST = [[0, 900], [30, 900], [50, 900], [62, 880], [80, 960], [100, 1100], [125, 1180], [150, 1040], [175, 1250], [200, 1150], [225, 1300], [250, 1210], [270, 1100], [290, 1000], [305, 900], [320, 900], [340, 900]];
function spline(angle) {
  const deg = ((angle / DEG) % 360 + 360) % 360, n = COAST.length;
  let i = COAST.findIndex(([a], k) => deg >= a && deg < (COAST[k + 1]?.[0] ?? 360));
  const at = k => COAST[(k + n) % n], span = ((at(i + 1)[0] - at(i)[0]) + 360) % 360 || 360, t = (deg - at(i)[0]) / span;
  const [p0, p1, p2, p3] = [at(i - 1)[1], at(i)[1], at(i + 1)[1], at(i + 2)[1]];
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
// Distance from the island centre to the waterline at an angle. The east side is the city's straight waterfront.
export function coastRadius(angle) {
  const wobble = 14 * Math.sin(angle * 11 + 0.8) + 9 * Math.sin(angle * 23 + 2.1);
  const organic = spline(angle) + wobble, c = Math.cos(angle);
  return c > 0.05 ? Math.min(organic, CITY_EDGE / c) : organic;
}
// Is (x, z) dry land that an actor of this radius can stand on (inside the shoreline walls)?
export function onIsland(x, z, radius = 0) {
  const r = Math.hypot(x, z);
  return r < 400 || r < coastRadius(Math.atan2(z, x)) - SHORE_INSET - radius;
}
// The coastline as a closed polygon (for the ground mesh, map and shoreline colliders).
export function coastline(points = 180, inset = 0) {
  return Array.from({ length: points }, (_, i) => {
    const angle = -Math.PI + i / points * TAU, r = coastRadius(angle) - inset;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
  });
}

// The ring road: a rounded square around the city that ends at the beaches north and south of the waterfront.
export function ringRadius(angle) { const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle)); return RING_RADIUS / (c ** 4 + s ** 4) ** 0.25; }
function ringRoad() {
  const points = [];
  for (let deg = -40; deg >= -320; deg -= 2.5) {
    const a = deg * DEG, r = ringRadius(a), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x < CITY_EDGE - 45) points.push({ x, z });
  }
  // Both ends run out to a turnaround on the beach beside the waterfront.
  return [{ x: CITY_EDGE - 30, z: points[0].z }, ...points, { x: CITY_EDGE - 30, z: points.at(-1).z }];
}
// Roads outside the city grid, as polylines. Connectors join the grid's edge to the ring; a scenic road runs to the cape.
export const ROUTES = Object.freeze([
  { id: 'ring', name: 'Ring Road', points: ringRoad() },
  { id: 'north', name: 'North Link', points: [{ x: 0, z: -438 }, { x: 0, z: -RING_RADIUS }] },
  { id: 'south', name: 'South Link', points: [{ x: 0, z: 438 }, { x: 0, z: RING_RADIUS }] },
  { id: 'west', name: 'West Link', points: [{ x: -438, z: 0 }, { x: -RING_RADIUS, z: 0 }] },
  { id: 'cape', name: 'Cape Road', points: [{ x: -RING_RADIUS, z: 0 }, { x: -760, z: 40 }, { x: -930, z: 70 }, { x: -1080, z: 60 }, { x: -1150, z: 25 }] },
]);
function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
export function roadDistance(x, z) {
  let best = Infinity;
  for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) best = Math.min(best, segmentDistance({ x, z }, route.points[i - 1], route.points[i]));
  return best;
}

// Mountains are cones: a steep range to the north-west (too steep to climb) and gentle hills to the south-west that you
// can walk or drive over. The layout is seeded so every player gets the same island.
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function buildMountains() {
  const random = seeded(4242), list = [];
  // Each cone fits in the band between the ring road and the beach, overlapping its neighbours like a real range.
  const place = (angle, size, height, kind, where = random()) => {
    const inner = ringRadius(angle) + ROAD_WIDTH + 25, outer = coastRadius(angle) - 80, radius = Math.min(size, (outer - inner) / 2);
    if (radius < 40) return;
    const distance = inner + radius + where * (outer - inner - 2 * radius), x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    if (roadDistance(x, z) < radius + ROAD_WIDTH) return;
    if (list.some(m => Math.hypot(m.x - x, m.z - z) < (m.radius + radius) * 0.4)) return;
    list.push({ id: `mountain:${list.length}`, x, z, radius, height: height * radius / size, kind, snow: height * radius / size > 150 });
  };
  place(228 * DEG, 190, 240, 'peak', 0.45); // Mount Alon, the island's summit
  for (let i = 0; i < 90 && list.length < 34; i++) place((194 + random() * 76) * DEG, 70 + random() * 110, 80 + random() * 130, 'range');
  for (let i = 0; i < 60 && list.length < 48; i++) place((102 + random() * 46) * DEG, 80 + random() * 60, 20 + random() * 26, 'hill');
  return list;
}
export const MOUNTAINS = Object.freeze(buildMountains());
// Height of the terrain (mountain surface) at a point; 0 on the flat.
export function terrainHeight(x, z) {
  let h = 0;
  for (const m of MOUNTAINS) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.radius) h = Math.max(h, m.height * (1 - d / m.radius)); }
  return h;
}

// Street lamps along the outer roads, alternating sides (solid, like the city's lamp posts but not knocked over).
function buildLamps() {
  const lamps = [];
  for (const route of ROUTES) {
    let travelled = 0, next = 20;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i], length = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
      for (; next < travelled + length; next += 70) {
        const t = (next - travelled) / length, side = lamps.length % 2 ? 1 : -1;
        const x = a.x + (b.x - a.x) * t + nx * side * 13, z = a.z + (b.z - a.z) * t + nz * side * 13;
        if (Math.abs(x) < CITY_EDGE && Math.abs(z) < CITY_EDGE) continue;
        lamps.push({ x, z, heading: Math.atan2(-nx * side, -nz * side) });
      }
      travelled += length;
    }
  }
  // Drop lamps that would stand on another road (at junctions) or crowd a neighbour.
  return lamps.filter((lamp, i) => roadDistance(lamp.x, lamp.z) > 11 && lamps.findIndex(other => Math.hypot(other.x - lamp.x, other.z - lamp.z) < 25) === i);
}
export const ROAD_LAMPS = Object.freeze(buildLamps());

export const LANDMARKS = Object.freeze({
  lighthouse: { x: -1180, z: 30, radius: 5, height: 34 },
  pier: { x: -1150, z: 25 },
});
// Countryside trees: palms near the beaches, the city's own tree type inland. Each one is solid.
function buildTrees() {
  const random = seeded(777), trees = [];
  for (let i = 0; trees.length < 340 && i < 6000; i++) {
    const angle = random() * TAU, r = 300 + random() * 1100, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (Math.abs(x) < CITY_EDGE + 25 && Math.abs(z) < CITY_EDGE + 25) continue;
    const shore = coastRadius(angle) - SHORE_INSET - r;
    if (shore < 12 || roadDistance(x, z) < ROAD_WIDTH + 6 || terrainHeight(x, z) > 0) continue;
    if (ROAD_LAMPS.some(l => Math.hypot(l.x - x, l.z - z) < 8)) continue;
    if (Math.hypot(x - LANDMARKS.lighthouse.x, z - LANDMARKS.lighthouse.z) < 40) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 14)) continue;
    trees.push({ x, z, radius: 0.4, height: 9 + random() * 5, beach: shore < 70, scale: 0.8 + random() * 0.6 });
  }
  return trees;
}
export const COUNTRY_TREES = Object.freeze(buildTrees());

// Where you are, for the HUD: the district name inside the city, otherwise a part of the island.
export function regionAt(x, z, district = 'Downtown') {
  if (Math.abs(x) < CITY_EDGE && Math.abs(z) < CITY_EDGE) return x > 430 ? 'Waterfront' : district;
  const angle = Math.atan2(z, x), r = Math.hypot(x, z), shore = coastRadius(angle) - r;
  if (Math.hypot(x - LANDMARKS.lighthouse.x, z - LANDMARKS.lighthouse.z) < 120) return 'Lighthouse Cape';
  if (terrainHeight(x, z) > 0) return MOUNTAINS.some(m => m.kind !== 'hill' && Math.hypot(x - m.x, z - m.z) < m.radius) ? 'Mount Alon' : 'South Hills';
  if (shore < 70) return 'Beach';
  if (roadDistance(x, z) < ROAD_WIDTH) return 'Ring Road';
  const deg = angle / DEG;
  if (deg > 20 && deg < 160) return 'Southern Farmland';
  if (deg <= -20 && deg > -160) return 'Northern Woods';
  return 'Western Plains';
}
