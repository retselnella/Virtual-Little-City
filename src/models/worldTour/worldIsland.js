// Each city stands on its own island. The street grid is the same everywhere (|x|, |z| < 455, waterfront on the east
// coast); everything around it comes from the city's THEME: coastline, landforms (volcanoes, mesas, granite domes,
// dunes, downs, rice terraces), lakes, forests, farms, a suburb and a landmark. islandFor(city) builds it once, seeded,
// so every player on that island sees the same world, and the renderer, the physics world and gameplay all read the
// same data. Angles are atan2(z, x): 0 is east, +90° south, ±180° west, -90° north.
export const CITY_EDGE = 470, ISLAND_EXTENT = 1800, SEA_LIMIT = 6000, SHORE_INSET = 14, RING_RADIUS = 580, ROAD_WIDTH = 17;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

// ---- Themes: what makes each island itself. Coast control points are [compass degrees, radius].
export const THEMES = {
  miami: {
    island: 'Biscayne Key', summary: 'Barrier key · dunes · mangrove lagoons · citrus groves', seed: 11,
    coast: [[0, 900], [30, 900], [50, 900], [70, 1000], [90, 1330], [105, 1260], [125, 920], [150, 830], [180, 860], [210, 830], [235, 920], [255, 1250], [270, 1360], [290, 1060], [310, 900], [330, 900]], wobble: 10,
    ground: { grass: '#8fb06a', sand: '#efe1b4', floor: '#4f6b3c', rock: ['#b9b09a', '#a79f8a', '#c9c0a8'] },
    forest: { name: 'Mangrove Hammock', amount: -0.05, kinds: { palm: 0.45, mangrove: 0.55 } },
    plains: 'Sawgrass Flats', fields: { name: 'Citrus Groves', kind: 'orchard', count: 5 }, lakes: [{ name: 'Blue Lagoon', at: [88, 0.45], rx: 110, rz: 55, turn: 0.4 }, { name: 'Heron Lagoon', at: [262, 0.35], rx: 70, rz: 45 }, { name: 'Egret Pond', at: [274, 0.85], rx: 60, rz: 40 }], cape: [170, 190],
    landforms: [{ kind: 'hill', name: 'Dunes', repeat: 18, band: [60, 300], size: [40, 70], height: [5, 9], where: [0.8, 1], stretch: 2.2, colors: 'sand' }],
    houses: { roof: 'flat', walls: ['#f5d6c6', '#cfe6e1', '#f7e7b0', '#e8c8dc'], roofColor: '#f4efe6' }, landmark: 'lifeguards', suburb: 'Coral Gables',
  },
  tokyo: {
    island: 'Kasumi Island', summary: 'Snow-capped volcano · cedar & cherry forest · rice paddies · shrine', seed: 23,
    coast: [[0, 900], [30, 900], [55, 900], [80, 1000], [110, 1060], [140, 1000], [165, 1110], [195, 1300], [220, 1400], [245, 1350], [270, 1150], [295, 980], [320, 900], [340, 900]], wobble: 12,
    ground: { grass: '#7ea463', sand: '#d9cfae', floor: '#3f5e3c', rock: ['#77736c', '#65625d', '#8a857c'] },
    forest: { name: 'Cedar Forest', amount: 0.08, kinds: { pine: 0.6, cherry: 0.25, broad: 0.15 } },
    plains: 'Satoyama Fields', cape: [160, 185], fields: { name: 'Rice Paddies', kind: 'paddy', count: 7 }, lakes: [{ name: 'Lake Shizuka', at: [115, 0.55], rx: 90, rz: 58, turn: -0.3 }],
    landforms: [
      { kind: 'volcano', name: 'Mount Kasumi', at: [224, 0.5], size: 240, height: 300, snow: 0.7, colors: 'volcano' },
      { kind: 'cone', name: 'Kasumi Foothills', repeat: 7, band: [195, 280], size: [60, 95], height: [35, 60], colors: 'forest' },
    ],
    houses: { roof: 'gable', walls: ['#e9e4d8', '#d8d2c4', '#c9b8a0'], roofColor: '#3d4652' }, landmark: 'torii', suburb: 'Sakura Heights',
  },
  manila: {
    island: 'Isla Liwanag', summary: 'Perfect-cone volcano · rice terraces · rainforest · bay', seed: 31,
    coast: [[0, 900], [30, 900], [55, 920], [80, 1100], [100, 1150], [118, 1000], [132, 830], [145, 840], [160, 1050], [185, 1250], [215, 1300], [245, 1250], [270, 1200], [295, 1000], [320, 900], [340, 900]], wobble: 16,
    ground: { grass: '#6fa257', sand: '#dccfa6', floor: '#3a5a33', rock: ['#5e5752', '#4f4945', '#716a63'] },
    forest: { name: 'Rainforest', amount: 0.1, kinds: { broad: 0.7, palm: 0.3 } },
    plains: 'Cogon Grasslands', cape: [160, 182], fields: { name: 'Rice Paddies', kind: 'paddy', count: 6 }, lakes: [{ name: 'Lake Tahimik', at: [168, 0.3], rx: 80, rz: 55 }],
    landforms: [
      { kind: 'volcano', name: 'Mount Liwanag', at: [207, 0.5], size: 200, height: 250, colors: 'basalt', smoke: true },
      { kind: 'terrace', name: 'Rice Terraces', repeat: 4, band: [250, 300], size: [110, 140], height: [30, 42], colors: 'terrace' },
    ],
    houses: { roof: 'gable', walls: ['#f1e6c8', '#cfe0d4', '#f3d1b5'], roofColor: '#b5533c' }, landmark: 'huts', suburb: 'San Isidro',
  },
  london: {
    island: 'Isle of Wren', summary: 'Rolling chalk downs · oak woods · hedged farms · estuary', seed: 41,
    coast: [[0, 900], [30, 900], [55, 950], [85, 1100], [120, 1150], [155, 1100], [190, 1150], [225, 1200], [248, 1100], [261, 830], [270, 800], [279, 840], [292, 1050], [315, 920], [335, 900]], wobble: 9,
    ground: { grass: '#7ea55f', sand: '#d6ccb0', floor: '#45633b', rock: ['#d9d6cc', '#c4c1b6', '#e6e3da'] },
    forest: { name: 'Oakwood', amount: 0.02, kinds: { broad: 0.85, pine: 0.15 } },
    plains: 'Green Belt', cape: [185, 200], fields: { name: 'Patchwork Farms', kind: 'hedged', count: 8 }, lakes: [{ name: 'Wren Mere', at: [120, 0.4], rx: 70, rz: 45 }],
    landforms: [{ kind: 'hill', name: 'The Downs', repeat: 10, band: [105, 295], size: [120, 190], height: [22, 36], colors: 'downs' }],
    houses: { roof: 'gable', walls: ['#a0553f', '#b0664c', '#8e4b38'], roofColor: '#4a4a52' }, landmark: 'stones', suburb: 'Hampton Green',
  },
  dubai: {
    island: 'Jazirat Sarab', summary: 'Desert dunes · red mesas · oasis · date-palm groves · fort', seed: 53,
    coast: [[0, 900], [30, 900], [55, 900], [80, 950], [110, 1000], [140, 1150], [165, 1320], [185, 1380], [205, 1300], [235, 1100], [265, 1000], [295, 950], [320, 900], [340, 900]], wobble: 8,
    ground: { grass: '#d9c08e', sand: '#ecd9aa', floor: '#c9ad78', rock: ['#b86e4b', '#a45f40', '#c98260'] }, desert: true,
    forest: { name: 'Desert', amount: -0.6, kinds: { palm: 1 } },
    plains: 'Open Desert', cape: [175, 195], fields: { name: 'Date Palm Groves', kind: 'palmgrove', count: 3 }, lakes: [{ name: 'Oasis', at: [150, 0.3], rx: 55, rz: 40, oasis: true }],
    landforms: [
      { kind: 'hill', name: 'Great Dunes', repeat: 26, band: [95, 300], size: [90, 150], height: [10, 21], stretch: 2.6, turn: 0.5, colors: 'dune' },
      { kind: 'frustum', name: 'Red Mesas', repeat: 3, band: [175, 200], size: [70, 95], height: [55, 75], top: 0.62, colors: 'mesa' },
    ],
    houses: { roof: 'flat', walls: ['#efe3cc', '#e6d5b8', '#f3ebdc'], roofColor: '#e2d3b6' }, landmark: 'fort', suburb: 'Al Waha Villas',
  },
  rio: {
    island: 'Ilha Verde', summary: 'Granite domes · Atlantic rainforest · beaches · hillside favela', seed: 61,
    coast: [[0, 900], [30, 900], [55, 900], [75, 1150], [95, 960], [115, 1200], [140, 1000], [165, 1250], [190, 1050], [215, 1300], [240, 1050], [265, 1200], [290, 960], [315, 900], [340, 900]], wobble: 26,
    ground: { grass: '#6c9e52', sand: '#eadcae', floor: '#355530', rock: ['#8d8a86', '#7a7773', '#a09c96'] },
    forest: { name: 'Atlantic Rainforest', amount: 0.14, kinds: { broad: 0.8, palm: 0.2 } },
    plains: 'Restinga', cape: [160, 172], fields: { name: 'Banana Groves', kind: 'orchard', count: 4 }, lakes: [{ name: 'Lagoa Azul', at: [130, 0.35], rx: 90, rz: 50, turn: 0.3 }],
    landforms: [
      { kind: 'dome', name: 'Granite Peaks', repeat: 5, band: [150, 290], size: [70, 105], height: [150, 210], where: [0.75, 1], colors: 'granite' },
      { kind: 'cone', name: 'Morro Hills', repeat: 6, band: [60, 150], size: [80, 120], height: [40, 70], colors: 'forest' },
    ],
    houses: { roof: 'gable', walls: ['#f2c14e', '#8ac6d0', '#e76f51', '#9fd39b', '#f4a3b4'], roofColor: '#b5533c' }, landmark: 'favela', suburb: 'Vila Nova',
  },
  cape: {
    island: 'Cape Mesa Island', summary: 'Flat-topped mesa · peaks · fynbos · vineyards · manor', seed: 67,
    coast: [[0, 900], [30, 900], [55, 950], [80, 1050], [105, 1200], [125, 1480], [140, 1340], [160, 1050], [190, 1150], [205, 1350], [220, 1350], [250, 1150], [275, 1000], [300, 950], [325, 900]], wobble: 14,
    ground: { grass: '#8d9f68', sand: '#e6dcc0', floor: '#5a6b44', rock: ['#8f8577', '#7b7266', '#a2988a'] },
    forest: { name: 'Fynbos Slopes', amount: -0.15, kinds: { pine: 0.5, broad: 0.5 }, shrubs: 2.2 },
    plains: 'Fynbos Flats', cape: [115, 135], fields: { name: 'Vineyards', kind: 'vineyard', count: 7 }, lakes: [{ name: 'Mesa Reservoir', at: [240, 0.3], rx: 75, rz: 50 }],
    landforms: [
      { kind: 'frustum', name: 'Table Mesa', at: [208, 0.5], size: 205, height: 185, top: 0.72, stretch: 1.4, colors: 'mesa' },
      { kind: 'cone', name: "Lion's Peak", at: [168, 0.4], size: 110, height: 170, colors: 'rock' },
      { kind: 'cone', name: "Devil's Peak", at: [242, 0.55], size: 90, height: 140, colors: 'rock' },
      { kind: 'hill', name: 'Fynbos Hills', repeat: 5, band: [250, 300], size: [90, 130], height: [18, 30], colors: 'downs' },
    ],
    houses: { roof: 'gable', walls: ['#f7f4ec', '#efe9dc'], roofColor: '#3f4a3a' }, landmark: 'manor', suburb: 'Constantia',
  },
};

// ---- Shared helpers
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
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
export function ringRadius(angle) { const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle)); return RING_RADIUS / (c ** 4 + s ** 4) ** 0.25; }
function segmentDistance(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
// Landform profiles: height fraction at normalised distance t (0 centre … 1 foot). All are convex, so the physics
// collider (a convex hull of the same surface) matches what you see and where you walk.
export function profile(form, t) {
  if (t >= 1) return 0;
  if (form.kind === 'frustum') return t < form.top ? 1 : (1 - t) / (1 - form.top);
  if (form.kind === 'dome') return Math.sqrt(1 - t * t);
  if (form.kind === 'hill' || form.kind === 'terrace') return 1 - t * t;
  return 1 - t; // cone, volcano
}
export function formT(form, x, z) {
  const dx = x - form.x, dz = z - form.z, c = Math.cos(form.turn), s = Math.sin(form.turn);
  return Math.hypot((dx * c + dz * s) / form.rx, (-dx * s + dz * c) / form.rz);
}
// The static street grid facts every island shares: the marina pier on the east waterfront and the airport.
export const MARINA = Object.freeze({ x0: 452, x1: 562, z: -300, width: 7, mooring: Object.freeze({ x: 548, z: -289, heading: Math.PI / 2 }) });
export const AIRPORT = Object.freeze({ x: -413, z: -190, name: 'Airport terminal' });

// ---- Building an island
function buildIsland(cityId) {
  const theme = THEMES[cityId] || THEMES.miami, random = seeded(theme.seed * 7919 + 5);
  const coastPoints = theme.coast;
  function spline(angle) {
    const deg = ((angle / DEG) % 360 + 360) % 360, n = coastPoints.length;
    const i = coastPoints.findIndex(([a], k) => deg >= a && deg < (coastPoints[k + 1]?.[0] ?? 360));
    const at = k => coastPoints[(k + n) % n], span = ((at(i + 1)[0] - at(i)[0]) + 360) % 360 || 360, t = (deg - at(i)[0]) / span;
    const [p0, p1, p2, p3] = [at(i - 1)[1], at(i)[1], at(i + 1)[1], at(i + 2)[1]];
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  const w = theme.wobble;
  function coastRadius(angle) {
    const organic = spline(angle) + w * Math.sin(angle * 11 + theme.seed) + w * 0.6 * Math.sin(angle * 23 + theme.seed * 2), c = Math.cos(angle);
    return c > 0.05 ? Math.min(organic, CITY_EDGE / c) : organic;
  }
  const shoreDistance = (x, z) => coastRadius(Math.atan2(z, x)) - SHORE_INSET - Math.hypot(x, z);
  const lakes = [];
  const insideLake = (l, x, z, margin) => { const dx = x - l.x, dz = z - l.z, c = Math.cos(l.turn), s = Math.sin(l.turn); return ((dx * c + dz * s) / (l.rx + margin)) ** 2 + ((-dx * s + dz * c) / (l.rz + margin)) ** 2 < 1; };
  const inLake = (x, z, margin = 0) => lakes.some(l => insideLake(l, x, z, margin));
  function onIsland(x, z, radius = 0) {
    const r = Math.hypot(x, z);
    if (r < 400) return true;
    return r < coastRadius(Math.atan2(z, x)) - SHORE_INSET - radius && !inLake(x, z, radius + 2);
  }
  function coastline(points = 180, inset = 0) {
    return Array.from({ length: points }, (_, i) => { const a = -Math.PI + i / points * TAU, r = coastRadius(a) - inset; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; });
  }
  // Where the band between the ring road and the beach sits along a compass angle.
  const band = deg => { const a = deg * DEG; return { a, inner: ringRadius(a) + ROAD_WIDTH + 30, outer: coastRadius(a) - 90 }; };
  const polar = (deg, where) => { const { a, inner, outer } = band(deg), r = inner + (outer - inner) * where; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };

  // Roads: the ring road, links into the grid, and a cape road out to the lighthouse on the island's western headland.
  function ringRoad() {
    const points = [];
    for (let deg = -40; deg >= -320; deg -= 2.5) { const a = deg * DEG, r = ringRadius(a), x = Math.cos(a) * r, z = Math.sin(a) * r; if (x < CITY_EDGE - 45) points.push({ x, z }); }
    return [{ x: CITY_EDGE - 30, z: points[0].z }, ...points, { x: CITY_EDGE - 30, z: points.at(-1).z }];
  }
  let capeDeg = 180, capeR = 0;
  const [capeLo, capeHi] = theme.cape || [165, 195];
  for (let deg = capeLo; deg <= capeHi; deg += 2) { const r = coastRadius(deg * DEG); if (r > capeR) { capeR = r; capeDeg = deg; } }
  const capeA = capeDeg * DEG, lighthouse = { x: Math.cos(capeA) * (capeR - 60), z: Math.sin(capeA) * (capeR - 60), radius: 5, height: 34 };
  const ringStart = { x: -RING_RADIUS, z: 0 };
  const capePoints = [ringStart];
  for (let k = 1; k <= 4; k++) { const t = k / 5; capePoints.push({ x: ringStart.x + (lighthouse.x + 30 - ringStart.x) * t, z: ringStart.z + (lighthouse.z - ringStart.z) * t + Math.sin(t * Math.PI) * 60 }); }
  capePoints.push({ x: lighthouse.x + 30, z: lighthouse.z });
  const routes = [
    { id: 'ring', name: 'Ring Road', points: ringRoad() },
    { id: 'north', name: 'North Link', points: [{ x: 0, z: -438 }, { x: 0, z: -RING_RADIUS }] },
    { id: 'south', name: 'South Link', points: [{ x: 0, z: 438 }, { x: 0, z: RING_RADIUS }] },
    { id: 'west', name: 'West Link', points: [{ x: -438, z: 0 }, { x: -RING_RADIUS, z: 0 }] },
    { id: 'cape', name: 'Cape Road', points: capePoints },
  ];
  let segments = [];
  const indexRoads = () => { segments = routes.flatMap(route => route.points.slice(1).map((b, i) => { const a = route.points[i]; return { a, b, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }; })); };
  indexRoads();
  const roadDistance = (x, z) => segments.reduce((best, s) => Math.min(best, segmentDistance(x, z, s.a, s.b)), Infinity);
  function roadWithin(x, z, d) {
    for (const s of segments) { if (x < s.x0 - d || x > s.x1 + d || z < s.z0 - d || z > s.z1 + d) continue; if (segmentDistance(x, z, s.a, s.b) < d) return true; }
    return false;
  }

  // Lakes (they come before landforms so mountains keep clear of the water).
  for (const spec of theme.lakes) {
    const at = polar(...spec.at), lake = { name: spec.name, x: at.x, z: at.z, rx: spec.rx, rz: spec.rz, turn: spec.turn || 0, oasis: !!spec.oasis };
    const reach = Math.max(lake.rx, lake.rz);
    if (roadWithin(lake.x, lake.z, reach + ROAD_WIDTH + 10) || !onIsland(lake.x, lake.z, reach + 40) || lakes.some(l => Math.hypot(l.x - lake.x, l.z - lake.z) < reach + Math.max(l.rx, l.rz) + 40)) continue;
    lakes.push(lake);
  }

  // Landforms, fitted into the band between the ring road and the beach, clear of roads, lakes and the lighthouse.
  const forms = [];
  const range = ([a, b]) => a + random() * (b - a);
  function addForm(spec, deg, where, size, height) {
    const stretch = spec.stretch || 1, { inner, outer } = band(deg), rx = size * Math.sqrt(stretch), rz = size / Math.sqrt(stretch);
    // Stretched forms lie along the coast (their long axis tangential), so only their short axis has to fit radially.
    const radial = stretch > 1 && spec.turn === undefined ? rz : Math.max(rx, rz);
    if (outer - inner < 2 * radial + 10) return false;
    const r = inner + radial + where * Math.max(0, outer - inner - 2 * radial), x = Math.cos(deg * DEG) * r, z = Math.sin(deg * DEG) * r;
    const turn = spec.turn ?? (stretch > 1 ? deg * DEG + Math.PI / 2 : random() * TAU);
    // Check the landform's actual (elliptical) footprint against the coast, roads, lakes and the lighthouse.
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, u = Math.cos(a) * rx * 1.1, v = Math.sin(a) * rz * 1.1, px = x + u * Math.cos(turn) - v * Math.sin(turn), pz = z + u * Math.sin(turn) + v * Math.cos(turn);
      if (!onIsland(px, pz, 50) || roadWithin(px, pz, ROAD_WIDTH + 8) || inLake(px, pz, 30) || Math.hypot(px - lighthouse.x, pz - lighthouse.z) < 70) return false;
    }
    if (roadWithin(x, z, Math.min(rx, rz))) return false;
    // Neighbours may overlap a little, like a real range or dune field, but never sit on top of each other.
    if (forms.some(f => Math.hypot(f.x - x, f.z - z) < ((f.rx + f.rz) / 2 + (rx + rz) / 2) * (spec.kind === 'hill' ? 0.6 : 0.5))) return false;
    // Steepest slope of the profile: gentle landforms can be walked and driven over, the rest are cliffs.
    const top = spec.top || 0, steepest = spec.kind === 'dome' ? Infinity : spec.kind === 'frustum' ? height / (Math.min(rx, rz) * (1 - top)) : (spec.kind === 'hill' || spec.kind === 'terrace' ? 2 : 1) * height / Math.min(rx, rz);
    forms.push({ id: `form:${forms.length}`, name: spec.name, kind: spec.kind, x, z, rx, rz, turn, height, top, snow: spec.snow || 0, colors: spec.colors, smoke: !!spec.smoke, climbable: steepest < 0.95 });
    return true;
  }
  for (const spec of theme.landforms) {
    if (spec.at) { addForm(spec, spec.at[0], spec.at[1], spec.size, spec.height); continue; }
    let placed = 0;
    for (let tries = 0; tries < spec.repeat * 20 && placed < spec.repeat; tries++) {
      const where = spec.where ? range(spec.where) : random();
      if (addForm(spec, range(spec.band), where, range(spec.size), range(spec.height))) placed++;
    }
  }
  function terrainHeight(x, z) {
    let h = 0;
    for (const f of forms) { const reach = Math.max(f.rx, f.rz); if (Math.abs(x - f.x) > reach || Math.abs(z - f.z) > reach) continue; const t = formT(f, x, z); if (t < 1) h = Math.max(h, f.height * profile(f, t)); }
    return h;
  }
  const formAt = (x, z) => forms.find(f => formT(f, x, z) < 1);

  // Flat, clear ground for fields and buildings.
  function clearGround(x, z, half, margin = 20) {
    for (const [dx, dz] of [[0, 0], [half, half], [-half, half], [half, -half], [-half, -half], [half, 0], [-half, 0], [0, half], [0, -half]]) {
      const px = x + dx, pz = z + dz;
      if (!onIsland(px, pz, margin) || inCity(px, pz, margin) || terrainHeight(px, pz) > 0 || inLake(px, pz, margin) || roadWithin(px, pz, ROAD_WIDTH + 8)) return false;
    }
    return !roadWithin(x, z, half + ROAD_WIDTH) && Math.hypot(x - lighthouse.x, z - lighthouse.z) > half + 60;
  }

  // Urban area: a suburb of houses on two streets, joined to the ring road (its streets are proper roads with lamps).
  const structures = [], suburbs = [];
  const solid = (x, y, z, w, h, d, turn, color, extra = {}) => structures.push({ x, y, z, w, h, d, turn, color, solid: true, ...extra });
  const deco = (x, y, z, w, h, d, turn, color, extra = {}) => structures.push({ x, y, z, w, h, d, turn, color, solid: false, ...extra });
  function house(x, z, turn, walls, style = theme.houses, scale = 1, y = 0) {
    const at = (du, dv) => ({ x: x + Math.cos(turn) * du + Math.sin(turn) * dv, z: z - Math.sin(turn) * du + Math.cos(turn) * dv });
    const W = 10 * scale, D = 8 * scale, H = (style.roof === 'flat' ? 6 : 4.2) * scale;
    solid(x, y, z, W, H, D, turn, walls, { house: true });
    if (style.roof === 'flat') { deco(x, y + H, z, W + 0.4, 0.6, D + 0.4, turn, style.roofColor); }
    else for (let k = 0; k < 4; k++) deco(x, y + H + k * 0.7, z, W + 1, 0.7, (D + 1.6) * (1 - k * 0.27), turn, style.roofColor);
    const door = at(0, D / 2 + 0.05); deco(door.x, y, door.z, 1.4, 2.4, 0.12, turn, '#4a3a2c');
    for (const side of [-1, 1]) { const win = at(side * W * 0.3, D / 2 + 0.06); deco(win.x, y + H * 0.5, win.z, 1.6, 1.2, 0.12, turn, '#3b4a55', { glow: '#ffcf85' }); }
  }
  function buildSuburb(name) {
    for (let deg = 95; deg <= 265; deg += 7.5) {
      const a = deg * DEG, r = ringRadius(a) + ROAD_WIDTH + 95, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      if (suburbs.some(s => Math.hypot(s.x - cx, s.z - cz) < 400) || !clearGround(cx, cz, 85, 25)) continue;
      // Local frame: u along the ring road, v outward from it.
      const ux = Math.cos(a + Math.PI / 2), uz = Math.sin(a + Math.PI / 2), vx = Math.cos(a), vz = Math.sin(a);
      const P = (u, v) => ({ x: cx + ux * u + vx * v, z: cz + uz * u + vz * v });
      const ringPoint = { x: Math.cos(a) * ringRadius(a), z: Math.sin(a) * ringRadius(a) };
      routes.push({ id: `suburb:${suburbs.length}:main`, name, points: [ringPoint, P(0, -40), P(0, 60)] });
      routes.push({ id: `suburb:${suburbs.length}:a`, name, points: [P(-75, -40), P(75, -40)] });
      routes.push({ id: `suburb:${suburbs.length}:b`, name, points: [P(-75, 30), P(75, 30)] });
      const houseTurn = Math.atan2(vx, vz);
      for (const street of [-40, 30]) for (const side of [-1, 1]) for (let u = -65; u <= 65; u += 18) {
        if (Math.abs(u) < 14) continue;
        const spot = P(u, street + side * 17), wall = theme.houses.walls[Math.floor(hash2(Math.round(u), street + side, theme.seed) * theme.houses.walls.length)];
        house(spot.x, spot.z, side > 0 ? houseTurn + Math.PI : houseTurn, wall);
        if (theme.houses.roof === 'flat' && hash2(u, street, 3) > 0.5) { const pool = P(u + 5, street + side * 26); deco(pool.x, 0.02, pool.z, 5, 0.1, 3, houseTurn, '#5cc6d6'); }
      }
      suburbs.push({ name, x: cx, z: cz, radius: 110 });
      indexRoads();
      break;
    }
  }
  buildSuburb(theme.suburb); buildSuburb(`${theme.suburb} East`);

  // Street lamps along every outer road.
  const lamps = [];
  for (const route of routes) {
    let travelled = 0, next = 20;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i], length = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
      for (; next < travelled + length; next += route.id.startsWith('suburb') ? 36 : 70) {
        const t = (next - travelled) / length, side = lamps.length % 2 ? 1 : -1, x = a.x + (b.x - a.x) * t + nx * side * 12, z = a.z + (b.z - a.z) * t + nz * side * 12;
        if (!inCity(x, z)) lamps.push({ x, z, heading: Math.atan2(-nx * side, -nz * side) });
      }
      travelled += length;
    }
  }
  const roadLamps = lamps.filter((lamp, i) => roadDistance(lamp.x, lamp.z) > 10 && onIsland(lamp.x, lamp.z, 1) && !structures.some(s => s.solid && Math.abs(s.x - lamp.x) < 8 && Math.abs(s.z - lamp.z) < 8) && lamps.findIndex(o => Math.hypot(o.x - lamp.x, o.z - lamp.z) < 22) === i);

  // Farms.
  const fields = [];
  const farmland = (x, z) => { const deg = Math.atan2(z, x) / DEG; return deg > 20 && deg < 140; };
  for (let z = 560; z <= 1300 && fields.length < theme.fields.count; z += 25) for (let x = -700; x <= 440 && fields.length < theme.fields.count; x += 25) {
    if (!farmland(x, z) || !clearGround(x, z, 50) || fields.some(f => Math.hypot(f.x - x, f.z - z) < 100) || suburbs.some(s => Math.hypot(s.x - x, s.z - z) < 160)) continue;
    fields.push({ id: `field:${fields.length}`, x, z, width: 80, depth: 60, kind: theme.fields.kind, crop: fields.length % 3 });
  }
  const inField = (x, z, margin = 0) => fields.some(f => Math.abs(x - f.x) < f.width / 2 + margin && Math.abs(z - f.z) < f.depth / 2 + margin);
  const fenced = { orchard: 'fence', vineyard: 'fence', palmgrove: 'fence', hedged: 'hedge', paddy: null };

  // The theme's landmark (solid boxes where you would expect them to be solid).
  const landmarks = { lighthouse, marina: MARINA, airport: AIRPORT, campsite: null, feature: null };
  const spotFor = (half, near = null) => {
    for (let k = 0; k < 400; k++) {
      const deg = near ? near.deg + (random() - 0.5) * 40 : 100 + random() * 160, where = random();
      const p = near ? { x: near.x + (random() - 0.5) * 2 * near.spread, z: near.z + (random() - 0.5) * 2 * near.spread } : polar(deg, where);
      if (clearGround(p.x, p.z, half) && !inField(p.x, p.z, half) && !suburbs.some(s => Math.hypot(s.x - p.x, s.z - p.z) < s.radius + half)) return p;
    }
    return null;
  };
  const lakeNear = lakes[0] ? { x: lakes[0].x, z: lakes[0].z, spread: Math.max(lakes[0].rx, lakes[0].rz) + 60 } : null;
  const addLandmark = (name, p, radius) => { if (p) landmarks.feature = { name, x: p.x, z: p.z, radius }; return p; };
  if (theme.landmark === 'stones') {
    const p = addLandmark('Stone Circle', spotFor(20), 24);
    if (p) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; solid(p.x + Math.cos(a) * 12, 0, p.z + Math.sin(a) * 12, 1.8, 4.4, 1.1, -a, '#b9b6ab'); if (k % 2 === 0) deco(p.x + Math.cos(a + 0.26) * 12, 4.4, p.z + Math.sin(a + 0.26) * 12, 1.2, 0.9, 6.4, -a - 0.26 + Math.PI / 2, '#aaa79c'); }
  } else if (theme.landmark === 'torii') {
    const p = addLandmark('Torii Shrine', spotFor(16, lakeNear), 22);
    if (p) { for (const s of [-3, 3]) solid(p.x + s, 0, p.z, 0.8, 7, 0.8, 0, '#c8372d'); deco(p.x, 7, p.z, 10, 0.8, 1, 0, '#2a2a2a'); deco(p.x, 5.6, p.z, 8, 0.5, 0.6, 0, '#c8372d');
      solid(p.x, 0, p.z - 14, 9, 4, 7, 0, '#c8372d', { house: true }); for (let k = 0; k < 3; k++) deco(p.x, 4 + k * 0.8, p.z - 14, 12 - k * 2.6, 0.8, 10 - k * 2.4, 0, '#2d3036'); }
  } else if (theme.landmark === 'fort') {
    const p = addLandmark('Desert Fort', spotFor(28), 30);
    if (p) { for (const [dx, dz, w, d] of [[0, -20, 40, 2], [-20, 0, 2, 40], [20, 0, 2, 40], [-12, 20, 16, 2], [12, 20, 16, 2]]) solid(p.x + dx, 0, p.z + dz, w, 6, d, 0, '#d2b17f');
      for (const [dx, dz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) solid(p.x + dx, 0, p.z + dz, 5, 9, 5, 0, '#c9a673'); }
  } else if (theme.landmark === 'huts') {
    const p = addLandmark('Nipa Hut Village', spotFor(26), 30);
    if (p) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; const hx = p.x + Math.cos(a) * 16, hz = p.z + Math.sin(a) * 16;
      for (const [sx, sz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) solid(hx + sx, 0, hz + sz, 0.4, 1.6, 0.4, 0, '#6d5540'); deco(hx, 1.6, hz, 6, 3, 5, -a, '#c9a66b');
      for (let r = 0; r < 3; r++) deco(hx, 4.6 + r * 0.7, hz, 7.2 - r * 2, 0.7, 6.4 - r * 1.8, -a, '#8a7a4a'); }
  } else if (theme.landmark === 'manor') {
    const p = addLandmark('Cape Manor', spotFor(20), 24);
    if (p) { solid(p.x, 0, p.z, 26, 6, 10, 0, '#f7f4ec', { house: true }); for (let k = 0; k < 4; k++) deco(p.x, 6 + k * 0.8, p.z, 27, 0.8, 11.5 - k * 3, 0, '#3f4a3a');
      for (const dx of [-8, 0, 8]) deco(p.x + dx, 6, p.z + 5.2, 4, 4 - Math.abs(dx) * 0.1, 0.5, 0, '#f7f4ec'); }
  } else if (theme.landmark === 'lifeguards') {
    addLandmark('Lifeguard Beach', coastline(60, 45).find(pt => { const d = Math.atan2(pt.z, pt.x) / DEG; return d > 90 && d < 130; }), 60);
    const colors = ['#ef8fa6', '#8fd3c0', '#f4d35e', '#9bb7ff'];
    coastline(90, 42).forEach((pt, i) => { const d = Math.atan2(pt.z, pt.x) / DEG; if (i % 4 || Math.abs(d) < 60) return;
      for (const [sx, sz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) solid(pt.x + sx, 0, pt.z + sz, 0.3, 2.4, 0.3, 0, '#e6e1d6');
      deco(pt.x, 2.4, pt.z, 3.4, 2.4, 3.4, 0, colors[i % 4]); deco(pt.x, 4.8, pt.z, 4.2, 0.4, 4.2, 0, '#f3eee5'); });
  }
  if (theme.landmark === 'favela') {
    const hill = forms.filter(f => f.kind === 'cone').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    if (hill) {
      landmarks.feature = { name: 'Hillside Favela', x: hill.x, z: hill.z, radius: Math.max(hill.rx, hill.rz) };
      for (let k = 0; k < 70; k++) {
        const a = random() * TAU, t = 0.3 + random() * 0.6, x = hill.x + Math.cos(a) * hill.rx * t, z = hill.z + Math.sin(a) * hill.rz * t;
        const heights = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].map(([dx, dz]) => terrainHeight(x + dx, z + dz)), low = Math.min(...heights), high = Math.max(...heights);
        if (structures.some(s => s.favela && Math.hypot(s.x - x, s.z - z) < 7)) continue;
        solid(x, low - 0.5, z, 5.5, high - low + 4 + random() * 3, 5, a, theme.houses.walls[k % theme.houses.walls.length], { favela: true, glow: null });
      }
    }
  }
  // A campsite on the first lake's shore (not at an oasis).
  if (lakes[0] && !lakes[0].oasis) {
    const l = lakes[0];
    for (const { x, z } of lakeShore(l, 8, 28)) {
      if (clearGround(x, z, 14, 6)) { landmarks.campsite = { x, z }; solid(x - 7, 0, z + 3, 3.2, 2.2, 3.8, 0, null, { tent: true }); solid(x + 7, 0, z + 3, 3.2, 2.2, 3.8, 0, null, { tent: true }); break; }
    }
  }
  const nearStructure = (x, z, gap) => structures.some(s => Math.abs(s.x - x) < s.w / 2 + gap && Math.abs(s.z - z) < s.d / 2 + gap && (s.solid || gap > 2));
  const nearFeature = (x, z, gap = 0) => [landmarks.feature, landmarks.campsite && { ...landmarks.campsite, radius: 18 }].some(f => f && Math.hypot(f.x - x, f.z - z) < f.radius + gap);

  // Forests: noise-driven woods whose species come from the theme; forests climb landforms up to a treeline.
  function forestDensity(x, z) {
    const deg = Math.atan2(z, x) / DEG;
    let d = noise2(x, z, 260, theme.seed) * 0.62 + noise2(x, z, 95, theme.seed + 1) * 0.38 - 0.08 + theme.forest.amount;
    if (deg < -25 && deg > -160) d += 0.22;
    if (deg > 20 && deg < 100) d -= 0.25;
    for (const f of forms) { if (f.colors === 'dune' || f.colors === 'sand') continue; const edge = Math.hypot(x - f.x, z - f.z) - Math.max(f.rx, f.rz); if (edge < 150) d += 0.22 * (1 - Math.max(0, edge) / 150); }
    if (inLake(x, z, 70)) d += lakes.some(l => l.oasis) ? 0.5 : 0.1;
    return d;
  }
  const species = (roll) => { let acc = 0; for (const [kind, p] of Object.entries(theme.forest.kinds)) { acc += p; if (roll < acc) return kind; } return 'broad'; };
  const treeGrid = new Map(), CELL = 8, trees = [];
  const treesNear = (x, z, gap) => { const r = Math.ceil(gap / CELL); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const t of treeGrid.get(`${Math.floor(x / CELL) + i},${Math.floor(z / CELL) + j}`) || []) if (Math.abs(t.x - x) < gap && Math.abs(t.z - z) < gap) return true; return false; };
  const blocked = (x, z) => inCity(x, z, 22) || roadWithin(x, z, ROAD_WIDTH + 5) || inLake(x, z, 8) || inField(x, z, 4) || nearStructure(x, z, 6) || nearFeature(x, z, 4)
    || roadLamps.some(l => Math.abs(l.x - x) < 6 && Math.abs(l.z - z) < 6) || Math.hypot(x - lighthouse.x, z - lighthouse.z) < 40;
  for (let gx = -1500; gx < 500; gx += 10) for (let gz = -1500; gz < 1500; gz += 10) {
    const x = gx + (random() - 0.5) * 7, z = gz + (random() - 0.5) * 7, roll = random();
    if (!onIsland(x, z, 2) || blocked(x, z)) continue;
    const shore = shoreDistance(x, z), ground = terrainHeight(x, z), form = ground > 0 ? formAt(x, z) : null;
    let chance, kind;
    if (shore < 70) { chance = theme.desert ? 0.01 : 0.05; kind = 'palm'; }
    else if (form) {
      const up = ground / form.height;
      // Nothing grows on sheer faces (domes, mesas, dunes); steep cones are wooded only on their lower slopes.
      if (form.kind === 'dome' || form.kind === 'frustum' || form.colors === 'dune' || form.colors === 'sand' || up > (form.climbable ? 0.95 : 0.45)) continue;
      chance = (form.climbable ? 0.22 : 0.45 * (1 - up / 0.45)) * (theme.desert ? 0.1 : 1); kind = form.snow ? 'pine' : species(roll);
    } else {
      const density = forestDensity(x, z);
      chance = density > 0.48 ? Math.min(0.85, (density - 0.48) * 3) : theme.desert ? 0.002 : 0.012;
      kind = inLake(x, z, 60) && lakes.some(l => l.oasis) ? 'palm' : species(roll);
    }
    if (random() > chance || treesNear(x, z, kind === 'pine' ? 5.5 : 7)) continue;
    const scale = 0.75 + random() * 0.6, height = (kind === 'pine' ? 13 + random() * 8 : kind === 'palm' ? 9 + random() * 5 : kind === 'mangrove' ? 5 + random() * 3 : 8 + random() * 5) * (0.8 + scale * 0.25);
    const tree = { x, z, y: Math.max(0, ground - 0.4), kind, radius: 0.4, height, scale, shade: Math.floor(random() * 3) };
    trees.push(tree); const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; if (!treeGrid.has(key)) treeGrid.set(key, []); treeGrid.get(key).push(tree);
  }
  function treesAround(x, z, radius) {
    const found = [], r = Math.ceil(radius / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const t of treeGrid.get(`${cx + i},${cz + j}`) || []) found.push(t);
    return found;
  }

  // Ground cover: boulders (big ones solid), fallen logs (solid), shrubs, flowers and grass (decoration).
  const rocks = [], logs = [], bushes = [], flowers = [], grass = [];
  const free = (x, z, gap) => onIsland(x, z, 1) && !inCity(x, z, 18) && !roadWithin(x, z, ROAD_WIDTH + gap) && !inLake(x, z, 4) && !inField(x, z, 2) && !nearStructure(x, z, 3) && !nearFeature(x, z) && Math.hypot(x - lighthouse.x, z - lighthouse.z) > 14;
  const sample = () => ({ x: -1500 + random() * 2000, z: -1500 + random() * 3000 });
  for (let i = 0; rocks.length < 800 && i < 40000; i++) {
    const { x, z } = sample(); if (!free(x, z, 4)) continue;
    const ground = terrainHeight(x, z), form = ground > 0 ? formAt(x, z) : null, foot = forms.some(f => formT(f, x, z) < 1.3 && f.colors !== 'dune' && f.colors !== 'sand' && f.colors !== 'downs');
    const chance = foot ? 0.55 : shoreDistance(x, z) < 50 ? 0.22 : theme.desert ? 0.06 : 0.03;
    if (random() > chance || (form && (form.colors === 'dune' || form.colors === 'sand'))) continue;
    // Boulders lie on ground they could rest on: scree at the foot of cliffs, not stuck to their faces.
    if (form && !form.climbable && ground / form.height > 0.12) continue;
    const size = foot ? 0.8 + random() ** 2 * 4.5 : 0.4 + random() ** 2 * 2.2;
    if (treesNear(x, z, size + 1.5)) continue;
    rocks.push({ x, z, y: Math.max(0, ground - size * 0.35), size, sx: size * (0.8 + random() * 0.5), sy: size * (0.55 + random() * 0.35), sz: size * (0.8 + random() * 0.5), turn: random() * TAU, tone: Math.floor(random() * 3), solid: size > 1.2 });
  }
  for (let i = 0; logs.length < (theme.desert ? 0 : 60) && i < 20000; i++) {
    const { x, z } = sample(); if (!free(x, z, 6) || terrainHeight(x, z) > 0 || forestDensity(x, z) < 0.6 || treesNear(x, z, 5)) continue;
    logs.push({ x, z, heading: random() * Math.PI, length: 5 + random() * 4, radius: 0.45 + random() * 0.2 });
  }
  const shrubs = theme.forest.shrubs || 1;
  for (let i = 0; bushes.length < 1500 * shrubs && i < 70000; i++) {
    const { x, z } = sample(); if (!free(x, z, 3) || terrainHeight(x, z) > 20) continue;
    if (random() > (forestDensity(x, z) > 0.35 ? 0.7 : 0.18 * shrubs) * (theme.desert ? 0.25 : 1)) continue;
    bushes.push({ x, z, y: terrainHeight(x, z), size: 0.7 + random() * 1.4, tone: Math.floor(random() * 3), turn: random() * TAU });
  }
  for (let i = 0; flowers.length < (theme.desert ? 0 : 2400) && i < 60000; i++) {
    const { x, z } = sample(); if (!free(x, z, 2) || terrainHeight(x, z) > 0 || forestDensity(x, z) > 0.5 || shoreDistance(x, z) < 60 || noise2(x, z, 70, theme.seed + 5) < 0.55) continue;
    flowers.push({ x, z, color: Math.floor(noise2(x, z, 50, theme.seed + 6) * 4) });
  }
  for (let i = 0; grass.length < (theme.desert ? 600 : 3000) && i < 60000; i++) {
    const { x, z } = sample(); if (!free(x, z, 1.5) || terrainHeight(x, z) > 0 || shoreDistance(x, z) < 40) continue;
    grass.push({ x, z, height: 0.5 + random() * 0.8, turn: random() * Math.PI, tone: Math.floor(random() * 2) });
  }
  const counts = new Map();
  for (const t of trees) { if (t.kind === 'palm') continue; const k = `${Math.floor(t.x / 40)},${Math.floor(t.z / 40)}`; counts.set(k, (counts.get(k) || 0) + 1); }
  const forestCells = [...counts].filter(([, n]) => n >= 5).map(([k]) => { const [i, j] = k.split(',').map(Number); return { x: i * 40 + 20, z: j * 40 + 20 }; });

  // Where you are, for the HUD and map.
  function regionAt(x, z, district = 'Downtown') {
    if (inCity(x, z)) return x > 430 ? (Math.abs(z - MARINA.z) < 60 ? 'Marina' : 'Waterfront') : district;
    if (Math.hypot(x, z) > coastRadius(Math.atan2(z, x)) + 30) return 'Open Sea';
    if (Math.hypot(x - lighthouse.x, z - lighthouse.z) < 120) return 'Lighthouse Cape';
    const lake = lakes.find(l => insideLake(l, x, z, 60));
    if (lake) return landmarks.campsite && Math.hypot(x - landmarks.campsite.x, z - landmarks.campsite.z) < 40 ? `${lake.name} Campsite` : lake.name;
    if (landmarks.feature && Math.hypot(x - landmarks.feature.x, z - landmarks.feature.z) < landmarks.feature.radius + 30) return landmarks.feature.name;
    const suburb = suburbs.find(s => Math.hypot(s.x - x, s.z - z) < s.radius + 20); if (suburb) return suburb.name;
    const form = formAt(x, z); if (form) return form.name;
    if (shoreDistance(x, z) < 60) return 'Beach';
    if (inField(x, z, 20)) return theme.fields.name;
    if (roadWithin(x, z, ROAD_WIDTH)) return 'Ring Road';
    return forestDensity(x, z) > 0.55 && !theme.desert ? theme.forest.name : theme.plains;
  }
  // The largest landform names the island's high point; the map labels its places.
  const labels = [];
  const named = new Set();
  for (const f of [...forms].sort((a, b) => b.height * b.rx - a.height * a.rx)) { if (named.has(f.name)) continue; named.add(f.name); labels.push({ text: f.name, x: f.x, z: f.z + Math.max(f.rx, f.rz) * 0.7 + 50 }); }
  for (const l of lakes) labels.push({ text: l.name, x: l.x, z: l.z + l.rz + 50 });
  for (const s of suburbs.slice(0, 1)) labels.push({ text: s.name, x: s.x, z: s.z + s.radius + 30 });
  if (landmarks.feature && !labels.some(l => l.text === landmarks.feature.name)) labels.push({ text: landmarks.feature.name, x: landmarks.feature.x, z: landmarks.feature.z - 60 });
  labels.push({ text: 'Lighthouse Cape', x: lighthouse.x + 60, z: lighthouse.z + 110 });
  let seaLine = 0; for (let d = 0; d < 360; d += 3) seaLine = Math.max(seaLine, coastRadius(d * DEG));

  return Object.freeze({
    id: cityId, theme, name: theme.island, summary: theme.summary, seaLine: seaLine + 150,
    coastRadius, onIsland, coastline, shoreDistance, inLake, lakes, routes, roadDistance, roadWithin, forms, terrainHeight, formAt,
    lamps: roadLamps, fields, structures, suburbs, landmarks, trees, treesAround, rocks, logs, bushes, flowers, grass, forestCells, forestDensity, regionAt, labels,
  });
}
const cache = new Map();
// The island a city stands on (built once per city, on first use).
export function islandFor(city) {
  const id = typeof city === 'string' ? city : city?.id || 'miami';
  if (!cache.has(id)) cache.set(id, buildIsland(id));
  return cache.get(id);
}
export function lakeShore(lake, points = 48, outset = 0) {
  const c = Math.cos(lake.turn), s = Math.sin(lake.turn);
  return Array.from({ length: points }, (_, i) => { const a = i / points * TAU, u = Math.cos(a) * (lake.rx + outset), v = Math.sin(a) * (lake.rz + outset); return { x: lake.x + u * c - v * s, z: lake.z + u * s + v * c }; });
}
// Points on a landform's surface (for its mesh and its convex physics hull).
export function formSurface(form, rings = 10, segments = 20) {
  const ts = [...new Set([...Array.from({ length: rings + 1 }, (_, k) => k / rings), ...(form.kind === 'frustum' ? [form.top] : [])])].sort((a, b) => a - b);
  const c = Math.cos(form.turn), s = Math.sin(form.turn);
  return ts.map(t => Array.from({ length: segments }, (_, j) => {
    const a = j / segments * TAU, u = Math.cos(a) * t * form.rx, v = Math.sin(a) * t * form.rz;
    return { x: form.x + u * c - v * s, y: form.height * profile(form, Math.min(t, 0.9999)) * (t >= 1 ? 0 : 1), z: form.z + u * s + v * c, t };
  }));
}
