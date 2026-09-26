// Ambient island life: the people who make each island feel lived in, beyond the simulated street pedestrians. By day,
// families gather under the beach umbrellas while their children play, swimmers bob in the shallows, and families
// picnic by the lakes and at the campsite; café tables fill up in town. After dark the beaches empty to a few bonfire
// circles, and the city comes alive: crowds outside the shops and bars, chatting and dancing under the neon.
// Everything is laid out from the island and the city seed, so every player sees the same groups. They are background
// life: drawn only near the camera, not simulated (they do not walk the streets, flee or get hurt).
import { LOUNGE } from './venues.js';

const BEACH = angle => (angle > 40 && angle < 150) || angle > 165 || angle < -170; // the sunny beach stretches, in degrees
const SKIN = ['#f3cfb0', '#e0ac85', '#c18b63', '#9a6644', '#6d452e', '#4d3122'];
const HAIR = ['#2a211c', '#4b3428', '#7d532f', '#c7a266', '#161616', '#a7a39c', '#8c3b2b'];
const SUMMER = ['#ff8a80', '#ffd166', '#7bd3ea', '#a0e37b', '#f7a8d8', '#ffffff', '#ffb36b', '#6fd1c4'];
const NIGHT = ['#ff4f8b', '#8c6bff', '#27d3e0', '#ffd166', '#f2efe6', '#ff7043', '#6fe07a', '#e93fd0']; // going-out colours that read under the neon
const PANTS = ['#344655', '#4d5a6a', '#6b5a48', '#2f3338', '#7b8793', '#a38f72', '#e8e2d6'];

function seeded(seed) { let n = seed >>> 0 || 1; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
const outward = p => { const d = Math.hypot(p.x, p.z) || 1; return { x: p.x / d, z: p.z / d }; };
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// Every group: where it is, when it is out ('day', 'night' or 'any'), an optional prop (towel, blanket, bonfire,
// table) and its members, each with a role ('adult' or 'kid'), a pose and a look. Poses: 'ground' (sitting on a towel or
// blanket), 'sit' (on a seat), 'chat', 'dance', 'play' (children hopping about) and 'swim'.
export function ambientGroups(island, blocks, seed = 1) {
  const random = seeded(seed * 31 + 7), pick = list => list[Math.floor(random() * list.length) % list.length];
  const person = (role, pose, x, z, heading, palette = SUMMER) => ({ role, pose, x, z, heading, phase: random() * 10,
    look: { skin: pick(SKIN), hair: pick(HAIR), hairStyle: pick(role === 'kid' ? ['short', 'long', 'cap'] : ['short', 'long', 'long', 'cap', 'bald']), shirt: pick(palette), pants: pick(PANTS), scale: role === 'kid' ? 0.58 + random() * 0.1 : 0.94 + random() * 0.12 } });
  const groups = [], coast = island.coastline(120, 32), desert = !!island.theme?.desert;
  // Beach families under the umbrellas (the same spots the scenery puts umbrellas and towels; on desert islands, which
  // have none, the families bring their own).
  coast.forEach((p, i) => {
    const angle = Math.atan2(p.z, p.x) * 180 / Math.PI;
    if (i % 3 || !BEACH(angle)) return;
    const out = outward(p), towel = { x: p.x + 2.4, z: p.z + 1 }, sea = { x: towel.x + out.x * 40, z: towel.z + out.z * 40 }, members = [];
    members.push(person('adult', 'ground', towel.x - 0.6, towel.z - 0.4, facing(towel, sea)), person('adult', 'ground', towel.x + 0.6, towel.z + 0.5, facing(towel, sea)));
    const kids = Math.floor(random() * 3);
    for (let k = 0; k < kids; k++) members.push(person('kid', 'play', towel.x + out.x * (6 + k * 2.5) + (k - 0.5) * 2, towel.z + out.z * (6 + k * 2.5), random() * Math.PI * 2));
    if (random() < 0.4) members.push(person('adult', 'chat', towel.x - out.x * 2.2, towel.z - out.z * 2.2, facing({ x: towel.x - out.x * 2.2, z: towel.z - out.z * 2.2 }, towel)));
    groups.push({ id: `beach-${i}`, kind: 'beach', time: 'day', x: towel.x, z: towel.z, members, ...(desert ? { prop: 'umbrella', at: p } : {}) });
  });
  // Swimmers in the shallows.
  island.coastline(120, -9).forEach((p, i) => {
    const angle = Math.atan2(p.z, p.x) * 180 / Math.PI;
    if (desert || i % 4 !== 1 || !BEACH(angle)) return;
    const members = [person('adult', 'swim', p.x, p.z, random() * Math.PI * 2)];
    if (random() < 0.5) members.push(person(random() < 0.4 ? 'kid' : 'adult', 'swim', p.x + 3, p.z + 2, random() * Math.PI * 2));
    groups.push({ id: `swim-${i}`, kind: 'swim', time: 'day', x: p.x, z: p.z, members });
  });
  // Beach bonfires after dark: a circle of friends round the fire.
  island.coastline(120, 40).forEach((p, i) => {
    const angle = Math.atan2(p.z, p.x) * 180 / Math.PI;
    if (i % 12 !== 5 || !(desert || BEACH(angle))) return;
    const n = 4 + Math.floor(random() * 3), members = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, at = { x: p.x + Math.sin(a) * 2.6, z: p.z + Math.cos(a) * 2.6 }; members.push(person('adult', k === 0 ? 'chat' : 'sit', at.x, at.z, facing(at, p), NIGHT)); }
    groups.push({ id: `bonfire-${i}`, kind: 'bonfire', time: 'night', x: p.x, z: p.z, prop: 'bonfire', members });
  });
  // Picnics by the lakes and at the campsite.
  const picnicSpots = [...(island.lakes || []).map(l => ({ x: l.x + l.rx * 0.2, z: l.z + (l.rz || l.rx) + 14 })), ...(island.landmarks?.campsite ? [{ x: island.landmarks.campsite.x + 9, z: island.landmarks.campsite.z + 4 }] : [])];
  picnicSpots.filter(p => island.onIsland(p.x, p.z, 3)).forEach((p, i) => {
    const members = [person('adult', 'ground', p.x - 0.7, p.z, Math.PI / 2), person('adult', 'ground', p.x + 0.7, p.z, -Math.PI / 2), person('kid', 'play', p.x + 4, p.z + 3, random() * 6)];
    if (random() < 0.6) members.push(person('kid', 'ground', p.x, p.z + 0.9, Math.PI));
    groups.push({ id: `picnic-${i}`, kind: 'picnic', time: 'day', x: p.x, z: p.z, prop: 'blanket', members });
  });
  // Town: café tables by day, and crowds outside the shops and bars at night, in front of the blocks nearest the
  // centre (the shop fronts face the avenue on each block's south side).
  const fronts = blocks.filter(b => !b.hub && !b.shop && Math.abs(b.x) < 320 && Math.abs(b.z) < 320).map(b => ({ x: b.x, z: b.z + b.depth / 2 + 3.2 }))
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  fronts.slice(0, 8).forEach((f, i) => {
    const at = { x: f.x + (i % 2 ? 6 : -6), z: f.z };
    groups.push({ id: `cafe-${i}`, kind: 'cafe', time: 'day', x: at.x, z: at.z, prop: 'table', members: [person('adult', 'sit', at.x - 1, at.z, Math.PI / 2), person('adult', 'sit', at.x + 1, at.z, -Math.PI / 2)] });
  });
  fronts.slice(0, 22).forEach((f, i) => {
    const n = 3 + Math.floor(random() * 3), members = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, at = { x: f.x + Math.sin(a) * 1.5, z: f.z + Math.cos(a) * 1.2 }; members.push(person('adult', random() < 0.45 ? 'dance' : 'chat', at.x, at.z, facing(at, f), NIGHT)); }
    groups.push({ id: `night-${i}`, kind: 'nightlife', time: 'night', x: f.x, z: f.z, members });
  });
  // The Lounge: dancers on the floor (a bigger crowd after dark), a bartender and people at the bar.
  const dancers = (n, palette) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2 + random(), r = 2 + random() * 5, x = LOUNGE.x + Math.sin(a) * r, z = LOUNGE.z + Math.cos(a) * r; return person('adult', 'dance', x, z, facing({ x, z }, LOUNGE), palette); });
  groups.push({ id: 'lounge-day', kind: 'lounge', time: 'day', x: LOUNGE.x, z: LOUNGE.z, members: dancers(5, SUMMER) });
  groups.push({ id: 'lounge-night', kind: 'lounge', time: 'night', x: LOUNGE.x, z: LOUNGE.z, members: dancers(11, NIGHT) });
  groups.push({ id: 'lounge-bar', kind: 'lounge', time: 'any', x: LOUNGE.x - 22, z: LOUNGE.z, members: [person('adult', 'chat', LOUNGE.x - 24, LOUNGE.z, Math.PI / 2), ...[-6, -3, 3].map(dz => person('adult', 'chat', LOUNGE.x - 19.8, LOUNGE.z + dz, -Math.PI / 2))] });
  return groups;
}
// Which groups are out: by day, or after dark (`night` is 0 in full daylight and 1 at night).
export const isOut = (group, night) => group.time === 'any' || (group.time === 'night' ? night >= 0.5 : night < 0.5);
