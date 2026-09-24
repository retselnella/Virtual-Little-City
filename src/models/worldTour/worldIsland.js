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
  if (r < 400) return true;
  return r < coastRadius(Math.atan2(z, x)) - SHORE_INSET - radius && !inLake(x, z, radius + 2);
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
// Fast test used while scattering nature: is any outer road within `d` of (x, z)?
const SEGMENTS = ROUTES.flatMap(route => route.points.slice(1).map((b, i) => { const a = route.points[i]; return { a, b, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }; }));
export function roadWithin(x, z, d) {
  for (const s of SEGMENTS) {
    if (x < s.x0 - d || x > s.x1 + d || z < s.z0 - d || z > s.z1 + d) continue;
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - s.a.x - dx * t, z - s.a.z - dz * t) < d) return true;
  }
  return false;
}
export function roadDistance(x, z) {
  let best = Infinity;
  for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) best = Math.min(best, segmentDistance({ x, z }, route.points[i - 1], route.points[i]));
  return best;
}

// Mountains are cones: a steep range to the north-west (too steep to climb) and gentle hills to the south-west that you
// can walk or drive over. The layout is seeded so every player gets the same island.
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
// Mirror Lake in the western plains: water you cannot walk into (a shoreline of invisible walls, like the coast).
export const LAKE = Object.freeze({ x: -840, z: 330, rx: 100, rz: 64 });
export function inLake(x, z, margin = 0) { return ((x - LAKE.x) / (LAKE.rx + margin)) ** 2 + ((z - LAKE.z) / (LAKE.rz + margin)) ** 2 < 1; }
export function lakeShore(points = 48, outset = 0) {
  return Array.from({ length: points }, (_, i) => { const a = i / points * TAU; return { x: LAKE.x + Math.cos(a) * (LAKE.rx + outset), z: LAKE.z + Math.sin(a) * (LAKE.rz + outset) }; });
}
function buildMountains() {
  const random = seeded(4242), list = [];
  // Each cone fits in the band between the ring road and the beach, overlapping its neighbours like a real range.
  const place = (angle, size, height, kind, where = random()) => {
    const inner = ringRadius(angle) + ROAD_WIDTH + 25, outer = coastRadius(angle) - 80, radius = Math.min(size, (outer - inner) / 2);
    if (radius < 40) return;
    const distance = inner + radius + where * (outer - inner - 2 * radius), x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    if (roadDistance(x, z) < radius + ROAD_WIDTH || inLake(x, z, radius + 40)) return;
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
  campsite: { x: -840, z: 420 },
});

// ---- Nature and places to find. Everything below is seeded, so every player explores the same island.
// Smooth 2D value noise decides where forests grow.
function hash2(i, j, salt) {
  let h = Math.imul((i * 374761393) ^ (j * 668265263) ^ (salt * 2246822519), 1274126177);
  h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function noise2(x, z, size, salt) {
  const u = x / size, v = z / size, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
  const a = hash2(i, j, salt), b = hash2(i + 1, j, salt), c = hash2(i, j + 1, salt), d = hash2(i + 1, j + 1, salt);
  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}
const inCity = (x, z, margin = 0) => Math.abs(x) < CITY_EDGE + margin && Math.abs(z) < CITY_EDGE + margin;
const shoreDistance = (x, z) => coastRadius(Math.atan2(z, x)) - SHORE_INSET - Math.hypot(x, z);
// How wooded a spot is (0 open … 1 deep forest): noise, plus thick woods in the north and on the foothills, open farmland in the south.
export function forestDensity(x, z) {
  const deg = Math.atan2(z, x) / DEG;
  let d = noise2(x, z, 260, 1) * 0.62 + noise2(x, z, 95, 2) * 0.38 - 0.08;
  if (deg < -25 && deg > -160) d += 0.3;
  if (deg > 20 && deg < 100) d -= 0.28;
  for (const m of MOUNTAINS) { const edge = Math.hypot(x - m.x, z - m.z) - m.radius; if (edge < 170) d += 0.24 * (1 - Math.max(0, edge) / 170); }
  if (inLake(x, z, 70)) d += 0.12;
  return d;
}

// Farm fields (fenced, with a gate) and log cabins, placed where the ground is flat and clear.
function clearGround(x, z, half) {
  for (const [dx, dz] of [[0, 0], [half, half], [-half, half], [half, -half], [-half, -half]]) {
    const px = x + dx, pz = z + dz;
    if (!onIsland(px, pz, 20) || inCity(px, pz, 20) || terrainHeight(px, pz) > 0 || inLake(px, pz, 20) || roadWithin(px, pz, ROAD_WIDTH + 8)) return false;
  }
  return !roadWithin(x, z, half + ROAD_WIDTH);
}
// Scan a region for flat, clear spots at least `gap` apart.
function pick(count, gap, half, test, [x0, x1, z0, z1], step = 20) {
  const found = [];
  for (let z = z0; z <= z1 && found.length < count; z += step) for (let x = x0; x <= x1 && found.length < count; x += step)
    if (test(x, z) && clearGround(x, z, half) && found.every(f => Math.hypot(f.x - x, f.z - z) > gap)) found.push({ x, z });
  return found;
}
const farmland = (x, z) => { const deg = Math.atan2(z, x) / DEG; return deg > 25 && deg < 115 && forestDensity(x, z) < 0.5; };
export const FIELDS = Object.freeze(pick(8, 105, 50, farmland, [-400, 440, 560, 1000]).map(({ x, z }, i) => ({ id: `field:${i}`, x, z, width: 80, depth: 60, crop: i % 3 })));
const inField = (x, z, margin = 0) => FIELDS.some(f => Math.abs(x - f.x) < f.width / 2 + margin && Math.abs(z - f.z) < f.depth / 2 + margin);
// Cabins hide in the woods; one looks over the lake from its east shore.
export const CABINS = Object.freeze([{ x: -705, z: 330 }, ...pick(6, 260, 16, (x, z) => forestDensity(x, z) > 0.62 && !inLake(x, z, 80), [-1200, 400, -1200, 1000], 30)]
  .filter(({ x, z }) => clearGround(x, z, 14)).map(({ x, z }, i) => ({ id: `cabin:${i}`, x, z, heading: i ? (hash2(i, 3, 9) - 0.5) * 2 : -Math.PI / 2, width: 10, depth: 8, height: 4.5 })));
const nearCabin = (x, z, margin) => CABINS.some(c => Math.hypot(x - c.x, z - c.z) < margin);

// Trees (solid): pines on the mountains and in the northern woods, broadleaf forest in the lowlands, palms on the beaches.
const treeGrid = new Map(), TREE_CELL = 8;
function treesNear(x, z, gap) {
  const r = Math.ceil(gap / TREE_CELL);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const t of treeGrid.get(`${Math.floor(x / TREE_CELL) + i},${Math.floor(z / TREE_CELL) + j}`) || []) if (Math.abs(t.x - x) < gap && Math.abs(t.z - z) < gap) return true;
  return false;
}
function buildTrees() {
  const random = seeded(777), trees = [], grid = treeGrid, cell = TREE_CELL;
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const crowded = (x, z, gap) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of grid.get(`${Math.floor(x / cell) + i},${Math.floor(z / cell) + j}`) || []) if (Math.hypot(t.x - x, t.z - z) < gap) return true; return false; };
  const blocked = (x, z) => inCity(x, z, 22) || roadWithin(x, z, ROAD_WIDTH + 5) || inLake(x, z, 8) || inField(x, z, 4) || nearCabin(x, z, 14)
    || ROAD_LAMPS.some(l => Math.abs(l.x - x) < 6 && Math.abs(l.z - z) < 6) || Math.hypot(x - LANDMARKS.lighthouse.x, z - LANDMARKS.lighthouse.z) < 40
    || Math.hypot(x - LANDMARKS.campsite.x, z - LANDMARKS.campsite.z) < 22;
  const add = tree => { trees.push(tree); const k = key(tree.x, tree.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(tree); };
  for (let gx = -1360; gx < 500; gx += 10) for (let gz = -1360; gz < 1360; gz += 10) {
    const x = gx + (random() - 0.5) * 7, z = gz + (random() - 0.5) * 7, roll = random();
    if (!onIsland(x, z, 2) || blocked(x, z)) continue;
    const shore = shoreDistance(x, z), ground = terrainHeight(x, z), mountain = MOUNTAINS.find(m => Math.hypot(x - m.x, z - m.z) < m.radius);
    let chance, kind;
    if (shore < 70) { chance = 0.05; kind = 'palm'; }
    else if (mountain) {
      const up = ground / mountain.height;
      if (up > (mountain.kind === 'hill' ? 0.95 : 0.5)) continue;
      chance = mountain.kind === 'hill' ? 0.18 : 0.42 * (1 - up / 0.5); kind = mountain.kind === 'hill' ? (roll < 0.1 ? 'pine' : 'broad') : 'pine';
    } else {
      const density = forestDensity(x, z);
      chance = density > 0.48 ? Math.min(0.85, (density - 0.48) * 3) : 0.012;
      kind = Math.atan2(z, x) / DEG < -20 && Math.atan2(z, x) / DEG > -170 && roll < 0.7 ? 'pine' : roll < 0.2 ? 'pine' : 'broad';
    }
    if (random() > chance || crowded(x, z, kind === 'pine' ? 5.5 : 7)) continue;
    const scale = 0.75 + random() * 0.6, height = (kind === 'pine' ? 13 + random() * 8 : kind === 'palm' ? 9 + random() * 5 : 8 + random() * 5) * (0.8 + scale * 0.25);
    add({ x, z, y: Math.max(0, ground - 0.4), kind, radius: 0.4, height, scale, shade: Math.floor(random() * 3), beach: kind === 'palm' });
  }
  return trees;
}
export const COUNTRY_TREES = Object.freeze(buildTrees());
// Trees within `radius` of a point (for the camera, which keeps out of the canopies).
export function treesAround(x, z, radius) {
  const found = [], r = Math.ceil(radius / TREE_CELL), cx = Math.floor(x / TREE_CELL), cz = Math.floor(z / TREE_CELL);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const t of treeGrid.get(`${cx + i},${cz + j}`) || []) found.push(t);
  return found;
}

// Boulders (the big ones are solid), fallen logs (solid), and bushes, wildflowers and grass tufts (decoration only).
function buildGroundCover() {
  const random = seeded(9091), rocks = [], logs = [], bushes = [], flowers = [], grass = [];
  const free = (x, z, gap) => onIsland(x, z, 1) && !inCity(x, z, 18) && !roadWithin(x, z, ROAD_WIDTH + gap) && !inLake(x, z, 4) && !inField(x, z, 2) && !nearCabin(x, z, 12)
    && Math.hypot(x - LANDMARKS.lighthouse.x, z - LANDMARKS.lighthouse.z) > 14 && Math.hypot(x - LANDMARKS.campsite.x, z - LANDMARKS.campsite.z) > 16;
  const clearOfTrees = (x, z, gap) => !treesNear(x, z, gap);
  for (let i = 0; rocks.length < 900 && i < 40000; i++) {
    const x = -1350 + random() * 1850, z = -1350 + random() * 2700;
    if (!free(x, z, 4)) continue;
    const ground = terrainHeight(x, z), shore = shoreDistance(x, z), foot = MOUNTAINS.some(m => Math.hypot(x - m.x, z - m.z) < m.radius + 60);
    const chance = ground > 0 || foot ? 0.55 : shore < 50 ? 0.25 : 0.035;
    if (random() > chance) continue;
    const size = ground > 0 || foot ? 0.8 + random() ** 2 * 4.5 : 0.4 + random() ** 2 * 2.2;
    if (!clearOfTrees(x, z, size + 1.5)) continue;
    rocks.push({ x, z, y: ground, size, sx: size * (0.8 + random() * 0.5), sy: size * (0.55 + random() * 0.35), sz: size * (0.8 + random() * 0.5), turn: random() * TAU, tone: Math.floor(random() * 3), solid: size > 1.2 });
  }
  for (let i = 0; logs.length < 70 && i < 20000; i++) {
    const x = -1350 + random() * 1850, z = -1350 + random() * 2700;
    if (!free(x, z, 6) || terrainHeight(x, z) > 0 || forestDensity(x, z) < 0.6 || !clearOfTrees(x, z, 5)) continue;
    logs.push({ x, z, heading: random() * Math.PI, length: 5 + random() * 4, radius: 0.45 + random() * 0.2 });
  }
  for (let i = 0; bushes.length < 1600 && i < 60000; i++) {
    const x = -1350 + random() * 1850, z = -1350 + random() * 2700;
    if (!free(x, z, 3) || terrainHeight(x, z) > 20) continue;
    const density = forestDensity(x, z);
    if (random() > (density > 0.35 ? 0.7 : 0.18)) continue;
    bushes.push({ x, z, y: terrainHeight(x, z), size: 0.7 + random() * 1.4, tone: Math.floor(random() * 3), turn: random() * TAU });
  }
  for (let i = 0; flowers.length < 2600 && i < 60000; i++) {
    const x = -1350 + random() * 1850, z = -1350 + random() * 2700;
    if (!free(x, z, 2) || terrainHeight(x, z) > 0 || forestDensity(x, z) > 0.5 || shoreDistance(x, z) < 60) continue;
    // Flowers grow in drifts: a meadow patch gets several of one colour.
    const patch = noise2(x, z, 70, 5);
    if (patch < 0.55) continue;
    flowers.push({ x, z, color: Math.floor(noise2(x, z, 50, 6) * 4) });
  }
  for (let i = 0; grass.length < 3200 && i < 60000; i++) {
    const x = -1350 + random() * 1850, z = -1350 + random() * 2700;
    if (!free(x, z, 1.5) || terrainHeight(x, z) > 0 || shoreDistance(x, z) < 40) continue;
    grass.push({ x, z, height: 0.5 + random() * 0.8, turn: random() * Math.PI, tone: Math.floor(random() * 2) });
  }
  return { rocks, logs, bushes, flowers, grass };
}
const cover = buildGroundCover();
export const ROCKS = Object.freeze(cover.rocks), LOGS = Object.freeze(cover.logs), BUSHES = Object.freeze(cover.bushes), FLOWERS = Object.freeze(cover.flowers), GRASS = Object.freeze(cover.grass);

// Coarse cells of dense forest, for the darker forest floor and the map.
export const FOREST_CELLS = Object.freeze((() => {
  const counts = new Map();
  for (const t of COUNTRY_TREES) { if (t.kind === 'palm') continue; const k = `${Math.floor(t.x / 40)},${Math.floor(t.z / 40)}`; counts.set(k, (counts.get(k) || 0) + 1); }
  return [...counts].filter(([, n]) => n >= 5).map(([k]) => { const [i, j] = k.split(',').map(Number); return { x: i * 40 + 20, z: j * 40 + 20 }; });
})());

// Where you are, for the HUD: the district name inside the city, otherwise a part of the island.
export function regionAt(x, z, district = 'Downtown') {
  if (inCity(x, z)) return x > 430 ? 'Waterfront' : district;
  const angle = Math.atan2(z, x), r = Math.hypot(x, z), shore = coastRadius(angle) - r;
  if (Math.hypot(x - LANDMARKS.lighthouse.x, z - LANDMARKS.lighthouse.z) < 120) return 'Lighthouse Cape';
  if (inLake(x, z, 60)) return Math.hypot(x - LANDMARKS.campsite.x, z - LANDMARKS.campsite.z) < 40 ? 'Lakeside Campsite' : 'Mirror Lake';
  if (terrainHeight(x, z) > 0) return MOUNTAINS.some(m => m.kind !== 'hill' && Math.hypot(x - m.x, z - m.z) < m.radius) ? 'Mount Alon' : 'South Hills';
  if (shore < 70) return 'Beach';
  if (roadWithin(x, z, ROAD_WIDTH)) return 'Ring Road';
  if (nearCabin(x, z, 30)) return 'Forest Cabin';
  const deg = angle / DEG;
  if (forestDensity(x, z) > 0.55) return deg < -20 && deg > -170 ? 'Northern Woods' : 'Lowland Forest';
  if (deg > 20 && deg < 160) return 'Southern Farmland';
  if (deg <= -20 && deg > -160) return 'Northern Woods';
  return 'Western Plains';
}
