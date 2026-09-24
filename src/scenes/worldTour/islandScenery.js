import * as THREE from 'three';
import { BUSHES, CABINS, COUNTRY_TREES, FIELDS, FLOWERS, FOREST_CELLS, GRASS, LAKE, LANDMARKS, LOGS, MOUNTAINS, ROAD_LAMPS, ROCKS, ROUTES, coastline, lakeShore } from '../../models/worldTour/worldIsland.js';

// Everything outside the city grid: ocean and shallows, beaches, countryside, mountains, the ring road with its lamps,
// forests, rocks, wildflowers, farm fields, cabins, Mirror Lake and its campsite, beach umbrellas and the lighthouse.
// Roads and props go through the city's instanced `box` batches. Nature is instanced per map tile so that tiles far
// from the camera are skipped (small plants are only drawn close by). Returns an updater for the camera, beam and fire.
const TILE = 250, RANGE = { trees: 1500, rocks: 900, decor: 360 };
const PINE = ['#2f5a3f', '#3a6647', '#28503a'], BROAD = ['#4f7d45', '#5d8a4c', '#6b9550'], ROCK = ['#8a8d86', '#77796f', '#9a968a'];
const BUSH = ['#4e7a41', '#5f8c4a', '#6f9a52'], FLOWER = ['#f4d35e', '#f7f4ea', '#c38bd9', '#ef8fa6'], CROP = ['#a9b95e', '#cdb865', '#7fa35a'];
function shape(points) {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)));
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

export function buildIsland(root, city, { box, glowMaterial }) {
  const geometries = [], materials = [], random = seeded(city.seed * 97 + 3);
  const own = (geometry, material) => { geometries.push(geometry); materials.push(material); return new THREE.Mesh(geometry, material); };
  // Coplanar ground layers are separated with polygon offsets rather than height, so the ground stays flat underfoot.
  const layer = (color, offset, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, ...extra });

  const ocean = own(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2c7a93', roughness: 0.28, metalness: 0.15 }));
  ocean.position.y = -1.6; root.add(ocean);
  const deep = own(shape(coastline(200, -170)), layer('#3a93a6', 8, { roughness: 0.3, metalness: 0.1 })); deep.position.y = -1.5; root.add(deep);
  const shallows = own(shape(coastline(200, -60)), layer('#6cc2bd', 6, { roughness: 0.3, metalness: 0.1 })); shallows.position.y = -1.4; root.add(shallows);
  const sand = own(shape(coastline(240, 0)), layer('#e2cf9f', 4)); sand.position.y = -0.2; root.add(sand);
  const grass = own(shape(coastline(240, 55)), layer(new THREE.Color(city.ground).lerp(new THREE.Color('#79a063'), 0.55), 2)); grass.position.y = -0.15; root.add(grass);

  // Mountains: faceted cones, green at the foot, rock above and snow on the high peaks.
  const positions = [], colors = [], tint = new THREE.Color();
  const palette = { grass: new THREE.Color('#6f9a5c'), hill: new THREE.Color('#86ad69'), rock: new THREE.Color('#7c8279'), dark: new THREE.Color('#646b66'), snow: new THREE.Color('#f3f6f8') };
  for (const m of MOUNTAINS) {
    const cone = new THREE.ConeGeometry(m.radius, m.height, 14, 5, true).toNonIndexed(), pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + m.height / 2, ring = y / m.height;
      // Rough up the middle rings; the foot stays on the ground and the apex stays sharp.
      if (ring > 0.05 && ring < 0.95) { const k = 1 + Math.sin(pos.getX(i) * 0.9 + pos.getZ(i) * 1.3 + m.x) * 0.045; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
      positions.push(pos.getX(i) + m.x, y, pos.getZ(i) + m.z);
    }
    for (let i = 0; i < pos.count; i += 3) {
      const t = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 / m.height + 0.5;
      if (m.kind === 'hill') tint.copy(palette.hill).lerp(palette.grass, t);
      else if (m.snow && t > 0.7) tint.copy(palette.snow);
      else if (t < 0.28) tint.copy(palette.grass).lerp(palette.rock, t / 0.28);
      else tint.copy(palette.rock).lerp(palette.dark, random() * 0.6);
      for (let k = 0; k < 3; k++) colors.push(tint.r, tint.g, tint.b);
    }
    cone.dispose();
  }
  const mountainGeometry = new THREE.BufferGeometry();
  mountainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); mountainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  mountainGeometry.computeVertexNormals();
  root.add(own(mountainGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));

  // Outer roads: asphalt over a sandy shoulder, with centre dashes, as rotated boxes along each polyline.
  for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), rotation = Math.atan2(dx, dz);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    box([26, 0.1, length + 2], '#bdb193', [mx, 0, mz], rotation);
    box([18, 0.15, length + 2], '#36424c', [mx, 0.05, mz], rotation);
    for (let t = 8; t < length - 4; t += 16) box([0.25, 0.03, 6], '#e8d8b0', [a.x + dx * t / length, 0.15, a.z + dz * t / length], rotation);
  }
  const lampGlow = glowMaterial('#ffe3a3', 1.8);
  for (const lamp of ROAD_LAMPS) {
    box([0.3, 8, 0.3], '#596773', [lamp.x, 4, lamp.z]);
    box([1, 0.3, 3], '#fff0b9', [lamp.x + Math.sin(lamp.heading) * 1.2, 8, lamp.z + Math.cos(lamp.heading) * 1.2], lamp.heading, lampGlow);
  }

  // ---- Nature, instanced per tile.
  const unit = new THREE.BoxGeometry(1, 1, 1), stone = new THREE.DodecahedronGeometry(1, 0); geometries.push(unit, stone);
  const natureMaterials = new Map(), tiles = new Map(), dummy = new THREE.Object3D(), swatch = new THREE.Color();
  const natureMaterial = (color, flat = false) => {
    const key = color + flat;
    if (!natureMaterials.has(key)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: flat }); natureMaterials.set(key, m); materials.push(m); }
    return natureMaterials.get(key);
  };
  // Each tree remembers its instances, so trees between the player and the camera can be hidden (see hideTrees).
  const treeSlots = new Map();
  function put(layer, geometry, material, x, y, z, sx, sy, sz, turn = 0, color = null, tilt = 0, owner = null) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), key = `${layer}|${geometry.uuid}|${material.uuid}|${tx},${tz}`;
    if (!tiles.has(key)) tiles.set(key, { layer, geometry, material, x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE, matrices: [], colors: [] });
    const tile = tiles.get(key);
    if (owner) { if (!treeSlots.has(owner)) treeSlots.set(owner, []); treeSlots.get(owner).push({ tile, index: tile.matrices.length / 16 }); }
    dummy.position.set(x, y, z); dummy.rotation.set(tilt, turn, tilt * 0.6); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    tile.matrices.push(...dummy.matrix.elements); if (color) tile.colors.push(color);
  }
  let owner = null;
  const cube = (layer, color, [sx, sy, sz], [x, y, z], turn = 0) => put(layer, unit, natureMaterial(color), x, y, z, sx, sy, sz, turn, null, 0, owner);

  // Trees: tiered pines, clustered broadleaf canopies (cherry blossom in cherry cities) and beach palms.
  for (const t of COUNTRY_TREES) {
    const h = t.height, s = t.scale, y = t.y, turn = t.x * 0.37; owner = t;
    if (t.kind === 'pine') {
      cube('trees', '#5e4634', [0.55 * s, h * 0.35, 0.55 * s], [t.x, y + h * 0.17, t.z]);
      for (let k = 0; k < 4; k++) cube('trees', PINE[(t.shade + k) % 3], [(6.4 - k * 1.45) * s, h * 0.2, (6.4 - k * 1.45) * s], [t.x, y + h * (0.32 + k * 0.17), t.z], turn + k * 0.4);
    } else if (t.kind === 'broad') {
      const leaf = city.trees === 'cherry' && t.shade === 0 ? '#d6a0b4' : BROAD[t.shade];
      cube('trees', '#76604b', [0.75 * s, h * 0.6, 0.75 * s], [t.x, y + h * 0.3, t.z]);
      cube('trees', leaf, [7 * s, 4.6 * s, 7 * s], [t.x, y + h * 0.6 + 1.8 * s, t.z], turn);
      cube('trees', BROAD[(t.shade + 1) % 3], [4.8 * s, 3.4 * s, 4.8 * s], [t.x + 1.6 * s, y + h * 0.6 + 4 * s, t.z - s], turn + 0.5);
      cube('trees', leaf, [4 * s, 3 * s, 4 * s], [t.x - 1.9 * s, y + h * 0.6 + 1.2 * s, t.z + 1.5 * s], turn + 0.9);
    } else {
      cube('trees', '#8a7560', [0.6 * s, h, 0.6 * s], [t.x, y + h / 2, t.z]);
      for (let a = 0; a < 5; a++) cube('trees', '#537e63', [10 * s, 0.5, 2 * s], [t.x, y + h, t.z], a * Math.PI / 5 + turn);
    }
  }
  owner = null;
  // Boulders and bushes are faceted stones, coloured per instance; fallen logs lie in the forests.
  for (const r of ROCKS) put('rocks', stone, natureMaterial('#ffffff', true), r.x, r.y + r.sy * 0.25, r.z, r.sx, r.sy, r.sz, r.turn, swatch.set(r.y > 0 ? ROCK[(r.tone + 1) % 3] : ROCK[r.tone]).getHex(), 0.2);
  for (const b of BUSHES) put('decor', stone, natureMaterial('#ffffff', true), b.x, b.y + b.size * 0.35, b.z, b.size, b.size * 0.75, b.size, b.turn, swatch.set(BUSH[b.tone]).getHex());
  for (const l of LOGS) { cube('rocks', '#6d5540', [l.radius * 2, l.radius * 2, l.length], [l.x, l.radius, l.z], l.heading); cube('rocks', '#c9ae86', [l.radius * 1.6, l.radius * 1.6, 0.1], [l.x + Math.sin(l.heading) * l.length / 2, l.radius, l.z + Math.cos(l.heading) * l.length / 2], l.heading); }
  for (const f of FLOWERS) cube('decor', FLOWER[f.color], [0.45, 0.45, 0.45], [f.x, 0.45, f.z], f.x);
  for (const g of GRASS) cube('decor', g.tone ? '#93b367' : '#7ea35a', [0.14, g.height, 1.1], [g.x, g.height / 2, g.z], g.turn);

  // Darker forest floor under the woods.
  const floorGeometry = new THREE.CircleGeometry(30, 14).rotateX(-Math.PI / 2), floorMaterial = layer('#4b6a3d', 1);
  const floor = new THREE.InstancedMesh(floorGeometry, floorMaterial, FOREST_CELLS.length); geometries.push(floorGeometry); materials.push(floorMaterial);
  FOREST_CELLS.forEach((c, i) => { dummy.position.set(c.x, -0.15, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); floor.setMatrixAt(i, dummy.matrix); });
  floor.computeBoundingSphere(); root.add(floor);

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

  // Farm fields: tilled earth, crop rows and a wooden fence with a gate on the north side.
  for (const f of FIELDS) {
    box([f.width, 0.1, f.depth], '#8b7a55', [f.x, -0.08, f.z]);
    for (let r = -f.depth / 2 + 4; r <= f.depth / 2 - 4; r += 4) box([f.width - 4, 0.6, 1.6], CROP[f.crop], [f.x, 0.1, f.z + r]);
    const w = f.width / 2 + 2, d = f.depth / 2 + 2;
    for (const [x0, z0, x1, z1] of [[-w, d, w, d], [-w, -d, -w, d], [w, -d, w, d], [-w, -d, -6, -d], [6, -d, w, -d]]) {
      const length = Math.hypot(x1 - x0, z1 - z0), turn = Math.atan2(x1 - x0, z1 - z0);
      for (const y of [0.6, 1.1]) box([0.12, 0.14, length], '#9b7b58', [f.x + (x0 + x1) / 2, y, f.z + (z0 + z1) / 2], turn);
      for (let t = 0; t <= length; t += 5) box([0.25, 1.4, 0.25], '#7d6246', [f.x + x0 + (x1 - x0) * t / length, 0.7, f.z + z0 + (z1 - z0) * t / length]);
    }
  }
  // Log cabins with a stepped roof, chimney and windows that glow at night.
  const cabinWindow = glowMaterial('#35424a', 1.4, '#ffc670');
  for (const c of CABINS) {
    const at = (dx, dz) => [c.x + Math.cos(c.heading) * dx + Math.sin(c.heading) * dz, c.z - Math.sin(c.heading) * dx + Math.cos(c.heading) * dz];
    box([c.width, c.height, c.depth], '#7a5a3c', [c.x, c.height / 2, c.z], c.heading);
    for (let y = 0.6; y < c.height; y += 1.1) box([c.width + 0.3, 0.25, c.depth + 0.3], '#6a4c32', [c.x, y, c.z], c.heading);
    for (let k = 0; k < 4; k++) box([c.width + 1.4, 0.8, (c.depth + 2) * (1 - k * 0.26)], '#5b3b2a', [c.x, c.height + 0.4 + k * 0.8, c.z], c.heading);
    const [cx, cz] = at(c.width * 0.3, -c.depth * 0.2); box([1, 3, 1], '#8a8378', [cx, c.height + 2.5, cz], c.heading);
    const [dx, dz] = at(0, c.depth / 2 + 0.06); box([1.6, 2.6, 0.12], '#4a3322', [dx, 1.3, dz], c.heading);
    for (const side of [-1, 1]) { const [wx, wz] = at(side * 3, c.depth / 2 + 0.06); box([1.4, 1.1, 0.12], '#35424a', [wx, 2.2, wz], c.heading, cabinWindow); }
    const [px, pz] = at(0, c.depth / 2 + 1.5); box([4, 0.3, 2.4], '#8f7152', [px, 0.15, pz], c.heading);
  }

  // Mirror Lake: open water with a muddy rim, reeds, and a campsite on the south shore.
  const lakeShape = points => { const g = shape(points); geometries.push(g); return g; };
  const rim = new THREE.Mesh(lakeShape(lakeShore(48, 6)), layer('#8d8a63', 0.5)); rim.position.y = -0.12; root.add(rim); materials.push(rim.material);
  const water = new THREE.Mesh(lakeShape(lakeShore(48, 0)), layer('#3f95a8', -1, { roughness: 0.12, metalness: 0.25 })); water.position.y = -0.06; root.add(water); materials.push(water.material);
  lakeShore(70, 3).forEach((p, i) => { if (i % 3) box([0.12, 1.4 + (i % 4) * 0.3, 0.12], '#6f8f4a', [p.x, 0.7, p.z]); });
  const { campsite: C } = LANDMARKS;
  const tentGeometry = new THREE.ConeGeometry(2.6, 2.4, 4).rotateY(Math.PI / 4); geometries.push(tentGeometry);
  for (const [side, color] of [[-1, '#e07a4f'], [1, '#4f8fbf']]) { const tent = own(tentGeometry.clone(), new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true })); tent.position.set(C.x + side * 7, 1.2, C.z + 3); root.add(tent); }
  for (const a of [0, 2.1, 4.2]) box([2.6, 0.5, 0.5], '#6d5540', [C.x + Math.sin(a) * 3, 0.25, C.z - 3 + Math.cos(a) * 3], a);
  for (let a = 0; a < 7; a++) box([0.5, 0.35, 0.5], '#77796f', [C.x + Math.sin(a) * 1.1, 0.18, C.z - 3 + Math.cos(a) * 1.1]);
  const fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glowMaterial('#ff9a3c', 2.5, '#ff7a1a')); geometries.push(fire.geometry); fire.position.set(C.x, 0.7, C.z - 3); root.add(fire);

  // Beach umbrellas and loungers along the southern and western beaches.
  const coast = coastline(120, 32);
  coast.forEach((p, i) => {
    const angle = Math.atan2(p.z, p.x) * 180 / Math.PI;
    if (i % 3 || !((angle > 40 && angle < 150) || angle > 165 || angle < -170)) return;
    const color = i % 2 ? city.color : '#f3eee5';
    box([0.2, 3.2, 0.2], '#e6e1d6', [p.x, 1.6, p.z]); box([4.4, 0.35, 4.4], color, [p.x, 3.3, p.z], i);
    box([1.2, 0.3, 3], '#f1e7d0', [p.x + 2.4, 0.25, p.z + 1], i);
  });

  // The lighthouse on the western cape: striped tower, lamp room and a sweeping beam at night.
  const { lighthouse: L } = LANDMARKS, tower = new THREE.Group(); tower.position.set(L.x, 0, L.z); root.add(tower);
  const ring = (r1, r2, h, y, color, material) => { const g = new THREE.CylinderGeometry(r1, r2, h, 16); const mesh = own(g, material || new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); mesh.position.y = y; tower.add(mesh); return mesh; };
  ring(7, 8, 2, 1, '#d7d2c6'); ring(4, 5, 28, 15, '#f4f1ea'); ring(4.3, 4.6, 4, 12, '#c84b45'); ring(3.8, 4.1, 4, 22, '#c84b45');
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.5, 12), glowMaterial('#fff4c2', 2.2)); geometries.push(lampRoom.geometry); lampRoom.position.y = 31; tower.add(lampRoom);
  ring(0, 4.2, 3, 34.2, '#2f3b45');
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#fff2c4', vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beamGeometry = new THREE.ConeGeometry(14, 260, 20, 6, true).rotateZ(Math.PI / 2).translate(130, 0, 0);
  // The beam fades out along its length (additive blending: darker vertices add less light).
  const fade = beamGeometry.attributes.position.array.length / 3, shade = new Float32Array(fade * 3);
  for (let i = 0; i < fade; i++) shade.fill((1 - beamGeometry.attributes.position.getX(i) / 260) ** 1.5, i * 3, i * 3 + 3);
  beamGeometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  const beam = own(beamGeometry, beamMaterial); beam.position.y = 31; tower.add(beam);

  return {
    // Points of light the renderer should pool on the ground at night.
    lights: [{ x: LANDMARKS.campsite.x, z: LANDMARKS.campsite.z - 3 }, ...CABINS.map(c => ({ x: c.x + Math.sin(c.heading) * (c.depth / 2 + 3), z: c.z + Math.cos(c.heading) * (c.depth / 2 + 3) }))],
    hideTrees,
    update(conditions, time, camera) {
      if (camera) for (const { mesh, tile } of meshes) mesh.visible = Math.hypot(camera.position.x - tile.x, camera.position.z - tile.z) < RANGE[tile.layer] + TILE * 0.7;
      fire.scale.set(1, 0.8 + Math.sin(time * 13) * 0.15 + Math.sin(time * 7.3) * 0.1, 1); fire.rotation.y = time * 2;
      beam.rotation.y = time * 0.6;
      beamMaterial.opacity = Math.max(0, conditions.night - 0.2) * 0.22 + conditions.rain * 0.05;
      beam.visible = beamMaterial.opacity > 0.01;
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
