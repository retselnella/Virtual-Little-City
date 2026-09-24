import { ROAD_GRID as ROADS } from './worldPhysics.js';

// Street furniture shared by the renderer (visuals), the physics world (colliders) and pedestrian AI (spots), so all
// three always agree.
const SIDEWALK = 13, BLOCK_MIDDLES = [-300, -180, -60, 60, 180, 300];
// The safehouse and every contract pickup/drop-off stay clear of street spots (tests check this against CONTRACTS).
export const KEEP_CLEAR = [
  { x: 8, z: 12, radius: 32 }, { x: 120, z: 65, radius: 24 }, { x: -240, z: -185, radius: 24 }, { x: -120, z: -65, radius: 30 },
  { x: 240, z: 65, radius: 24 }, { x: -360, z: 180, radius: 24 },
];

function furniture() {
  const posts = [], trees = [];
  for (const x of ROADS) for (let z = -400; z < 440; z += 90) posts.push({ id: `post:${x}:${z}`, x: x + 14, z });
  for (let n = -400; n <= 400; n += 34) for (const x of [-410, 405]) trees.push({ x, z: n, radius: 0.35, height: 10, edge: true });
  for (let z = -390; z < 410; z += 45) for (const x of [-15, 15]) {
    if (ROADS.some(road => Math.abs(road - z) < 17)) continue;
    trees.push({ x, z, radius: 0.3, height: 8, edge: false });
  }
  return { posts, trees };
}

// A spot sits beside a sidewalk, between the pedestrian lane (13 from the road centre) and the buildings (17+).
// Local coordinates: `along` the street and `perp` outward from the road centre toward the buildings.
function frame(axis, road, side, along) {
  const at = (a, p) => axis === 'z' ? { x: road + side * p, z: along + a } : { x: along + a, z: road + side * p };
  const outward = axis === 'z' ? Math.atan2(side, 0) : Math.atan2(0, side);
  const size = (a, p) => axis === 'z' ? [p, a] : [a, p];
  return { at, outward, inward: outward + Math.PI, size };
}
const SPOT_TYPES = {
  // A food cart with its vendor behind the counter and a short queue on the sidewalk side.
  stall: f => ({
    props: [
      { kind: 'cart', ...f.at(0, 16), size: f.size(3, 1.4), height: 1.1, y: 0.55, collider: true },
      { kind: 'counter', ...f.at(0, 16), size: f.size(3.2, 1.6), height: 0.12, y: 1.16 },
      ...[-1.5, 1.5].map(a => ({ kind: 'pole', ...f.at(a, 16.6), size: [0.12, 0.12], height: 2.6, y: 1.3 })),
      { kind: 'awning', ...f.at(0, 16), size: f.size(3.6, 2.2), height: 0.15, y: 2.65 },
    ],
    slots: [
      { ...f.at(0, 17.4), heading: f.inward, pose: 'vendor', vendor: true, via: [f.at(2.4, 14.2), f.at(2.4, 17.4)] },
      { ...f.at(-1, 14.3), heading: f.outward, pose: 'stand' }, { ...f.at(1, 14.3), heading: f.outward, pose: 'stand' },
      { ...f.at(-2.6, 14), heading: f.outward, pose: 'stand' },
    ],
  }),
  // A bus shelter: glass back panel, roof, bench seats and a spot to stand watching for the bus.
  bus: f => ({
    props: [
      { kind: 'panel', ...f.at(0, 17), size: f.size(5, 0.15), height: 2.6, y: 1.3, collider: true },
      { kind: 'roof', ...f.at(0, 16.2), size: f.size(5.4, 2), height: 0.18, y: 2.75 },
      ...[-2.5, 2.5].map(a => ({ kind: 'pole', ...f.at(a, 15.4), size: [0.12, 0.12], height: 2.7, y: 1.35 })),
      { kind: 'seat', ...f.at(0, 16.3), size: f.size(3.6, 0.7), height: 0.12, y: 0.55 },
      { kind: 'sign', ...f.at(3.3, 14.8), size: [0.1, 0.1], height: 3, y: 1.5 }, { kind: 'plate', ...f.at(3.3, 14.8), size: f.size(0.9, 0.08), height: 0.6, y: 2.9 },
    ],
    slots: [
      { ...f.at(-1.1, 16.1), heading: f.inward, pose: 'sit' }, { ...f.at(1.1, 16.1), heading: f.inward, pose: 'sit' },
      { ...f.at(-3.4, 14.4), heading: f.inward, pose: 'stand' },
    ],
  }),
  bench: f => ({
    props: [
      { kind: 'seat', ...f.at(0, 16.3), size: f.size(2.6, 0.7), height: 0.12, y: 0.55 },
      { kind: 'backrest', ...f.at(0, 16.65), size: f.size(2.6, 0.1), height: 0.6, y: 0.95 },
      ...[-1.1, 1.1].map(a => ({ kind: 'leg', ...f.at(a, 16.3), size: f.size(0.12, 0.6), height: 0.5, y: 0.25 })),
    ],
    slots: [{ ...f.at(-0.65, 16.1), heading: f.inward, pose: 'sit' }, { ...f.at(0.65, 16.1), heading: f.inward, pose: 'sit' }],
  }),
  // Friends chatting in a small circle, facing each other.
  chat: f => {
    const centre = f.at(0, 15.4);
    return { props: [], slots: [[-1.1, 15.0], [1.1, 15.0], [0, 16.3]].map(([a, p]) => { const at = f.at(a, p); return { ...at, heading: Math.atan2(centre.x - at.x, centre.z - at.z), pose: 'chat' }; }) };
  },
};

function streetSpots(posts, trees) {
  let seed = 90210;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const spots = [], types = ['stall', 'bus', 'bench', 'chat', 'stall', 'bench', 'bus', 'chat'];
  for (const axis of ['z', 'x']) for (const road of ROADS) for (const side of [-1, 1]) for (const middle of BLOCK_MIDDLES) {
    if (random() > 0.26) continue;
    const along = middle + Math.round((random() - 0.5) * 20), f = frame(axis, road, side, along), centre = f.at(0, 15.6);
    if (Math.abs(along) > 380 || Math.abs(road + side * 17) > 430) continue;
    if (KEEP_CLEAR.some(c => Math.hypot(centre.x - c.x, centre.z - c.z) < c.radius)) continue;
    if ([...posts, ...trees].some(p => Math.hypot(centre.x - p.x, centre.z - p.z) < 6)) continue;
    if (spots.some(s => Math.hypot(centre.x - s.x, centre.z - s.z) < 30)) continue;
    const type = types[spots.length % types.length];
    spots.push({ id: `spot:${spots.length}`, type, axis, road, side, along, lane: road + side * SIDEWALK, x: centre.x, z: centre.z, ...SPOT_TYPES[type](f) });
  }
  return spots;
}

let cached = null;
export function sceneryLayout() {
  if (!cached) { const { posts, trees } = furniture(); cached = Object.freeze({ posts, trees, spots: streetSpots(posts, trees) }); }
  return cached;
}
