import * as THREE from 'three';
import { COUNTRY_TREES, LANDMARKS, MOUNTAINS, ROAD_LAMPS, ROUTES, coastline } from '../../models/worldTour/worldIsland.js';

// Everything outside the city grid: ocean and shallows, beaches, countryside, mountains, the ring road with its lamps,
// countryside trees, farm fields, beach umbrellas and the lighthouse. Boxes go through the city's instanced `box`
// batches; the ground, water and mountains are their own meshes. Returns an updater for the lighthouse beam.
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

  // Countryside trees: palms along the beaches, the city's own kind inland.
  const canopy = city.trees === 'cherry' ? '#d39eae' : city.trees === 'palm' ? '#557f5f' : '#5f8a5e';
  for (const tree of COUNTRY_TREES) {
    const h = tree.height, s = tree.scale;
    box([0.7 * s, h, 0.7 * s], '#7f6f5c', [tree.x, h / 2, tree.z]);
    if (tree.beach || city.trees === 'palm') for (let a = 0; a < 5; a++) box([11 * s, 0.6, 2.2 * s], '#537e63', [tree.x, h, tree.z], a * Math.PI / 5 + tree.x);
    else { box([8 * s, 6 * s, 8 * s], canopy, [tree.x, h + 1, tree.z]); box([5 * s, 3 * s, 5 * s], canopy, [tree.x, h + 4.5 * s, tree.z]); }
  }

  // Farm fields in the southern farmland, rows of crops in alternating greens and golds.
  const fields = [[-300, 700], [-470, 640], [220, 760], [-150, 830], [380, 700]];
  for (const [x, z] of fields) {
    if (COUNTRY_TREES.some(t => Math.abs(t.x - x) < 44 && Math.abs(t.z - z) < 34)) continue;
    const crop = random() > 0.5 ? '#a9b95e' : '#cdb865';
    box([80, 0.1, 60], '#8b7a55', [x, -0.08, z]);
    for (let r = -26; r <= 26; r += 4) box([76, 0.5, 1.6], crop, [x, 0.1, z + r]);
  }

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
    update(conditions, time) {
      beam.rotation.y = time * 0.6;
      beamMaterial.opacity = Math.max(0, conditions.night - 0.2) * 0.22 + conditions.rain * 0.05;
      beam.visible = beamMaterial.opacity > 0.01;
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
