import { ROAD_GRID, vehicle, createTraffic, createPatrols, driveVehicle, steerVehicle, stepCharacterBody, pushCharacter, angleDelta, random } from './worldPhysics.js';
import { stepPhysics, castShot } from './physicsEngine.js';
import { updatePolice } from './worldPolice.js';
import { createPedestrians, stepPedestrians } from './worldPedestrians.js';
import { playerLook } from './characterProfile.js';
import { AIRPORT, MARINA, SEA_LIMIT, islandFor } from './worldIsland.js';
import { ARRIVAL, createBoat, landingSpot, stepBoat, stepVoyage, voyage } from './worldBoat.js';
import { STATIONS, arrivalIn, trainAt } from './metro.js';
import { destructionAt, kaijuHazards, kaijuInReach, kaijuPose, standingBlocks } from './worldBoss.js';
import { sceneryLayout } from './worldLayout.js';
import { GUN_SHOP, WEAPONS, atGunShop, cleanOwned, damageAt, fullMagazines, weaponOf } from './weapons.js';

export const CITIES = [
  { id: 'miami', name: 'Miami', country: 'United States', district: 'Ocean Drive', region: 'North America', color: '#ff8bb5', sky: '#d998ac', ground: '#9ba78b', buildings: ['#f5ccb5', '#b6d5cf', '#dbb1c9'], trees: 'palm', map: [25, 39], seed: 7, tagline: 'Pink skies. Fast cars. A fresh start.' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', district: 'Neon Crossing', region: 'Asia', color: '#a8a0ff', sky: '#30344f', ground: '#666f7a', buildings: ['#53677d', '#767286', '#416777'], trees: 'cherry', map: [87, 34], seed: 13, tagline: 'Find your way through the electric night.' },
  { id: 'manila', name: 'Manila', country: 'Philippines', district: 'Bay District', region: 'Asia', color: '#f7bd65', sky: '#daa890', ground: '#91a58b', buildings: ['#c9c5b3', '#b6c7c7', '#dfa789'], trees: 'palm', map: [82, 48], seed: 23, tagline: 'Bayfront highways and golden-hour hustle.' },
  { id: 'london', name: 'London', country: 'United Kingdom', district: 'River Quarter', region: 'Europe', color: '#a5d6d5', sky: '#9eb5bd', ground: '#839a89', buildings: ['#a78c83', '#b7a396', '#7e949b'], trees: 'oak', map: [48, 23], seed: 37, tagline: 'Old streets. New trouble.' },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', district: 'Mirage Marina', region: 'Asia', color: '#ebcf8c', sky: '#d8b99a', ground: '#cbb58a', buildings: ['#8bafb6', '#c4c5b6', '#77979f'], trees: 'palm', map: [64, 41], seed: 43, tagline: 'Glass towers above the desert.' },
  { id: 'rio', name: 'Rio de Janeiro', country: 'Brazil', district: 'Sunset Coast', region: 'South America', color: '#b2dc83', sky: '#ddad9a', ground: '#819c68', buildings: ['#deb49e', '#d9cc91', '#a0c9b7'], trees: 'palm', map: [35, 73], seed: 59, tagline: 'Coastal roads with something around every corner.' },
  { id: 'cape', name: 'Cape Town', country: 'South Africa', district: 'Atlantic Point', region: 'Africa', color: '#8ed9c8', sky: '#abc7ce', ground: '#a4ab83', buildings: ['#c6bfb0', '#9ebcbb', '#dac9b7'], trees: 'oak', map: [53, 79], seed: 67, tagline: 'Take the long road to the ocean.' },
];
// Positions are bounded by the island's coastline (worldIsland.js); LIMIT bounds any coordinate on it.
export const LIMIT = SEA_LIMIT;
export const ROADS = ROAD_GRID;
// Everyone arrives at the City Hub: a glass-fronted public office on the corner of the two central avenues. Its forecourt
// (the spawn point) is where you start, respawn, heal and meet other players.
export const HUB = Object.freeze({ x: 8, z: 12, name: 'City Hub' });
export const CONTRACTS = [
  { id: 'courier', title: 'Midnight delivery', type: 'DRIVING', reward: 650, description: 'Collect a package at the docks, then deliver it across the city.', target: { x: 120, z: 65 }, finish: { x: -240, z: -185 } },
  { id: 'crew', title: 'Take back the block', type: 'COMBAT', reward: 1200, description: 'Eliminate the four armed gang members at the marked block. Lose the heat and return to the City Hub.', target: { x: -120, z: -65 }, finish: { x: 8, z: 12 } },
  { id: 'escape', title: 'Heat on the highway', type: 'PURSUIT', reward: 950, description: 'Pick up the marked case, escape a two-star pursuit, then reach the drop-off.', target: { x: 240, z: 65 }, finish: { x: -360, z: 180 } },
  { id: 'race', title: 'Ring road sprint', type: 'RACE', reward: 1100, auto: true, limit: 150, description: 'Race the island ring road end to end through all seven checkpoints in 2:30. The clock starts at the first checkpoint; drive through them, no need to stop.' },
  { id: 'tour', title: 'Island explorer', type: 'EXPLORE', reward: 800, auto: true, description: 'See the island: reach the lighthouse, then the landmark, then the campsite (or the marina), in that order. Go by car, boat or on foot.' },
  { id: 'bounty', title: 'Wanted: the gang boss', type: 'BOUNTY', reward: 1600, description: 'A gang boss and two bodyguards are holed up at the marked crossing. Take the boss down, lose the heat, then report to the City Hub.', target: { x: -240, z: 240 }, finish: { x: 8, z: 12 } },
];
// The nearest spot to `point` you can stand on: on the island, out of lakes, off the steep slopes (landmarks such as a
// beach's lifeguard towers can sit at the water's edge).
export function reachableNear(island, point) {
  const ok = (x, z) => island.onIsland(x, z, 3) && !island.inLake?.(x, z) && island.terrainHeight(x, z) < 12;
  for (let r = 0; r <= 240; r += 8) for (let i = 0; i < Math.max(1, r / 2); i++) {
    const a = i / Math.max(1, r / 2) * Math.PI * 2, x = point.x + Math.cos(a) * r, z = point.z + Math.sin(a) * r;
    if (ok(x, z)) return { x, z };
  }
  return { x: point.x, z: point.z };
}
// The points a contract takes you to, in order. Most are a pick-up and a drop-off; the race and the tour follow the
// island you are on (the ring road's checkpoints, or its sights). Each has a label for the objective card.
const stepCache = new Map();
export function missionSteps(cityId, id) {
  const key = `${cityId}:${id}`;
  if (stepCache.has(key)) return stepCache.get(key);
  const contract = CONTRACTS.find(m => m.id === id), island = islandFor(cityId);
  let steps;
  if (id === 'race') {
    const ring = island.routes.find(r => r.id === 'ring').points;
    steps = Array.from({ length: 7 }, (_, i) => { const p = ring[Math.round(i / 6 * (ring.length - 1))]; return { x: p.x, z: p.z, label: i === 6 ? 'Finish line' : `Checkpoint ${i + 1}/7` }; });
  } else if (id === 'tour') {
    const { lighthouse, feature, campsite } = island.landmarks;
    steps = [{ ...reachableNear(island, { x: lighthouse.x + 22, z: lighthouse.z }), label: 'The lighthouse' }];
    if (feature) steps.push({ ...reachableNear(island, { x: feature.x, z: feature.z + (feature.radius || 0) + 8 }), label: feature.name });
    steps.push(campsite ? { ...reachableNear(island, campsite), label: 'The campsite' } : { ...reachableNear(island, { x: MARINA.x0, z: MARINA.z }), label: 'The marina' });
  } else steps = [{ ...contract.target, label: id === 'crew' || id === 'bounty' ? 'Target' : 'Pick-up' }, { ...contract.finish, label: id === 'crew' || id === 'bounty' ? 'City Hub' : 'Drop-off' }];
  stepCache.set(key, steps); return steps;
}
export function generateBlocks(city) {
  let seed = city.seed;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const blocks = [];
  for (let x = -300; x <= 300; x += 120) for (let z = -300; z <= 300; z += 120) {
    for (const dx of [-23, 23]) for (const dz of [-23, 23]) {
      const height = 10 + random() * (city.id === 'dubai' ? 110 : city.id === 'tokyo' ? 75 : 44);
      blocks.push({ x: x + dx, z: z + dz, width: 29 + random() * 8, depth: 29 + random() * 8, height, color: city.buildings[Math.floor(random() * 3)] });
    }
  }
  // The block beside the spawn point is the City Hub office (same footprint, so streets and contracts are unchanged).
  Object.assign(blocks.find(b => b.x === 37 && b.z === 37), { hub: true, height: 19, color: '#e4ebe8' });
  // Miami's gun shop takes the ground floor of the block across the avenue.
  if (city.id === GUN_SHOP.city) blocks.find(b => b.x === GUN_SHOP.block.x && b.z === GUN_SHOP.block.z).shop = true;
  Object.defineProperty(blocks, 'island', { value: islandFor(city.id) });
  return blocks;
}
export function freePosition(x, z, blocks, radius = 1) {
  return (blocks.island ? blocks.island.onIsland(x, z, radius) : Math.abs(x) < 440 - radius && Math.abs(z) < 440 - radius) && !blocks.some(b => Math.abs(x - b.x) < b.width / 2 + radius && Math.abs(z - b.z) < b.depth / 2 + radius);
}
export function clearSight(a, b, blocks) {
  return !blocks.some(block => {
    let enter = 0, exit = 1;
    for (const [axis, size] of [['x', 'width'], ['z', 'depth']]) {
      const delta = b[axis] - a[axis], min = block[axis] - block[size] / 2, max = block[axis] + block[size] / 2;
      if (Math.abs(delta) < 0.00001) { if (a[axis] < min || a[axis] > max) return false; }
      else { const near = (min - a[axis]) / delta, far = (max - a[axis]) / delta; enter = Math.max(enter, Math.min(near, far)); exit = Math.min(exit, Math.max(near, far)); }
      if (enter > exit) return false;
    }
    return exit > 0 && enter < 1;
  });
}
export function cleanWorldSave(value) {
  const keys = CITIES.flatMap(c => CONTRACTS.map(m => `${c.id}:${m.id}`));
  return { city: CITIES.some(c => c.id === value?.city) ? value.city : 'miami', cash: Number.isFinite(value?.cash) ? Math.max(0, Math.min(9999999, Math.floor(value.cash))) : 0, completed: [...new Set(Array.isArray(value?.completed) ? value.completed.filter(k => keys.includes(k)) : [])],
    owned: cleanOwned(value?.owned) };
}
// `arrival` is 'boat' when you sail in from another island (you arrive offshore, at the helm of your boat).
export function createSession(city, save = {}, appearance = null, arrival = null) {
  const s = { appearance, city: city.id, seed: city.seed * 7919 + 17, blocks: generateBlocks(city), player: { x: 8, z: 12, heading: Math.PI, speed: 0, height: 0, velocityY: 0, waveTime: 0, look: playerLook(appearance) }, car: vehicle('player', 3, 12, Math.PI, 'player'), traffic: createTraffic(), policeCars: createPatrols(), driving: false, health: 100, weapon: save.weapon === 'fists' || cleanOwned(save.owned).includes(save.weapon) ? save.weapon : 'pistol', owned: cleanOwned(save.owned), mags: fullMagazines(save.owned), shopping: false, heat: 0, quiet: 0, cooldown: 0, reload: 0, down: 0, downReason: '', arrest: 0, aimYaw: Math.PI, aimTime: 0, punchTime: 0, combo: 0, mission: null, enemies: [], shots: [], impacts: [], impactSeq: 0, actions: [], actionSeq: 0, time: 0, cash: save.cash || 0, completed: [...(save.completed || [])], message: 'Welcome to ' + city.name + '! You are at the City Hub. Your car is parked outside.', messageTime: 7 };
  s.pedestrians = createPedestrians(s);
  Object.assign(s, { boat: createBoat(), boating: false, metro: null, riding: false, train: trainAt(0), course: null, waypoint: null, arrival: null });
  // World boss: the server's event (set by the controller), the kaiju here, hits waiting to be reported, and the ruins.
  Object.assign(s, { bossEvent: null, boss: null, bossHits: { shot: 0, punch: 0 }, bossDeaths: 0, bossMemory: new Set(), baseBlocks: s.blocks, ruins: null });
  if (arrival === 'boat') {
    s.boat = createBoat(ARRIVAL); s.boating = true;
    s.message = `Welcome to ${city.name}! Steer for the marina pier on the waterfront and press F to go ashore.`;
  } else if (arrival === 'flight') s.message = `Welcome to ${city.name}! Your flight has landed; the airport shuttle dropped you at the City Hub.`;
  return s;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Who you are controlling: your car, your boat, the metro train you are riding, or yourself on foot.
export const actor = s => s.driving ? s.car : s.boating ? s.boat : s.riding ? s.train : s.player;
export const onFoot = s => !s.driving && !s.boating && !s.riding;
export function objectivePoint(s) { return s.mission ? missionSteps(s.city, s.mission.id)[s.mission.stage] || null : null; }
// Checkpoints (race and tour) are reached by passing through them: this advances the stage, starts or checks the race
// clock and pays out at the last one (once the police have lost you).
function checkpointMission(s) {
  const contract = CONTRACTS.find(m => m.id === s.mission?.id);
  if (!contract?.auto) return;
  const steps = missionSteps(s.city, contract.id), m = s.mission;
  if (m.deadline && s.time > m.deadline) { m.stage = 0; m.deadline = null; notify(s, 'Out of time! Head back to the first checkpoint to try again.'); return; }
  const point = steps[m.stage];
  if (!point || distance(actor(s), point) > (contract.id === 'race' ? 18 : 25)) return;
  if (m.stage < steps.length - 1) {
    m.stage++;
    if (contract.id === 'race' && m.stage === 1) { m.deadline = s.time + contract.limit; notify(s, `Go! ${contract.limit} seconds to the finish line.`); }
    else notify(s, contract.id === 'race' ? `${point.label}. Keep going!` : `${point.label} visited. Next: ${steps[m.stage].label}.`);
    return;
  }
  if (s.heat > 0) { if (s.messageTime <= 0) notify(s, 'Lose the police to finish the contract.'); return; }
  completeContract(s, contract);
}
function completeContract(s, contract) {
  s.cash += contract.reward; s.completed.push(`${s.city}:${contract.id}`); s.mission = null;
  notify(s, `Contract complete. +$${contract.reward.toLocaleString()}`);
}
// Where the gold marker points: the contract, else the marina when a sea course is set, else your GPS waypoint.
export function guidePoint(s) {
  const point = objectivePoint(s);
  if (point) return { ...point, label: 'Contract' };
  if (s.course && !s.boating) return { x: MARINA.x0 + 40, z: MARINA.z, label: 'Marina pier' };
  return s.waypoint;
}
export function setWaypoint(s, point) { s.waypoint = point ? { x: point.x, z: point.z, label: point.label || 'Waypoint' } : null; if (point) notify(s, `GPS set: ${s.waypoint.label}. Follow the gold marker.`); }
// Plan a crossing by sea to another island (you still have to sail it).
export function setCourse(s, cityId) {
  const from = CITIES.find(c => c.id === s.city), to = CITIES.find(c => c.id === cityId);
  if (!to || s.mission || s.heat > 0 || s.down) return false;
  s.course = voyage(from, to);
  notify(s, s.boating ? `Course set for ${to.name}: head out to open sea and follow the arrow.` : `Course set for ${to.name}. Take your boat from the marina pier on the east waterfront.`);
  return true;
}
export function cancelCourse(s) { s.course = null; }
export const nearAirport = s => (onFoot(s) || s.driving) && distance(actor(s), AIRPORT) < 70;
const stationNear = s => STATIONS.findIndex(st => distance(s.player, st) < 20);
// The one thing you can do right here, for the on-screen prompt (and its touch button).
export function promptFor(s) {
  if (s.down) return null;
  if (s.riding) return s.train.station !== null ? { key: 'E', action: 'interact', text: `Get off at ${STATIONS[s.train.station].name}` } : { key: null, text: `Metro · next stop ${STATIONS[s.train.next].name}` };
  if (s.stun > 0) return { key: null, text: 'Stunned by the roar!' };
  if (s.metro) return { key: 'E', action: 'interact', text: `Waiting for the metro · ${Math.ceil(arrivalIn(s.worldTime ?? s.time, s.metro.station))} s · E to leave` };
  const at = actor(s), point = objectivePoint(s);
  if (point && !CONTRACTS.find(m => m.id === s.mission.id).auto && distance(at, point) < 12) return { key: 'E', action: 'interact', text: s.mission.stage === 0 ? (s.mission.id === 'crew' || s.mission.id === 'bounty' ? 'Clear the area first' : 'Collect') : 'Deliver' };
  if (s.boating) return landingSpot(s.boat, islandFor(s.city), (x, z) => freePosition(x, z, s.blocks, 1)) && Math.abs(s.boat.speed) < 3 ? { key: 'F', action: 'vehicle', text: 'Go ashore' } : null;
  if (nearAirport(s)) return { key: 'M', action: 'map', text: 'Fly to another island' };
  if (s.driving) return null;
  if (distance(s.player, s.boat) < 15) return { key: 'F', action: 'vehicle', text: 'Take the boat' };
  if (stationNear(s) >= 0) return { key: 'E', action: 'interact', text: `Take the metro · ${STATIONS[stationNear(s)].name} station` };
  if (distance(s.player, s.car) < 9) return { key: 'F', action: 'vehicle', text: 'Get in your car' };
  if (atGunShop(s.city, s.player)) return { key: 'E', action: 'interact', text: 'Browse Ocean Drive Arms' };
  if (distance(s.player, HUB) < 13 && (s.health < 100 || needsAmmo(s))) return { key: 'E', action: 'interact', text: 'Heal at the City Hub' };
  return null;
}
export function notify(s, message) { s.message = message; s.messageTime = 5; }
export function startContract(s, id) {
  const mission = CONTRACTS.find(m => m.id === id);
  if (!mission || s.mission || s.down || s.completed.includes(`${s.city}:${id}`)) return false;
  s.mission = { id, stage: 0 };
  if (id === 'crew') s.enemies = s.enemies.filter(e => e.kind !== 'gang').concat(Array.from({ length: 4 }, (_, i) => ({ id: 'gang' + i, kind: 'gang', x: -120 + (i % 2) * 7 - 3, z: -65 + Math.floor(i / 2) * 8, health: 100, cooldown: 1 + i * 0.5 })));
  // The bounty: a tough boss (three times the health) with two bodyguards, at a crossing on the far side of the city.
  if (id === 'bounty') {
    const { x, z } = mission.target;
    s.enemies = s.enemies.filter(e => e.kind !== 'gang').concat([{ id: 'boss', kind: 'gang', boss: true, x, z, health: 300, cooldown: 1 }],
      [-1, 1].map((side, i) => ({ id: 'guard' + i, kind: 'gang', x: x + side * 6, z: z + 4, health: 100, cooldown: 1.5 + i * 0.4 })));
  }
  notify(s, 'Contract started: ' + mission.title); return true;
}
export function interact(s) {
  if (s.down) return;
  // The metro: get off at a station, leave the platform, or wait for the next train.
  if (s.riding) {
    const stop = s.train.station;
    if (stop === null) { notify(s, `Next stop: ${STATIONS[s.train.next].name}. Press E when the train stops.`); return; }
    const exit = STATIONS[stop].exit;
    s.player = { ...s.player, x: exit.x, z: exit.z, height: 0, moveX: 0, moveZ: 0, kickX: 0, kickZ: 0 }; s.riding = false; s.metro = null;
    notify(s, `${STATIONS[stop].name} station.`); return;
  }
  if (s.metro) { s.metro = null; notify(s, 'You left the platform.'); return; }
  const at = actor(s), point = objectivePoint(s);
  const auto = CONTRACTS.find(m => m.id === s.mission?.id)?.auto;
  if (point && !auto && distance(at, point) < 12 && Math.abs(at.speed) < 3) {
    if (s.mission.stage === 0) {
      if (s.mission.id === 'crew') { notify(s, 'Eliminate the marked gang members first.'); return; }
      if (s.mission.id === 'bounty') { notify(s, 'Take down the gang boss first.'); return; }
      s.mission.stage = 1;
      if (s.mission.id === 'escape') { s.heat = 2; s.quiet = 0; }
      notify(s, 'Package collected. Follow the gold marker to the drop-off.');
    } else {
      if (s.heat > 0) { notify(s, 'Lose the police before completing the contract.'); return; }
      completeContract(s, CONTRACTS.find(m => m.id === s.mission.id));
    }
    return;
  }
  const station = onFoot(s) ? stationNear(s) : -1;
  if (station >= 0) {
    if (s.heat > 0) { notify(s, 'Lose the police before taking the metro.'); return; }
    s.metro = { station }; notify(s, `Waiting at ${STATIONS[station].name} station. The train arrives in ${Math.ceil(arrivalIn(s.worldTime ?? s.time, station))} s.`); return;
  }
  // The gun shop: the controller opens its counter (the game pauses while you browse).
  if (onFoot(s) && atGunShop(s.city, s.player)) {
    if (s.heat > 0) { notify(s, 'The shop keeper locks the door: lose the police first.'); return; }
    s.shopping = true; return;
  }
  if (distance(at, HUB) < 13 && onFoot(s) && s.heat === 0) { s.health = 100; s.mags = fullMagazines(s.owned); s.reload = 0; notify(s, 'City Hub: health and ammunition restored.'); return; }
  notify(s, 'Move to the gold marker and stop to interact.');
}
export function toggleVehicle(s) {
  if (s.down) return;
  if (s.riding || s.metro) { notify(s, 'Press E to get off at a station.'); return; }
  if (s.boating) {
    if (Math.abs(s.boat.speed) > 3) { notify(s, 'Slow down before going ashore.'); return; }
    const spot = landingSpot(s.boat, islandFor(s.city), (x, z) => freePosition(x, z, s.blocks, 1));
    if (!spot) { notify(s, 'Bring the boat alongside the marina pier or a beach to go ashore.'); return; }
    s.player = { ...s.player, x: spot.x, z: spot.z, height: 0, heading: s.boat.heading, moveX: 0, moveZ: 0, kickX: 0, kickZ: 0 }; s.boating = false; s.boat.speed = 0;
    notify(s, 'Ashore. Press F beside the boat to sail again.'); return;
  }
  if (s.driving) {
    if (Math.abs(s.car.speed) > 3) { notify(s, 'Brake before getting out.'); return; }
    const exits = [[4, 0], [-4, 0], [0, 5], [0, -5]];
    const exit = exits.find(([x, z]) => freePosition(s.car.x + x, s.car.z + z, s.blocks) && [...s.traffic, ...s.policeCars].every(c => Math.hypot(s.car.x + x - c.x, s.car.z + z - c.z) > c.radius + 1));
    if (!exit) return;
    // On a hillside the player steps out at the slope's height (the character controller then settles onto it).
    const x = s.car.x + exit[0], z = s.car.z + exit[1];
    const ground = islandFor(s.city).terrainHeight(x, z);
    s.player = { ...s.player, x, z, height: ground + (ground > 0 ? 0.3 : 0), heading: s.car.heading, moveX: 0, moveZ: 0, kickX: 0, kickZ: 0 }; s.driving = false;
  } else if (distance(s.player, s.boat) < 15) {
    if (s.heat > 0) { notify(s, 'Lose the police before taking the boat.'); return; }
    s.boating = true;
    notify(s, s.course ? `Sailing for ${s.course.name}: head out to open sea and follow the arrow.` : 'W to throttle, A/D to steer, Shift for full power. Set a course on the map to sail to another island.');
  } else if (distance(s.player, s.car) < 9 && Math.abs(s.car.speed) < 3) { s.driving = true; }
  else notify(s, 'Get closer to your cyan car to enter.');
}
export const PISTOL_RANGE = WEAPONS.pistol.range, FIST_RANGE = WEAPONS.fists.range;
// The robot's plating takes the edge off every kind of damage.
const armorOf = s => s.player.look?.armor || 1;
const needsAmmo = s => s.owned.some(id => (s.mags[id] ?? 0) < WEAPONS[id].magazine);
// Switch to a weapon you own (fists are always available). A reload in progress is cancelled.
export function equip(s, id) {
  if (id !== 'fists' && !s.owned.includes(id)) return false;
  if (s.weapon === id) return true;
  s.weapon = id; s.reload = 0; s.cooldown = Math.max(s.cooldown, 0.2);
  const w = WEAPONS[id]; notify(s, w.gun ? `${w.name} equipped · ${s.mags[id]}/${w.magazine}. J to fire.` : 'Fists equipped. Get close and press J.');
  return true;
}
// Soft lock-on: hostiles anywhere in range (nearest and closest to your aim first); bystanders only when in front of you.
// Children are never targets.
export function targetFor(s) {
  if (!onFoot(s) || s.down) return null;
  const w = WEAPONS[s.weapon] || WEAPONS.fists, gun = w.gun, range = w.range, aim = gun ? s.aimYaw ?? s.player.heading : s.player.heading;
  const scored = [];
  for (const e of [...s.enemies, ...s.pedestrians]) {
    if (e.health <= 0 || e.child) continue;
    const d = distance(s.player, e); if (d >= range) continue;
    const off = Math.abs(angleDelta(Math.atan2(e.x - s.player.x, e.z - s.player.z), aim)), hostile = e.kind !== 'civilian';
    if (!hostile && off > w.assist && d > 2.5) continue;
    scored.push({ e, score: (hostile ? 0 : 1000) + d * (1 + off * 0.8) });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.find(({ e }) => clearSight(s.player, e, s.blocks))?.e || null;
}
// Impact events are consumed by the renderer for blood spray, pools and camera shake.
export function addImpact(s, target, dx, dz, kind, power = 1) {
  const d = Math.hypot(dx, dz) || 1;
  s.impacts.push({ id: ++s.impactSeq, time: s.time, x: target.x, z: target.z, y: kind === 'pool' ? 0.3 : kind === 'punch' ? 2.6 : 2.2, dx: dx / d, dz: dz / d, kind, power, blood: !target.child });
}
function injure(s, target, amount, dx, dz, kind) {
  if (target.child) return;
  target.health = Math.max(0, target.health - amount);
  // Victims fall away from the blow: forward when hit from behind, backward when hit from the front.
  target.fallDir = dx * Math.sin(target.heading || 0) + dz * Math.cos(target.heading || 0) >= 0 ? 1 : -1;
  addImpact(s, target, dx, dz, kind, kind === 'punch' ? 0.8 + s.combo * 0.3 : 1);
  if (target.health === 0 && target.deadAt === undefined) { target.deadAt = s.time; addImpact(s, target, dx, dz, 'pool'); }
}
function kaijuTarget(s, gun) {
  if (!s.boss?.alive || !onFoot(s)) return null;
  return kaijuInReach(s.player, gun ? s.aimYaw ?? s.player.heading : s.player.heading, gun, s.boss.t);
}
// The world boss in this city: pose from the server's event, destruction so far, and what it does to you.
function updateKaiju(s, dt) {
  const ev = s.bossEvent, now = (s.worldTime ?? s.time) * 1000;
  if (!ev || ev.city !== s.city || now < ev.startsAt || now >= ev.endsAt) {
    // Outside the event hour the city is whole again.
    if (s.ruins) { s.blocks = s.baseBlocks; s.ruins = null; }
    s.boss = null; return;
  }
  if (s.bossMemory.event !== ev.id) { s.bossMemory = new Set(); s.bossMemory.event = ev.id; }
  const alive = !ev.defeatedAt && ev.hp > 0, t = (Math.min(now, alive ? now : ev.defeatedAt) - ev.startsAt) / 1000;
  s.boss = { ...kaijuPose(t), t, alive, dying: alive ? 0 : (now - ev.defeatedAt) / 1000 };
  const tick = Math.floor(t / 2);
  if (!s.ruins || s.ruins.tick !== tick) {
    const ruins = destructionAt(ev.seed, t, s.baseBlocks, sceneryLayout());
    if (!s.ruins || ruins.ruined.size !== s.ruins.ruined.size) s.blocks = standingBlocks(s.baseBlocks, ruins.ruined);
    s.ruins = { ...ruins, tick };
  }
  if (!alive || s.down || s.riding) return;
  const at = actor(s);
  for (const hit of kaijuHazards(ev.seed, t, at, s.bossMemory, dt)) {
    const dx = at.x - hit.from.x, dz = at.z - hit.from.z, d = Math.hypot(dx, dz) || 1;
    if (hit.damage) s.health -= hit.damage * (s.driving ? 0.6 : s.boating ? 0.8 : 1) * armorOf(s);
    if (onFoot(s)) {
      if (hit.body) { s.player.x += dx / d * hit.body; s.player.z += dz / d * hit.body; }
      pushCharacter(s.player, dx, dz, hit.push || 0, hit.lift || 0);
      // A slam knocks you off your feet; the roar only stuns you (you stay standing but cannot act for a moment).
      if (hit.knockdown) s.player.knockdown = Math.max(s.player.knockdown || 0, hit.knockdown);
      if (hit.stun) s.stun = Math.max(s.stun || 0, hit.stun);
    } else if (s.driving) { s.car.vx += dx / d * (hit.push || 0); s.car.vz += dz / d * (hit.push || 0); s.car.damage = Math.min(100, s.car.damage + (hit.damage || 0) * 0.5); }
    if (hit.damage >= 10) addImpact(s, { x: at.x, z: at.z, child: true }, dx, dz, 'car', 0.6);
  }
}
export function startReload(s) {
  const w = WEAPONS[s.weapon];
  if (!w?.gun || (s.mags[s.weapon] ?? 0) >= w.magazine || s.reload > 0 || s.down) return false;
  s.reload = w.reload; notify(s, 'Reloading...'); return true;
}
export function attack(s) {
  const w = WEAPONS[s.weapon] || WEAPONS.fists, gun = w.gun;
  if (!onFoot(s) || s.down || s.cooldown > 0 || (gun && s.reload > 0)) return;
  if (gun && !(s.mags[s.weapon] > 0)) { startReload(s); return; }
  s.cooldown = w.cooldown; if (gun) s.mags[s.weapon]--;
  // Punches chain into a jab, cross and heavier hook when thrown in quick succession.
  if (!gun) { s.combo = s.time - (s.lastPunch ?? -9) < 0.9 ? (s.combo + 1) % 3 : 0; s.lastPunch = s.time; s.punchTime = 0.28; }
  s.aimTime = gun ? 0.7 : 1.2;
  const from = s.player;
  let target = targetFor(s), blocked = null;
  // The kaiju: when it is in reach and nothing hostile is closer, the hit is recorded for the server (which decides the
  // damage) and does not draw the police.
  const kaijuRange = !target || target.kind === 'civilian' ? kaijuTarget(s, gun) : null;
  if (kaijuRange !== null) {
    const pose = s.boss, aim = Math.atan2(pose.x - from.x, pose.z - from.z), end = { x: from.x + Math.sin(aim) * (kaijuRange - 18), z: from.z + Math.cos(aim) * (kaijuRange - 18) };
    from.heading = aim; s.bossHits[gun ? 'shot' : 'punch']++;
    if (gun) s.shots.push({ x: from.x, z: from.z, tx: end.x, tz: end.z, ttl: 0.12, police: false, kaiju: true });
    s.actions.push({ id: ++s.actionSeq, time: s.time, kind: gun ? 'shot' : 'punch', combo: s.combo, x: end.x, z: end.z, blood: false });
    s.kaijuImpact = { x: end.x, z: end.z, time: s.time, kind: gun ? 'shot' : 'punch' };
    return;
  }
  if (gun) {
    // The bullet is a physics ray: a car, lamp post or body in the line of fire takes the hit instead of the target.
    const aim = target || { x: from.x + Math.sin(s.aimYaw ?? from.heading) * w.range, z: from.z + Math.cos(s.aimYaw ?? from.heading) * w.range };
    from.heading = target ? Math.atan2(target.x - from.x, target.z - from.z) : s.aimYaw ?? from.heading;
    blocked = castShot(s, from, { x: aim.x, z: aim.z, y: target ? (target.height || 0) + 2 : undefined }, { target });
    if (blocked) target = null;
  }
  if (target) {
    const dx = target.x - from.x, dz = target.z - from.z, d = Math.hypot(dx, dz);
    from.heading = Math.atan2(dx, dz);
    if (gun) {
      injure(s, target, damageAt(s.weapon, d), dx, dz, 'shot');
      pushCharacter(target, dx, dz, w.pellets ? 7 : 2.8, w.pellets && d < 10 ? 1.5 : 0);
      if (w.pellets && d < 10 && target.health > 0) target.knockdown = 1.2;
    } else {
      const hook = s.combo === 2;
      const strength = s.player.look?.strength || 1;
      injure(s, target, (hook ? 45 : 34) * strength, dx, dz, 'punch');
      // Jabs only rock the target so the combo stays in reach; the hook sends them flying. The player steps into each punch.
      pushCharacter(target, dx, dz, hook ? 12 : 2.5 + s.combo, hook ? 3.4 : 0);
      if (d > 2.2) pushCharacter(from, dx, dz, 2.5);
      if (hook || (target.health > 0 && target.health < 35)) target.knockdown = 1.4;
    }
  }
  const reach = gun ? w.range : 2, end = target || blocked || { x: from.x + Math.sin(from.heading) * reach, z: from.z + Math.cos(from.heading) * reach };
  if (gun) {
    s.shots.push({ x: from.x, z: from.z, tx: end.x, tz: end.z, ttl: 0.12, police: false, weapon: s.weapon });
    // Shotgun pellets spread around the main shot (visual only; the damage is in the main hit).
    for (let i = 1; i < (w.pellets || 0); i++) {
      const spread = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.05, a = Math.atan2(end.x - from.x, end.z - from.z) + spread, len = Math.hypot(end.x - from.x, end.z - from.z);
      s.shots.push({ x: from.x, z: from.z, tx: from.x + Math.sin(a) * len, tz: from.z + Math.cos(a) * len, ttl: 0.1, police: false, pellet: true });
    }
    if (blocked) bulletHit(s, blocked, end.x - from.x, end.z - from.z);
  }
  // Each attack is recorded for other players to replay (multiplayer.js): where it landed and whether it drew blood.
  s.actions.push({ id: ++s.actionSeq, time: s.time, kind: gun ? 'shot' : 'punch', combo: s.combo, x: end.x, z: end.z, blood: !!target && !target.child });
  if (gun || target) {
    // Harming bystanders or officers escalates the wanted level; gang fights stay at one star.
    const raise = target?.kind === 'civilian' ? (target.health ? 0.2 : 0.5) : target?.kind === 'police' ? (target.health ? 0.5 : 0.9) : 0;
    s.heat = Math.min(3, Math.max(s.heat, 1) + raise); s.quiet = 0;
    s.alarm = { x: from.x, z: from.z, time: s.time, radius: w.alarm };
    if (!s.lastSeen || s.unseen > 4) s.lastSeen = { x: from.x, z: from.z };
  }
}
// Side effects of a bullet stopped by something other than its target.
function bulletHit(s, hit, dx, dz) {
  if (hit.kind === 'vehicle') hit.owner.damage = Math.min(100, (hit.owner.damage || 0) + 1.5);
  if (hit.kind === 'ragdoll' && !hit.owner.child) addImpact(s, { x: hit.x, z: hit.z }, dx, dz, 'shot', 0.7);
}
function bust(s) {
  const fine = Math.min(s.cash, 500);
  s.cash -= fine; s.down = 4; s.downReason = 'busted'; s.arrest = 0;
  notify(s, fine ? `BUSTED. You paid a $${fine} fine.` : 'BUSTED. Released with a warning.');
}
// A new look from the character creator. The player object is replaced (same place and motion) so the physics layer
// rebuilds the capsule at the new body size.
export function setAppearance(s, appearance) {
  if (s.appearance === appearance) return;
  s.appearance = appearance; s.player = { ...s.player, look: playerLook(appearance) };
}
export function recover(s) {
  s.player = { x: 8, z: 12, heading: Math.PI, speed: 0, height: 0, velocityY: 0, waveTime: 0, look: playerLook(s.appearance) }; s.car = vehicle('player', 3, 12, Math.PI, 'player'); s.driving = false; s.health = 100; s.mags = fullMagazines(s.owned); s.reload = 0; s.heat = 0; s.down = 0; s.mission = null; s.enemies = []; s.traffic = createTraffic(); s.policeCars = createPatrols(); s.incident = false; s.arrest = 0; s.downReason = ''; s.lastSeen = null; s.alarm = null;
  s.boat = createBoat(); s.boating = false; s.riding = false; s.metro = null; s.arrival = null;
  notify(s, 'Back at the City Hub. Any unfinished contract can be restarted.');
}
export function stepWorld(s, input, delta, yaw = Math.PI) {
  const duration = Math.min(Math.max(delta, 0), 0.05), steps = Math.max(1, Math.ceil(duration * 120));
  for (let i = 0; i < steps; i++) stepSimulation(s, input, duration / steps, yaw);
}
function stepSimulation(s, input, dt, yaw) {
  s.time += dt;
  s.cooldown = Math.max(0, s.cooldown - dt); s.messageTime = Math.max(0, s.messageTime - dt);
  s.aimTime = Math.max(0, s.aimTime - dt); s.punchTime = Math.max(0, s.punchTime - dt);
  if (!s.driving) s.aimYaw = yaw;
  s.shots = s.shots.map(shot => ({ ...shot, ttl: shot.ttl - dt })).filter(shot => shot.ttl > 0);
  if (s.impacts.length && s.time - s.impacts[0].time > 1) s.impacts = s.impacts.filter(i => s.time - i.time <= 1);
  if (s.actions.length && s.time - s.actions[0].time > 1) s.actions = s.actions.filter(i => s.time - i.time <= 1);
  // While wasted or busted the city keeps moving (and a wasted player's ragdoll keeps falling), but the player has no control.
  const down = s.down > 0;
  if (down) { s.down -= dt; if (s.down <= 0) { recover(s); return; } }
  if (!down && s.reload > 0) { s.reload -= dt; if (s.reload <= 0 && WEAPONS[s.weapon]?.gun) { s.mags[s.weapon] = WEAPONS[s.weapon].magazine; notify(s, 'Reloaded.'); } }
  // The metro runs to its timetable; waiting passengers board when the train stops at their station.
  s.train = trainAt(s.worldTime ?? s.time);
  updateKaiju(s, dt);
  if (s.metro && !s.riding) {
    const st = STATIONS[s.metro.station];
    if (distance(s.player, st) > 26 || s.heat > 0 || down) { s.metro = null; notify(s, 'You left the platform.'); }
    else if (s.train.station === s.metro.station) { s.riding = true; notify(s, `All aboard at ${st.name}! Press E when the train stops to get off.`); }
  }
  if (s.stun > 0) s.stun = Math.max(0, s.stun - dt);
  const p = actor(s), control = !down && !(s.player.knockdown > 0) && !(s.stun > 0) ? input : {};
  const forward = Number(!!control.forward) - Number(!!control.backward), right = Number(!!control.right) - Number(!!control.left);
  if (s.boating) {
    const island = islandFor(s.city);
    stepBoat(s.boat, island, control, dt);
    if (s.course && stepVoyage(s.course, s.boat, island, dt)) s.arrival = s.course.to;
  }
  const guide = !s.mission && s.waypoint;
  if (guide && distance(p, guide) < 15) { notify(s, `You have arrived: ${guide.label}.`); s.waypoint = null; }
  if (onFoot(s)) {
    const length = Math.hypot(forward, right) || 1, speed = control.run ? 15 * (p.look?.speed || 1) : 8;
    const dx = (Math.sin(yaw) * forward - Math.cos(yaw) * right) / length * speed;
    const dz = (Math.cos(yaw) * forward + Math.sin(yaw) * right) / length * speed;
    stepCharacterBody(p, dx, dz, dt);
    if (dx || dz) p.heading = Math.atan2(dx, dz);
    // Jump from anything solid underfoot: the street, a roof, a car or a hillside.
    if (control.jump && !s.jumpHeld && (!p.height || p.grounded) && (p.velocityY || 0) <= 0) p.velocityY = 8;
    // Rapier integrates the jump and clears the vertical velocity on landing (roofs and car tops included).
    s.jumpHeld = !!control.jump; p.velocityY = (p.velocityY || 0) - 22 * dt;
  }
  if (control.attack) attack(s);
  if (s.heat > 0) s.quiet += dt;
  if (!down) updatePolice(s, p, dt, clearSight);
  const cars = [s.car, ...s.traffic, ...s.policeCars];
  const walkers = s.pedestrians.filter(person => person.health > 0 && !person.ragdoll);
  if (onFoot(s)) walkers.push(s.player);
  for (const car of cars) {
    car.hitCooldown = Math.max(0, car.hitCooldown - dt); car.impact *= Math.exp(-7 * dt);
    if (car === s.car) driveVehicle(car, s.driving && !down ? input : { park: true }, dt);
    else steerVehicle(car, cars, walkers, dt, car.state === 'responding' ? (car.chasing ? Math.min(42, 30 + s.heat * 4) : 26 + s.heat * 2) : 13);
  }
  let arresting = false;
  for (const e of s.enemies) {
    e.hitCooldown = Math.max(0, (e.hitCooldown || 0) - dt);
    if (down || e.health <= 0 || e.knockdown > 0 || e.ragdoll) { stepCharacterBody(e, 0, 0, dt); e.fireTime = Math.max(0, (e.fireTime || 0) - dt); continue; }
    const police = e.kind === 'police', returning = police && (!s.heat || e.returning), destination = returning ? s.policeCars.find(c => c.id === e.unit) || e : p;
    // At one star, officers try to arrest a suspect on foot instead of opening fire.
    const arrest = police && !returning && s.heat <= 1 && !s.driving;
    const d = distance(e, destination), heading = Math.atan2(destination.x - e.x, destination.z - e.z); e.heading = heading;
    const hold = returning ? 3 : arrest ? 1.7 : 12;
    const speed = d < (police ? 180 : 80) && d > hold ? police ? (returning || arrest || d > 18 ? 9 : 5) : d > 25 ? 6 : 3.5 : 0;
    stepCharacterBody(e, Math.sin(heading) * speed, Math.cos(heading) * speed, dt);
    e.cooldown -= dt;
    if (arrest && d < 2.6 && (s.player.speed || 0) < 4 && !s.player.height && !s.player.ragdoll) arresting = true;
    if (!returning && !arrest && d < 38 && e.cooldown <= 0 && clearSight(e, p, s.blocks)) {
      e.cooldown = police ? 1.2 + random(s) * 0.6 : 1.4 + random(s) * 0.8; e.fireTime = 0.2;
      // Cars and lamp posts in the line of fire are cover; otherwise accuracy falls with distance and the player's speed.
      const cover = castShot(s, e, { x: p.x, z: p.z, y: s.driving ? 1.2 : (p.height || 0) + 2 }, { target: s.driving ? s.car : null });
      const moving = s.driving ? Math.min(1, Math.abs(s.car.speed) / 30) : Math.min(1, (s.player.speed || 0) / 15);
      const hit = !cover && (d < 8 || random(s) < Math.max(0.2, Math.min(0.95, 0.95 - d * 0.012 - moving * 0.45)));
      let tx = p.x, tz = p.z;
      if (cover) { tx = cover.x; tz = cover.z; bulletHit(s, cover, p.x - e.x, p.z - e.z); }
      else if (hit) {
        s.health -= (s.driving ? 2 : 5) * armorOf(s);
        if (!s.driving) { pushCharacter(s.player, p.x - e.x, p.z - e.z, 0.6); addImpact(s, p, p.x - e.x, p.z - e.z, 'shot', 0.6); }
      } else {
        const miss = (random(s) < 0.5 ? -1 : 1) * (1.5 + random(s) * 2);
        tx = p.x + Math.cos(heading) * miss + Math.sin(heading) * 6; tz = p.z - Math.sin(heading) * miss + Math.cos(heading) * 6;
      }
      s.shots.push({ x: e.x, z: e.z, tx, tz, ttl: 0.13, police: true });
    }
    e.fireTime = Math.max(0, (e.fireTime || 0) - dt);
  }
  if (!down) {
    if (arresting) {
      if (!s.arrest) notify(s, "Police: Don't move! You're under arrest. Run or fight back to resist.");
      s.arrest += dt; if (s.arrest >= 1.6) { bust(s); return; }
    } else s.arrest = Math.max(0, s.arrest - dt * 2);
  }
  stepPedestrians(s, p, dt);
  for (const person of [s.player, ...s.pedestrians]) person.hitCooldown = Math.max(0, (person.hitCooldown || 0) - dt);
  const physics = stepPhysics(s, dt);
  // Crash damage from Rapier contact forces (impact is the change in speed the crash imposed on the car).
  for (const { car, other, impact } of physics.impacts) {
    if (impact <= 5 || car.hitCooldown > 0) continue;
    car.damage = Math.min(100, car.damage + impact * (other ? 0.35 : 0.5)); car.impact = Math.min(1, impact / 25); car.hitCooldown = 0.5;
    if (car === s.car && s.driving) s.health -= impact * (other ? 0.2 : 0.25) * armorOf(s);
  }
  // People struck by cars: contact normals come from the physics contact manifolds.
  for (const { person, car, nx, nz, sx, sz, closing } of physics.hits) {
    if (person.health <= 0 || person.height > 1.4 || closing <= 3 || person.hitCooldown > 0) continue;
    // Children are only nudged aside (never thrown or hurt); everyone else takes the full impact.
    if (person.child) pushCharacter(person, sx, sz, Math.min(6, closing * 0.3));
    else pushCharacter(person, nx, nz, Math.min(18, closing * 0.8), closing > 8 ? Math.min(6, closing * 0.25) : 0);
    person.hitCooldown = 1;
    if (person === s.player) { s.health -= closing * 2 * armorOf(s); if (closing > 12) person.knockdown = 1.5; }
    else { injure(s, person, closing * 4, nx, nz, 'car'); if (closing > 6) person.knockdown = 1.6; }
    car.vx *= 0.9; car.vz *= 0.9;
    if (car === s.car && s.driving && !person.child) { s.heat = Math.max(1, s.heat); s.quiet = 0; s.alarm = { x: person.x, z: person.z, time: s.time, radius: 40 }; }
  }
  if (s.mission?.id === 'bounty' && s.mission.stage === 0 && s.enemies.some(e => e.boss && e.health <= 0)) { s.mission.stage = 1; notify(s, 'The gang boss is down. Lose the heat and report to the City Hub.'); }
  if (s.mission) checkpointMission(s);
  if (s.mission?.id === 'crew' && s.mission.stage === 0 && s.enemies.filter(e => e.kind === 'gang').every(e => e.health <= 0)) { s.mission.stage = 1; notify(s, 'Block cleared. Lose the heat and return to the City Hub.'); }
  if (!down && s.health <= 0) { if (s.boss?.alive) s.bossDeaths++; s.health = 0; s.down = 4; s.downReason = 'wasted'; notify(s, 'WASTED. Returning to the City Hub...'); }
}
