import { ROAD_GRID, length, random, stepCharacterBody } from './worldPhysics.js';
import { sceneryLayout } from './worldLayout.js';

// Sidewalk street life: families with children, office workers, joggers and friends walking together, plus the people
// at street spots (worldLayout.js): vendors behind food stalls, customers queuing, commuters at bus stops, people on
// benches and friends chatting. Walkers stop at spots they pass, stay a while and move on, so spots keep changing.
// Pedestrians walk sidewalk lanes 13 units from each road centre and may turn at corners.
const SIDEWALK = 13;
const CORNERS = ROAD_GRID.flatMap(road => [road - SIDEWALK, road + SIDEWALK]);
const SKIN = ['#f3cfb0', '#e0ac85', '#c18b63', '#9a6644', '#6d452e', '#4d3122'];
const HAIR = ['#2a211c', '#4b3428', '#7d532f', '#c7a266', '#161616', '#a7a39c', '#8c3b2b'];
const CASUAL = ['#e7b591', '#99b5c0', '#cc93a3', '#f0d58a', '#8fc7a2', '#b6a4d8', '#e98d6f', '#f2efe6', '#6f8fbf'];
const PANTS = ['#344655', '#4d5a6a', '#6b5a48', '#2f3338', '#7b8793', '#a38f72'];
const SUITS = ['#2b3240', '#3b3e46', '#26314a', '#4a4038', '#51565e'];
const KIDS = ['#ff9a8a', '#ffd166', '#7bd3ea', '#a0e37b', '#e39bf0', '#ffb36b'];
// Share of non-vendor spot slots occupied when a session starts, and the share the city keeps topping up to.
const RESIDENT_SHARE = 0.26, TARGET_SHARE = 0.32;

// Group plans are fixed so every city has the same mix; the city seed changes looks and placement.
const GROUPS = [
  ...Array.from({ length: 7 }, (_, i) => ({ type: 'family', parents: 1 + (i % 2), kids: 1 + (i % 3 === 0 ? 1 : 0) })),
  ...Array.from({ length: 9 }, () => ({ type: 'business' })),
  ...Array.from({ length: 14 }, () => ({ type: 'adult' })),
  ...Array.from({ length: 3 }, () => ({ type: 'jogger' })),
  ...Array.from({ length: 6 }, () => ({ type: 'friends' })),
];
// Follower slots relative to the group leader: lateral offset (right is positive) and distance behind.
const SLOTS = [[1.3, 0.3], [-1.15, 0.1], [0.6, 1.9], [-0.6, 1.9]];

const pick = (s, list) => list[Math.floor(random(s) * list.length)];
function look(s, role) {
  const kid = role === 'kid';
  return {
    skin: pick(s, SKIN), hair: pick(s, HAIR),
    hairStyle: pick(s, kid ? ['short', 'long', 'cap', 'short'] : role === 'business' ? ['short', 'short', 'long', 'bald'] : role === 'jogger' ? ['cap', 'short', 'long'] : ['short', 'long', 'long', 'cap', 'bald']),
    shirt: role === 'business' ? pick(s, SUITS) : kid ? pick(s, KIDS) : role === 'jogger' ? pick(s, ['#ff6b6b', '#3dd6c6', '#f7d24a', '#8f7cff']) : pick(s, CASUAL),
    pants: role === 'business' ? '' : pick(s, PANTS),
    scale: kid ? 0.56 + random(s) * 0.12 : 0.94 + random(s) * 0.13,
    backpack: kid && random(s) < 0.6,
  };
}
function spawnPoint(s, awayFrom, minimum = 0) {
  for (let tries = 0; tries < 40; tries++) {
    const axis = random(s) < 0.5 ? 'x' : 'z', lane = pick(s, CORNERS);
    let along = -400 + random(s) * 800;
    // Never place a group in the roadway at a crossing.
    for (const road of ROAD_GRID) if (Math.abs(along - road) < 16) along = road + (along < road ? -18 : 18);
    const point = axis === 'z' ? { x: lane, z: along } : { x: along, z: lane };
    if (!awayFrom || length(point, awayFrom) >= minimum) return { axis, lane, along, point };
  }
  return { axis: 'z', lane: CORNERS[0], along: 0, point: { x: CORNERS[0], z: 0 } };
}
function place(s, person, leader, spawn, slot) {
  const heading = spawn.axis === 'z' ? (leader.direction > 0 ? 0 : Math.PI) : (leader.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  const [side, back] = slot || [0, 0], fx = Math.sin(heading), fz = Math.cos(heading), rx = -Math.cos(heading), rz = Math.sin(heading);
  Object.assign(person, {
    x: spawn.point.x + rx * side - fx * back, z: spawn.point.z + rz * side - fz * back, heading, axis: spawn.axis, lane: spawn.lane,
    health: 100, speed: 0, fall: 0, fallVelocity: 0, knockdown: 0, height: 0, vy: 0, kickX: 0, kickZ: 0, moveX: 0, moveZ: 0,
    deadAt: undefined, idle: 0, pause: 6 + random(s) * 20, panic: false, ragdoll: null, getUp: 0,
    mode: 'walk', pose: null, spot: null, route: null, stay: 0,
  });
}

// ---- Street spots. s.spots[spot][slot] holds the id of the person using that slot, or null.
const lanePoint = (spot, point) => spot.axis === 'z' ? { x: spot.lane, z: point.z } : { x: point.x, z: spot.lane };
function claim(s, person, h, k) {
  const spot = sceneryLayout().spots[h];
  s.spots[h][k] = person.id; person.spot = { h, k }; person.axis = spot.axis; person.lane = spot.lane;
}
function release(s, person) {
  if (person.spot && s.spots[person.spot.h]?.[person.spot.k] === person.id) s.spots[person.spot.h][person.spot.k] = null;
  person.spot = null; person.pose = null; person.route = null; person.mode = 'walk';
}
const nearestCorner = value => CORNERS.reduce((best, c) => Math.abs(value - c) < Math.abs(value - best) ? c : best, CORNERS[0]);
// A sidewalk route from a walker's lane to the point on a spot's lane opposite `point`: along the current lane, round
// the corner onto a crossing lane when needed, then along the spot's lane. Every leg follows a sidewalk.
function sidewalkRoute(person, spot, point) {
  const axis = person.axis, lane = person.lane, entry = lanePoint(spot, point);
  const at = (along, across) => axis === 'z' ? { x: across, z: along } : { x: along, z: across };
  if (spot.axis !== axis) return [at(spot.lane, lane), entry];
  if (spot.lane === lane) return [entry];
  const crossing = nearestCorner(person[axis]);
  return [at(crossing, lane), at(crossing, spot.lane), entry];
}
// Walk to a slot along the sidewalks, around the counter for vendors, then into place.
function approach(s, person, h, k) {
  const spot = sceneryLayout().spots[h], slot = spot.slots[k], route = sidewalkRoute(person, spot, slot.via?.[0] || slot);
  claim(s, person, h, k);
  person.mode = 'approach'; person.stay = slot.vendor ? Infinity : 15 + random(s) * 45;
  person.route = [...route, ...(slot.via || []), { x: slot.x, z: slot.z }];
}
const canVisit = (person, leaders) => person.mode === 'walk' && person.leader === null && !person.child && person.role !== 'jogger' && !person.home && !person.panic && !leaders.has(person) && person.health > 0 && !person.knockdown && !person.ragdoll;
// Keeps spots busy: while fewer than TARGET_SHARE of the non-vendor slots are in use, the nearest free walker is sent to
// a free slot. Walkers far from any free slot are left alone.
function fillSpots(s, leaders) {
  const spots = sceneryLayout().spots, free = [];
  let used = 0, total = 0;
  spots.forEach((spot, h) => spot.slots.forEach((slot, k) => { if (slot.vendor) return; total++; if (s.spots[h][k]) used++; else free.push([h, k]); }));
  for (let sent = 0; sent < 2 && used / total < TARGET_SHARE && free.length; sent++, used++) {
    const [h, k] = free.splice(Math.floor(random(s) * free.length), 1)[0], slot = spots[h].slots[k];
    let best = null, bestDistance = 220;
    for (const person of s.pedestrians) {
      if (!canVisit(person, leaders) || person.lastSpot === h) continue;
      const d = Math.abs(person.x - slot.x) + Math.abs(person.z - slot.z);
      if (d < bestDistance) { best = person; bestDistance = d; }
    }
    if (best) approach(s, best, h, k);
  }
}
// Place someone directly in a slot (session start, a vendor reopening a stall).
function settle(s, person, h, k) {
  const spot = sceneryLayout().spots[h], slot = spot.slots[k];
  place(s, person, person, { axis: spot.axis, lane: spot.lane, point: slot }, null);
  claim(s, person, h, k);
  Object.assign(person, { heading: slot.heading, mode: 'stay', pose: slot.pose, idle: 1, stay: slot.vendor ? Infinity : 6 + random(s) * 50 });
}
function leave(s, person) {
  const spot = sceneryLayout().spots[person.spot.h], slot = spot.slots[person.spot.k];
  s.spots[person.spot.h][person.spot.k] = null;
  Object.assign(person, { mode: 'leave', pose: null, route: [...(slot.via || []).slice().reverse(), lanePoint(spot, slot.via?.[0] || slot)], lastSpot: person.spot.h, direction: random(s) < 0.5 ? 1 : -1, pause: 8 + random(s) * 20 });
}
function stepSpot(s, person, dt) {
  if (person.mode === 'stay') {
    const slot = sceneryLayout().spots[person.spot.h].slots[person.spot.k];
    stepCharacterBody(person, (slot.x - person.x) * 4, (slot.z - person.z) * 4, dt);
    person.heading = slot.heading; person.pose = slot.pose; person.idle = 1;
    person.stay -= dt;
    if (person.stay <= 0) leave(s, person);
    return;
  }
  const target = person.route[0], dx = target.x - person.x, dz = target.z - person.z, gap = Math.hypot(dx, dz);
  if (gap < 0.3) {
    person.route.shift();
    if (person.route.length) return;
    if (person.mode === 'approach') { person.mode = 'stay'; person.idle = 1; } else { person.mode = 'walk'; person.spot = null; person.route = null; }
    return;
  }
  const speed = Math.min(person.walk, gap * 3);
  stepCharacterBody(person, dx / gap * speed, dz / gap * speed, dt);
  person.heading = Math.atan2(dx, dz); person.idle = 0;
}
// Every stall gets its vendor; residents fill some of the other slots.
function populateSpots(s, people) {
  const spots = sceneryLayout().spots;
  s.spots = spots.map(spot => spot.slots.map(() => null));
  spots.forEach((spot, h) => spot.slots.forEach((slot, k) => {
    if (!slot.vendor && random(s) > RESIDENT_SHARE) return;
    const role = slot.vendor || random(s) >= 0.3 ? 'adult' : 'business';
    const person = {
      id: 'civilian-' + people.length, kind: 'civilian', role, child: false, group: 'spot-' + people.length, leader: null, slot: null, direction: 1,
      walk: role === 'business' ? 2 + random(s) * 0.5 : 1.4 + random(s) * 0.5, look: look(s, role), home: slot.vendor ? { h, k } : null,
    };
    settle(s, person, h, k);
    people.push(person);
  }));
}

export function createPedestrians(s) {
  const people = [];
  GROUPS.forEach((plan, group) => {
    const roles = plan.type === 'family' ? [...Array(plan.parents).fill('parent'), ...Array(plan.kids).fill('kid')] : plan.type === 'friends' ? ['adult', 'adult'] : [plan.type];
    const spawn = spawnPoint(s), leaderIndex = people.length, direction = random(s) < 0.5 ? 1 : -1;
    roles.forEach((role, member) => {
      const person = {
        id: 'civilian-' + people.length, kind: 'civilian', role: role === 'parent' ? 'adult' : role, child: role === 'kid', group,
        leader: member ? leaderIndex : null, slot: member ? SLOTS[member - 1] : null, direction,
        walk: role === 'jogger' ? 4.6 + random(s) : role === 'business' ? 2 + random(s) * 0.5 : 1.4 + random(s) * 0.5,
        look: look(s, role === 'parent' ? 'adult' : role),
      };
      place(s, person, person.leader === null ? person : people[leaderIndex], spawn, person.slot);
      people.push(person);
    });
  });
  populateSpots(s, people);
  return people;
}

function crossedCorner(before, after) {
  return CORNERS.find(c => (before - c) * (after - c) < 0 && Math.abs(c) < 420);
}
function nearRoad(value) { return ROAD_GRID.some(road => Math.abs(value - road) < 12); }
function frightened(s, person, player) {
  const alarm = s.alarm && s.time - s.alarm.time < 7 && length(person, s.alarm) < s.alarm.radius;
  return !!alarm || (s.heat > 0 && s.quiet < 8 && length(person, player) < 60);
}

export function stepPedestrians(s, player, dt) {
  const people = s.pedestrians, spots = sceneryLayout().spots;
  if (!s.spots) s.spots = spots.map(spot => spot.slots.map(() => null));
  const leaders = new Set(people.filter(p => p.leader !== null).map(p => people[p.leader]));
  for (const person of people) {
    if (person.health <= 0 || person.knockdown > 0 || person.ragdoll) { if (person.spot) release(s, person); stepCharacterBody(person, 0, 0, dt); person.panic = false; continue; }
    const leader = person.leader === null ? null : people[person.leader];
    const following = leader && leader.health > 0;
    const afraid = frightened(s, person, following ? leader : person) || (following && leader.panic);
    person.panic = afraid;
    if (following) {
      // Stay in formation beside or behind the leader (children hold the leader's hand).
      person.axis = leader.axis; person.lane = leader.lane; person.direction = leader.direction;
      const h = leader.heading, [side, back] = person.slot, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
      const tx = leader.x + rx * side - fx * back, tz = leader.z + rz * side - fz * back, dx = tx - person.x, dz = tz - person.z, gap = Math.hypot(dx, dz);
      const limit = (leader.knockdown > 0 ? 0 : leader.speed || 0) + (afraid ? 4 : 1.6), speed = Math.min(limit, gap * 3);
      const vx = gap > 0.05 ? dx / gap * speed : 0, vz = gap > 0.05 ? dz / gap * speed : 0;
      stepCharacterBody(person, vx, vz, dt);
      if (speed > 0.35) person.heading = Math.atan2(vx, vz);
      else person.heading = leader.idle > 0 && !person.child ? Math.atan2(leader.x - person.x, leader.z - person.z) : leader.heading;
      person.idle = leader.idle;
      // Children waiting with a parent occasionally hop in place.
      if (person.child && leader.idle > 0 && !person.height && random(s) < dt * 0.5) person.vy = 3.2;
      continue;
    }
    if (person.mode && person.mode !== 'walk') {
      // Violence nearby empties the spots: everyone drops what they are doing and runs.
      if (afraid) release(s, person);
      else { stepSpot(s, person, dt); continue; }
    }
    const along = person.axis, perp = along === 'z' ? 'x' : 'z';
    if (afraid) { person.direction = person[along] >= player[along] ? 1 : -1; person.idle = 0; }
    else if (!person.child && person.role !== 'jogger' && !leaders.has(person)) {
      person.spotCheck = (person.spotCheck || 0) - dt;
      if (person.spotCheck <= 0) {
        person.spotCheck = 1;
        // Vendors head back to their stall once things calm down; other walkers may stop at a spot they are passing.
        const home = person.home && !s.spots[person.home.h][person.home.k] ? person.home : null;
        if (home) { approach(s, person, home.h, home.k); stepSpot(s, person, dt); continue; }
        const h = spots.findIndex((spot, i) => i !== person.lastSpot && spot.axis === along && spot.lane === person.lane && Math.abs(spot.along - person[along]) < 5);
        if (h >= 0) {
          person.lastSpot = h;
          const free = spots[h].slots.map((slot, k) => k).filter(k => !spots[h].slots[k].vendor && !s.spots[h][k]);
          if (free.length && random(s) < 0.35) { approach(s, person, h, free[Math.floor(random(s) * free.length)]); stepSpot(s, person, dt); continue; }
        }
      }
    }
    let speed = 0;
    if (person.idle > 0) person.idle -= dt;
    else {
      person.pause -= dt;
      if (person.pause <= 0 && !afraid && !nearRoad(person[along])) {
        // Stop to window-shop, take a call or chat, facing the nearest storefront.
        person.idle = 2.5 + random(s) * 5; person.pause = 10 + random(s) * 25;
        const road = ROAD_GRID.reduce((best, r) => Math.abs(person.lane - r) < Math.abs(person.lane - best) ? r : best, 0), side = Math.sign(person.lane - road) || 1;
        person.idleHeading = along === 'z' ? side * Math.PI / 2 : side > 0 ? 0 : Math.PI;
      } else speed = afraid ? (person.child ? 5.5 : 7) : person.walk;
    }
    if (person[along] > 420) person.direction = -1; else if (person[along] < -420) person.direction = 1;
    const before = person[along], forward = person.direction * speed, correction = Math.max(-2, Math.min(2, (person.lane - person[perp]) * 2));
    stepCharacterBody(person, along === 'x' ? forward : correction, along === 'z' ? forward : correction, dt);
    person.heading = speed ? Math.atan2(along === 'x' ? forward : correction * 0.2, along === 'z' ? forward : correction * 0.2) : person.idleHeading ?? person.heading;
    const corner = speed ? crossedCorner(before, person[along]) : undefined;
    if (corner !== undefined && !afraid && random(s) < 0.3) {
      // Turn onto the crossing sidewalk: the corner coordinate becomes the new lane.
      person.axis = perp; person.lane = corner; person.direction = random(s) < 0.5 ? 1 : -1;
    }
  }
  s.respawnCheck = (s.respawnCheck || 0) - dt;
  if (s.respawnCheck > 0) return;
  s.respawnCheck = 1;
  fillSpots(s, leaders);
  // Bodies are cleared once nobody in the group is near the player; the group re-enters elsewhere as new pedestrians.
  const groups = new Map();
  for (const person of people) { if (!groups.has(person.group)) groups.set(person.group, []); groups.get(person.group).push(person); }
  for (const members of groups.values()) {
    if (!members.some(m => m.health <= 0 && s.time - (m.deadAt ?? s.time) > 40)) continue;
    if (members.some(m => length(m, player) < 150)) continue;
    // A vendor reopens their own stall, once it is well away from the player; everyone else re-enters as a walker.
    const home = members.length === 1 && members[0].home;
    if (home) {
      if (length(spots[home.h].slots[home.k], player) >= 150 && !s.spots[home.h][home.k]) settle(s, members[0], home.h, home.k);
      continue;
    }
    const spawn = spawnPoint(s, player, 190), lead = members.find(m => m.leader === null), direction = random(s) < 0.5 ? 1 : -1;
    for (const m of members) { m.direction = direction; place(s, m, lead, spawn, m.slot); }
  }
}
