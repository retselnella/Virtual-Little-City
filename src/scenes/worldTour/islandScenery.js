import * as THREE from 'three';
import { MARINA, formSurface, lakeShore } from '../../models/worldTour/worldIsland.js';

// Everything outside the city grid for one island (worldIsland.js islandFor): sea, beaches, countryside, the island's
// landforms, lakes, forests, farms, suburb houses, landmark, lamps, lighthouse, campsite and the marina pier. Roads and
// buildings go through the city's instanced `box` batches; nature is instanced per map tile so tiles far from the
// camera are skipped (small plants are only drawn close by). Returns an updater and the list of night lights.
const TILE = 250, RANGE = { trees: 1500, rocks: 900, decor: 360 };
const PINE = ['#2f5a3f', '#3a6647', '#28503a'], BROAD = ['#4f7d45', '#5d8a4c', '#6b9550'], CHERRY = ['#e2a6b9', '#d68fa6', '#eab8c7'], MANGROVE = ['#3e6340', '#35583a', '#476e45'];
const FLOWER = ['#f4d35e', '#f7f4ea', '#c38bd9', '#ef8fa6'], CROP = ['#a9b95e', '#cdb865', '#7fa35a'];
function shape(points) {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)));
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const color = value => new THREE.Color(value);

// Colour of a landform face from its height fraction (0 foot … 1 top) and how far in from the foot it is.
function formColor(form, up, t, ground, random, out) {
  const g = ground, rock = g.rock;
  switch (form.colors) {
    case 'volcano': case 'basalt': {
      if (form.snow && up > form.snow) return out.set(up > form.snow + 0.04 || random() > 0.3 ? '#f2f5f7' : '#cfd6da');
      if (up < 0.18) return out.set(g.grass).lerp(color('#4f7a45'), up / 0.18);
      if (up < 0.42) return out.set(form.colors === 'basalt' ? '#3f6a3a' : '#2f5a3f').lerp(color('#5b5a52'), random() * 0.25);
      return out.set(form.colors === 'basalt' ? '#57504a' : '#6c6862').lerp(color('#3f3a36'), random() * 0.5 + (form.colors === 'basalt' ? (up - 0.42) : 0));
    }
    case 'terrace': {
      // Paddies step up the hill in bands, each with a darker bund at its lip.
      const band = form.height * up, step = band % 3.2;
      if (up > 0.94) return out.set('#6f9f47');
      return out.set(step < 0.5 ? '#5a4a33' : Math.floor(band / 3.2) % 2 ? '#8cbd5c' : '#79ad52').lerp(color('#6fa3a0'), step > 2.6 ? 0.35 : 0);
    }
    case 'dune': return out.set(Math.floor(form.height * up * 1.4) % 2 ? '#e2c38b' : '#d7b57c').lerp(color('#f0d9a6'), up * 0.4);
    case 'sand': return out.set(up > 0.6 ? '#9fb27a' : '#ecdcae').lerp(color('#e3cf9a'), random() * 0.3);
    case 'mesa': {
      if (form.kind === 'frustum' && t <= form.top + 0.01) return out.set(g.desert ? rock[2] : '#9aa574').lerp(color(g.desert ? rock[0] : '#b3ac8c'), random() * 0.45);
      if (up < 0.12) return out.set(g.desert ? g.sand : g.grass).lerp(color(rock[1]), up / 0.12);
      return out.set(rock[Math.floor(form.height * up / 7) % 3]).lerp(color('#000000'), random() * 0.08);
    }
    case 'granite': {
      if (up < 0.3) return out.set(up < 0.12 ? '#3f6a3a' : '#4f7d45').lerp(color('#355530'), random() * 0.5);
      return out.set(rock[0]).lerp(color(rock[2]), random() * 0.6).lerp(color('#5f5a54'), up > 0.8 ? 0.2 : 0);
    }
    case 'downs': return out.set(g.grass).lerp(color('#98bf72'), up * 0.6 + random() * 0.15).lerp(color('#e8e6dc'), up > 0.85 && random() > 0.6 ? 0.5 : 0);
    case 'rock': return up < 0.2 ? out.set(g.grass).lerp(color('#5a6b44'), up / 0.2) : out.set(rock[0]).lerp(color(rock[2]), random() * 0.6);
    default: // forested cone hills
      if (up < 0.15) return out.set(g.grass).lerp(color('#4f7d45'), up / 0.15);
      if (up < 0.75) return out.set('#48763f').lerp(color('#3a6436'), random() * 0.6);
      return out.set('#6d8a5a').lerp(color(rock[0]), (up - 0.75) * 2);
  }
}

export function buildIsland(root, city, island, { box, glowMaterial }) {
  const geometries = [], materials = [], random = seeded(island.theme.seed * 97 + 3), ground = { ...island.theme.ground, desert: !!island.theme.desert };
  const own = (geometry, material) => { geometries.push(geometry); materials.push(material); return new THREE.Mesh(geometry, material); };
  // Coplanar ground layers are separated with polygon offsets rather than height, so the ground stays flat underfoot.
  const layer = (c, offset, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, ...extra });

  // The sea follows the camera (it is endless); shallows, beach and land follow the island's coastline.
  const ocean = own(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2c7a93', roughness: 0.28, metalness: 0.15 }));
  ocean.position.y = -1.6; root.add(ocean);
  const deep = own(shape(island.coastline(200, -170)), layer('#3a93a6', 8, { roughness: 0.3, metalness: 0.1 })); deep.position.y = -1.5; root.add(deep);
  const shallows = own(shape(island.coastline(200, -60)), layer('#6cc2bd', 6, { roughness: 0.3, metalness: 0.1 })); shallows.position.y = -1.4; root.add(shallows);
  const sand = own(shape(island.coastline(240, 0)), layer(ground.sand, 4)); sand.position.y = -0.2; root.add(sand);
  const grass = own(shape(island.coastline(240, 55)), layer(new THREE.Color(ground.grass).lerp(new THREE.Color(city.ground), 0.25), 2)); grass.position.y = -0.15; root.add(grass);

  // Landforms: faceted meshes of exactly the surface the physics hull and terrainHeight() use.
  const positions = [], colors = [], tint = new THREE.Color();
  for (const form of island.forms) {
    const rings = form.kind === 'terrace' ? 26 : 14, grid = formSurface(form, rings, 30);
    const crater = form.kind === 'volcano' ? 0.08 : 0;
    const lift = p => p.t < crater ? p.y - (crater - p.t) * form.height * 0.9 : p.y;
    for (let r = 0; r < grid.length - 1; r++) for (let j = 0; j < grid[r].length; j++) {
      const a = grid[r][j], b = grid[r][(j + 1) % grid[r].length], c = grid[r + 1][j], d = grid[r + 1][(j + 1) % grid[r].length];
      for (const tri of [[a, c, b], [b, c, d]]) {
        const up = tri.reduce((sum, p) => sum + p.y, 0) / 3 / form.height, t = tri.reduce((sum, p) => sum + p.t, 0) / 3;
        if (crater && t < crater) tint.set('#2f2a27'); else formColor(form, up, t, ground, random, tint);
        for (const p of tri) { positions.push(p.x, lift(p), p.z); colors.push(tint.r, tint.g, tint.b); }
      }
    }
  }
  const formGeometry = new THREE.BufferGeometry();
  formGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); formGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  formGeometry.computeVertexNormals();
  root.add(own(formGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
  // Volcano smoke: a slow column of puffs above the crater.
  const smokeMaterial = new THREE.MeshStandardMaterial({ color: '#d7d7d2', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }); materials.push(smokeMaterial);
  const puffGeometry = new THREE.IcosahedronGeometry(1, 0); geometries.push(puffGeometry);
  const puffs = island.forms.filter(f => f.smoke).flatMap(f => Array.from({ length: 10 }, (_, i) => { const m = new THREE.Mesh(puffGeometry, smokeMaterial); root.add(m); return { m, f, phase: i / 10 }; }));

  // Outer roads: asphalt over a sandy shoulder, with centre dashes; suburb streets are narrower.
  for (const route of island.routes) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), rotation = Math.atan2(dx, dz), street = route.id.startsWith('suburb');
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    box([street ? 18 : 26, 0.1, length + 2], street ? '#b9bdb6' : ground.desert ? '#d8c59a' : '#bdb193', [mx, 0, mz], rotation);
    box([street ? 12 : 18, 0.15, length + 2], '#36424c', [mx, 0.05, mz], rotation);
    if (!street) for (let t = 8; t < length - 4; t += 16) box([0.25, 0.03, 6], '#e8d8b0', [a.x + dx * t / length, 0.15, a.z + dz * t / length], rotation);
  }
  const lampGlow = glowMaterial('#ffe3a3', 1.8);
  for (const lamp of island.lamps) {
    box([0.3, 8, 0.3], '#596773', [lamp.x, 4, lamp.z]);
    box([1, 0.3, 3], '#fff0b9', [lamp.x + Math.sin(lamp.heading) * 1.2, 8, lamp.z + Math.cos(lamp.heading) * 1.2], lamp.heading, lampGlow);
  }

  // ---- Nature, instanced per tile.
  const unit = new THREE.BoxGeometry(1, 1, 1), stone = new THREE.DodecahedronGeometry(1, 0); geometries.push(unit, stone);
  const natureMaterials = new Map(), tiles = new Map(), dummy = new THREE.Object3D(), swatch = new THREE.Color();
  const natureMaterial = (c, flat = false) => {
    const key = c + flat;
    if (!natureMaterials.has(key)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: flat }); natureMaterials.set(key, m); materials.push(m); }
    return natureMaterials.get(key);
  };
  // Each tree remembers its instances, so trees between the player and the camera can be hidden (see hideTrees).
  const treeSlots = new Map();
  let owner = null;
  function put(layerName, geometry, material, x, y, z, sx, sy, sz, turn = 0, c = null, tilt = 0) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), key = `${layerName}|${geometry.uuid}|${material.uuid}|${tx},${tz}`;
    if (!tiles.has(key)) tiles.set(key, { layer: layerName, geometry, material, x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE, matrices: [], colors: [] });
    const tile = tiles.get(key);
    if (owner) { if (!treeSlots.has(owner)) treeSlots.set(owner, []); treeSlots.get(owner).push({ tile, index: tile.matrices.length / 16 }); }
    dummy.position.set(x, y, z); dummy.rotation.set(tilt, turn, tilt * 0.6); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    tile.matrices.push(...dummy.matrix.elements); if (c) tile.colors.push(c);
  }
  const cube = (layerName, c, [sx, sy, sz], [x, y, z], turn = 0) => put(layerName, unit, natureMaterial(c), x, y, z, sx, sy, sz, turn);
  const canopy = t => t.kind === 'cherry' ? CHERRY[t.shade] : t.kind === 'mangrove' ? MANGROVE[t.shade] : BROAD[t.shade];
  for (const t of island.trees) {
    const h = t.height, s = t.scale, y = t.y, turn = t.x * 0.37; owner = t;
    if (t.kind === 'pine') {
      cube('trees', '#5e4634', [0.55 * s, h * 0.35, 0.55 * s], [t.x, y + h * 0.17, t.z]);
      for (let k = 0; k < 4; k++) cube('trees', PINE[(t.shade + k) % 3], [(6.4 - k * 1.45) * s, h * 0.2, (6.4 - k * 1.45) * s], [t.x, y + h * (0.32 + k * 0.17), t.z], turn + k * 0.4);
    } else if (t.kind === 'palm') {
      cube('trees', '#8a7560', [0.6 * s, h, 0.6 * s], [t.x, y + h / 2, t.z]);
      for (let a = 0; a < 5; a++) cube('trees', '#537e63', [10 * s, 0.5, 2 * s], [t.x, y + h, t.z], a * Math.PI / 5 + turn);
    } else if (t.kind === 'mangrove') {
      // Low, wide crowns on arching prop roots.
      for (const [dx, dz] of [[-1, -1], [1, -1], [0, 1.2]]) cube('trees', '#6a5a45', [0.35 * s, h * 0.45, 0.35 * s], [t.x + dx * s, y + h * 0.22, t.z + dz * s], turn);
      cube('trees', canopy(t), [8 * s, 3.4 * s, 7 * s], [t.x, y + h * 0.55 + 1.2 * s, t.z], turn);
      cube('trees', MANGROVE[(t.shade + 1) % 3], [5.5 * s, 2.6 * s, 5.5 * s], [t.x + 1.4 * s, y + h * 0.55 + 2.6 * s, t.z - s], turn + 0.6);
    } else {
      cube('trees', '#76604b', [0.75 * s, h * 0.6, 0.75 * s], [t.x, y + h * 0.3, t.z]);
      cube('trees', canopy(t), [7 * s, 4.6 * s, 7 * s], [t.x, y + h * 0.6 + 1.8 * s, t.z], turn);
      cube('trees', t.kind === 'cherry' ? CHERRY[(t.shade + 1) % 3] : BROAD[(t.shade + 1) % 3], [4.8 * s, 3.4 * s, 4.8 * s], [t.x + 1.6 * s, y + h * 0.6 + 4 * s, t.z - s], turn + 0.5);
      cube('trees', canopy(t), [4 * s, 3 * s, 4 * s], [t.x - 1.9 * s, y + h * 0.6 + 1.2 * s, t.z + 1.5 * s], turn + 0.9);
    }
  }
  owner = null;
  const rockTone = ground.rock, bushTone = ground.desert ? ['#9c9660', '#8a8a58', '#b0a56c'] : ['#4e7a41', '#5f8c4a', '#6f9a52'];
  for (const r of island.rocks) put('rocks', stone, natureMaterial('#ffffff', true), r.x, r.y + r.sy * 0.25, r.z, r.sx, r.sy, r.sz, r.turn, swatch.set(rockTone[r.tone]).getHex(), 0.2);
  for (const b of island.bushes) put('decor', stone, natureMaterial('#ffffff', true), b.x, b.y + b.size * 0.35, b.z, b.size, b.size * 0.75, b.size, b.turn, swatch.set(bushTone[b.tone]).getHex());
  for (const l of island.logs) { cube('rocks', '#6d5540', [l.radius * 2, l.radius * 2, l.length], [l.x, l.radius, l.z], l.heading); cube('rocks', '#c9ae86', [l.radius * 1.6, l.radius * 1.6, 0.1], [l.x + Math.sin(l.heading) * l.length / 2, l.radius, l.z + Math.cos(l.heading) * l.length / 2], l.heading); }
  for (const f of island.flowers) cube('decor', FLOWER[f.color], [0.45, 0.45, 0.45], [f.x, 0.45, f.z], f.x);
  for (const g of island.grass) cube('decor', ground.desert ? '#b9a770' : g.tone ? '#93b367' : '#7ea35a', [0.14, g.height, 1.1], [g.x, g.height / 2, g.z], g.turn);
  const floorGeometry = new THREE.CircleGeometry(30, 14).rotateX(-Math.PI / 2), floorMaterial = layer(ground.floor, 1);
  const floor = new THREE.InstancedMesh(floorGeometry, floorMaterial, Math.max(1, island.forestCells.length)); geometries.push(floorGeometry); materials.push(floorMaterial);
  floor.count = island.forestCells.length;
  island.forestCells.forEach((c, i) => { dummy.position.set(c.x, -0.15, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); floor.setMatrixAt(i, dummy.matrix); });
  floor.computeBoundingSphere(); root.add(floor);

  // Farms: each theme's kind of field, fenced or hedged (paddies have mud bunds instead).
  for (const f of island.fields) {
    const w = f.width, d = f.depth;
    if (f.kind === 'paddy') {
      box([w, 0.1, d], '#6fa4a0', [f.x, -0.07, f.z]);
      for (let r = -d / 2 + 3; r <= d / 2 - 3; r += 3) box([w - 4, 0.35, 0.9], '#86b85a', [f.x, 0.05, f.z + r]);
      for (const side of [-1, 1]) { box([w + 2, 0.5, 1.2], '#6b5a3e', [f.x, 0.1, f.z + side * (d / 2 + 0.6)]); box([1.2, 0.5, d + 2], '#6b5a3e', [f.x + side * (w / 2 + 0.6), 0.1, f.z]); }
      continue;
    }
    box([w, 0.1, d], f.kind === 'hedged' ? '#7e8f4f' : '#8b7a55', [f.x, -0.08, f.z]);
    for (let r = -d / 2 + 4; r <= d / 2 - 4; r += f.kind === 'vineyard' ? 3 : 6) {
      if (f.kind === 'orchard') for (let u = -w / 2 + 4; u <= w / 2 - 4; u += 6) {
        box([0.3, 1.4, 0.3], '#6d5540', [f.x + u, 0.7, f.z + r]); box([2.8, 2.2, 2.8], island.id === 'rio' ? '#6f9a3c' : '#4f7d3e', [f.x + u, 2.4, f.z + r], u);
        if (island.id !== 'rio') box([0.5, 0.5, 0.5], '#f29a38', [f.x + u + 1, 2.2, f.z + r + 1.3]);
      } else if (f.kind === 'palmgrove') for (let u = -w / 2 + 6; u <= w / 2 - 6; u += 10) {
        box([0.5, 7, 0.5], '#8a7560', [f.x + u, 3.5, f.z + r]); for (let a = 0; a < 5; a++) box([7, 0.4, 1.4], '#6b8a4f', [f.x + u, 7, f.z + r], a * Math.PI / 5 + u);
      } else if (f.kind === 'vineyard') box([w - 4, 1.2, 0.8], '#4d6b35', [f.x, 0.6, f.z + r]);
      else box([w - 4, 0.6, 1.6], CROP[f.crop], [f.x, 0.1, f.z + r]);
    }
    const W = w / 2 + 2, D = d / 2 + 2;
    for (const [x0, z0, x1, z1] of [[-W, D, W, D], [-W, -D, -W, D], [W, -D, W, D], [-W, -D, -6, -D], [6, -D, W, -D]]) {
      const length = Math.hypot(x1 - x0, z1 - z0), turn = Math.atan2(x1 - x0, z1 - z0);
      if (f.kind === 'hedged') { box([1.6, 1.8, length], '#3f6a37', [f.x + (x0 + x1) / 2, 0.9, f.z + (z0 + z1) / 2], turn); continue; }
      for (const y of [0.6, 1.1]) box([0.12, 0.14, length], '#9b7b58', [f.x + (x0 + x1) / 2, y, f.z + (z0 + z1) / 2], turn);
      for (let t = 0; t <= length; t += 5) box([0.25, 1.4, 0.25], '#7d6246', [f.x + x0 + (x1 - x0) * t / length, 0.7, f.z + z0 + (z1 - z0) * t / length]);
    }
  }
  // Buildings and landmarks: plain boxes from the model (windows glow at night); tents are pyramids.
  const windowGlow = glowMaterial('#3b4a55', 1.4, '#ffcf85');
  const tentGeometry = new THREE.ConeGeometry(2.6, 2.4, 4).rotateY(Math.PI / 4); geometries.push(tentGeometry);
  let tents = 0;
  for (const s of island.structures) {
    if (s.tent) { const tent = own(tentGeometry.clone(), new THREE.MeshStandardMaterial({ color: tents++ % 2 ? '#4f8fbf' : '#e07a4f', roughness: 0.8, flatShading: true })); tent.position.set(s.x, 1.2, s.z); root.add(tent); continue; }
    box([s.w, s.h, s.d], s.color, [s.x, s.y + s.h / 2, s.z], s.turn, s.glow ? windowGlow : null);
  }

  // Lakes: open water with a rim; reeds round ordinary lakes (the oasis has palms instead).
  for (const lake of island.lakes) {
    const rim = own(shape(lakeShore(lake, 48, 6)), layer(ground.desert ? '#c9ad78' : '#8d8a63', 0.5)); rim.position.y = -0.12; root.add(rim);
    const water = own(shape(lakeShore(lake, 48, 0)), layer(lake.oasis ? '#3fa5a0' : '#3f95a8', -1, { roughness: 0.12, metalness: 0.25 })); water.position.y = -0.06; root.add(water);
    if (!lake.oasis) lakeShore(lake, 70, 3).forEach((p, i) => { if (i % 3) box([0.12, 1.4 + (i % 4) * 0.3, 0.12], '#6f8f4a', [p.x, 0.7, p.z]); });
  }
  let fire = null;
  const C = island.landmarks.campsite;
  if (C) {
    for (const a of [0, 2.1, 4.2]) box([2.6, 0.5, 0.5], '#6d5540', [C.x + Math.sin(a) * 3, 0.25, C.z - 3 + Math.cos(a) * 3], a);
    for (let a = 0; a < 7; a++) box([0.5, 0.35, 0.5], '#77796f', [C.x + Math.sin(a) * 1.1, 0.18, C.z - 3 + Math.cos(a) * 1.1]);
    fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glowMaterial('#ff9a3c', 2.5, '#ff7a1a')); geometries.push(fire.geometry); fire.position.set(C.x, 0.7, C.z - 3); root.add(fire);
  }
  // Beach umbrellas on the sunny beaches (not in the desert's open sand).
  if (!ground.desert) island.coastline(120, 32).forEach((p, i) => {
    const angle = Math.atan2(p.z, p.x) * 180 / Math.PI;
    if (i % 3 || !((angle > 40 && angle < 150) || angle > 165 || angle < -170)) return;
    box([0.2, 3.2, 0.2], '#e6e1d6', [p.x, 1.6, p.z]); box([4.4, 0.35, 4.4], i % 2 ? city.color : '#f3eee5', [p.x, 3.3, p.z], i);
    box([1.2, 0.3, 3], '#f1e7d0', [p.x + 2.4, 0.25, p.z + 1], i);
  });

  // The marina pier on the city waterfront: deck on piles, bollards and a few moored boats.
  const pierLength = MARINA.x1 - MARINA.x0, pierX = (MARINA.x0 + MARINA.x1) / 2;
  box([pierLength, 0.35, MARINA.width], '#8f7152', [pierX, 0.15, MARINA.z]);
  for (let x = MARINA.x0 + 4; x < MARINA.x1; x += 8) for (const side of [-1, 1]) { box([0.5, 2.4, 0.5], '#5b4634', [x, -0.9, MARINA.z + side * (MARINA.width / 2 - 0.3)]); box([0.35, 0.6, 0.35], '#2f3b45', [x, 0.6, MARINA.z + side * (MARINA.width / 2 - 0.5)]); }
  for (const [x, z, c] of [[488, MARINA.z - 11, '#f3eee5'], [512, MARINA.z - 11, '#d98b6a'], [470, MARINA.z + 11, '#9bb7ff']]) { box([3, 1.2, 8], c, [x, -1, z]); box([2, 1, 3], '#e9eef0', [x, 0.1, z - 0.5]); }

  // The lighthouse on the island's western headland: striped tower, lamp room and a sweeping beam at night.
  const L = island.landmarks.lighthouse, tower = new THREE.Group(); tower.position.set(L.x, 0, L.z); root.add(tower);
  const ring = (r1, r2, h, y, c, material) => { const g = new THREE.CylinderGeometry(r1, r2, h, 16); const mesh = own(g, material || new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); mesh.position.y = y; tower.add(mesh); return mesh; };
  ring(7, 8, 2, 1, '#d7d2c6'); ring(4, 5, 28, 15, '#f4f1ea'); ring(4.3, 4.6, 4, 12, '#c84b45'); ring(3.8, 4.1, 4, 22, '#c84b45');
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.5, 12), glowMaterial('#fff4c2', 2.2)); geometries.push(lampRoom.geometry); lampRoom.position.y = 31; tower.add(lampRoom);
  ring(0, 4.2, 3, 34.2, '#2f3b45');
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#fff2c4', vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beamGeometry = new THREE.ConeGeometry(14, 260, 20, 6, true).rotateZ(Math.PI / 2).translate(130, 0, 0);
  // The beam fades out along its length (additive blending: darker vertices add less light).
  const fade = beamGeometry.attributes.position.count, shade = new Float32Array(fade * 3);
  for (let i = 0; i < fade; i++) shade.fill((1 - beamGeometry.attributes.position.getX(i) / 260) ** 1.5, i * 3, i * 3 + 3);
  beamGeometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  const beam = own(beamGeometry, beamMaterial); beam.position.y = 31; tower.add(beam);

  const meshes = [];
  for (const tile of tiles.values()) {
    const mesh = new THREE.InstancedMesh(tile.geometry, tile.material, tile.matrices.length / 16);
    mesh.instanceMatrix.array.set(tile.matrices);
    if (tile.colors.length) tile.colors.forEach((c, i) => mesh.setColorAt(i, swatch.setHex(c)));
    mesh.computeBoundingSphere(); root.add(mesh); meshes.push({ mesh, tile }); tile.mesh = mesh; tile.matrices = null; tile.colors = null;
  }
  tiles.clear();
  let hidden = new Set();
  function hideTrees(next) {
    const dirty = new Set(), gone = new THREE.Matrix4().makeScale(0, 0, 0).elements;
    for (const t of hidden) if (!next.has(t)) for (const slot of treeSlots.get(t)) { slot.tile.mesh.instanceMatrix.array.set(slot.saved, slot.index * 16); dirty.add(slot.tile.mesh); }
    for (const t of next) if (!hidden.has(t)) for (const slot of treeSlots.get(t) || []) {
      const array = slot.tile.mesh.instanceMatrix.array; slot.saved = array.slice(slot.index * 16, slot.index * 16 + 16); array.set(gone, slot.index * 16); dirty.add(slot.tile.mesh);
    }
    dirty.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    hidden = next;
  }
  return {
    // Points of light the renderer should pool on the ground at night.
    lights: [...(C ? [{ x: C.x, z: C.z - 3 }] : []), { x: pierX, z: MARINA.z }],
    hideTrees,
    update(conditions, time, camera) {
      if (camera) {
        ocean.position.x = camera.position.x; ocean.position.z = camera.position.z;
        for (const { mesh, tile } of meshes) mesh.visible = Math.hypot(camera.position.x - tile.x, camera.position.z - tile.z) < RANGE[tile.layer] + TILE * 0.7;
      }
      for (const { m, f, phase } of puffs) { const k = (time * 0.04 + phase) % 1; m.position.set(f.x + Math.sin(k * 3 + phase * 9) * 12 + k * 60, f.height + 10 + k * 160, f.z + k * 30); m.scale.setScalar(12 + k * 38); }
      smokeMaterial.opacity = 0.5 * (1 - conditions.rain * 0.5);
      if (fire) { fire.scale.set(1, 0.8 + Math.sin(time * 13) * 0.15 + Math.sin(time * 7.3) * 0.1, 1); fire.rotation.y = time * 2; }
      beam.rotation.y = time * 0.6;
      beamMaterial.opacity = Math.max(0, conditions.night - 0.2) * 0.22 + conditions.rain * 0.05;
      beam.visible = beamMaterial.opacity > 0.01;
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
