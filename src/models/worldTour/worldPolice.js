import { length, roadRoute, fits, random, patrolRoute, vehicle, ROAD_GRID } from './worldPhysics.js';
import { bodyGone } from './worldPedestrians.js';
import { FADE_RATE, crewUnits, escapeTime } from './wanted.js';

// Units that are part of the current incident (lights on, can observe the suspect).
export const ACTIVE_UNIT = ['responding', 'onscene', 'regroup'];
const snap = value => ROAD_GRID.reduce((best, n) => Math.abs(value - n) < Math.abs(value - best) ? n : best, 0);

// Police cars never run out: when every patrol is busy (or knocked out), a reinforcement unit drives in from a crossing
// out of sight, 220 to 340 m away. Reinforcements leave the city once the pursuit is over.
export const MAX_POLICE_CARS = 12;
function reinforcement(s, player, clearSight) {
  const spots = [];
  for (const x of ROAD_GRID) for (const z of ROAD_GRID) { const d = Math.hypot(x - player.x, z - player.z); if (d > 220 && d < 340 && !clearSight({ x, z }, player, s.blocks)) spots.push({ x, z }); }
  if (!spots.length) return null;
  const at = spots[Math.floor(random(s) * spots.length)];
  s.unitSeq = (s.unitSeq || 0) + 1;
  const car = { ...vehicle('unit-' + s.unitSeq, at.x + 4, at.z + 4, Math.atan2(player.x - at.x, player.z - at.z), 'police'), state: 'patrol', base: { x: at.x + 4, z: at.z + 4 }, home: at, route: [], loop: false, replan: 0, deployed: false, reinforcement: true };
  s.policeCars.push(car);
  return car;
}
// A unit whose officers are all down is out of action: the car stays where it stopped, lights off, until the pursuit
// is over and it is well out of sight; then a new crew drives it back to its beat (reinforcements leave the city).
function crewDown(s, car) {
  if (!car.deployed || car.boarded) return false;
  const crew = s.enemies.filter(e => e.unit === car.id);
  return crew.length > 0 && crew.every(e => e.health <= 0);
}
export function updatePolice(s, player, dt, clearSight) {
  const cars = s.policeCars;
  if (s.heat > 0) {
    // Dispatch knows where the crime was reported; later units only know the last place the suspect was seen.
    if (!s.incident) { s.incident = true; s.dispatchDelay = 3; s.unseen = 0; s.lostFor = 0; s.searched = false; s.lastSeen ||= { x: player.x, z: player.z }; }
    s.dispatchDelay -= dt;
    const observed = !!s.heliSpotted || cars.some(c => ACTIVE_UNIT.includes(c.state) && length(c, player) < 60 && clearSight(c, player, s.blocks)) || s.enemies.some(e => e.kind === 'police' && e.health > 0 && !e.returning && length(e, player) < 45 && clearSight(e, player, s.blocks));
    s.unseen = observed ? 0 : (s.unseen || 0) + dt;
    if (observed) s.lastSeen = { x: player.x, z: player.z };
    // You have only got away once the police have been looking: after a unit has seen you or reached the scene.
    if (!s.searched && (observed || cars.some(c => ACTIVE_UNIT.includes(c.state) && s.lastSeen && length(c, s.lastSeen) < 45) || (s.helicopters || []).some(h => s.lastSeen && length(h, s.lastSeen) < 60))) s.searched = true;
    s.lostFor = observed || !s.searched ? 0 : (s.lostFor || 0) + dt;
    // Got away: out of sight of every unit (and not attacking) long enough for the level. The search goes on while the
    // stars fade; once they reach zero everyone stands down.
    if (s.quiet > 12 && s.lostFor > escapeTime(s.heat)) s.heat = Math.max(0, s.heat - dt * FADE_RATE);
    for (const car of cars) if (['onscene', 'regroup'].includes(car.state) && crewDown(s, car)) {
      car.state = 'down'; car.route = []; car.waypoint = 0; car.loop = false; car.downAt = s.time;
      s.message = 'A unit is down. Police reinforcements are on their way.'; s.messageTime = 4; s.dispatchDelay = Math.min(s.dispatchDelay, 1.5);
    }
    const active = cars.filter(c => ACTIVE_UNIT.includes(c.state));
    if (s.heat > 0 && s.dispatchDelay <= 0 && active.length < crewUnits(s.heat, s.crew)) {
      const goal = s.unseen < 4 ? player : s.lastSeen;
      const unit = cars.filter(c => c.state === 'patrol').sort((a, b) => length(a, goal) - length(b, goal))[0] || (cars.length < MAX_POLICE_CARS ? reinforcement(s, player, clearSight) : null);
      if (unit) {
        unit.state = 'responding'; unit.loop = false; unit.route = roadRoute(unit, goal); unit.waypoint = 0; unit.replan = 1.5; unit.goal = { x: goal.x, z: goal.z };
        s.message = 'Police dispatched. A patrol car is responding by road.'; s.messageTime = 5;
      }
      s.dispatchDelay = 4;
    }
  }
  if (!s.heat && s.incident) { s.incident = false; s.lastSeen = null; s.kills = 0; s.message = 'You got away! The police are standing down and the helicopters are heading home.'; s.messageTime = 6; }
  // Bodies of officers are cleared with everyone else's.
  if (s.enemies.some(e => e.kind === 'police' && bodyGone(e, s.time))) s.enemies = s.enemies.filter(e => !(e.kind === 'police' && bodyGone(e, s.time)));
  for (const car of s.policeCars) if (car.state === 'down' && !s.heat && length(car, player) > 150 && !clearSight(car, player, s.blocks)) { car.state = 'returning'; car.route = []; car.waypoint = 0; }
  for (const car of cars) {
    car.replan -= dt;
    if (!s.heat && ACTIVE_UNIT.includes(car.state)) {
      car.state = 'returning'; car.route = []; car.waypoint = 0; car.loop = false;
    }
    if (car.state !== 'responding') { car.chasing = false; car.ignore = null; }
    if (car.state === 'responding') {
      const d = length(car, player), visible = d < 110 && clearSight(car, player, s.blocks);
      const fleeing = s.driving && Math.abs(player.speed) >= 4;
      car.chasing = false; car.ignore = null;
      if (d < 30 && visible && !fleeing) {
        car.route = []; car.waypoint = 0;
        if (Math.hypot(car.vx, car.vz) < 1.2) {
          // Officers appear at their car doors only after the car has arrived and stopped.
          if (!car.deployed) {
            for (const side of [-1, 1]) {
              const x = car.x + Math.cos(car.heading) * side * 3.5, z = car.z - Math.sin(car.heading) * side * 3.5;
              s.officerSeq = (s.officerSeq || 0) + 1;
              if (fits(x, z, s.blocks, 0.8) && Math.hypot(x - player.x, z - player.z) > 7) s.enemies.push({ id: car.id + ':' + side + ':' + s.officerSeq, unit: car.id, kind: 'police', x, z, heading: car.heading, health: 100, cooldown: 2.5, speed: 0 });
            }
            car.deployed = true;
          }
          car.state = 'onscene';
        }
      } else if (visible) {
        // Direct pursuit while the suspect is in sight, aiming ahead of a fleeing vehicle.
        const lead = fleeing ? Math.min(1.2, d / 45) : 0, ahead = { x: player.x + (player.vx || 0) * lead, z: player.z + (player.vz || 0) * lead };
        car.route = [fits(ahead.x, ahead.z, s.blocks, car.radius) && clearSight(car, ahead, s.blocks) ? ahead : { x: player.x, z: player.z }]; car.waypoint = 0;
        car.chasing = fleeing; car.ignore = fleeing ? s.car : null; car.replan = 1.5; car.goal = null;
      } else if (car.replan <= 0) {
        // Out of sight: head for the last known position, then search the surrounding blocks.
        const recent = s.unseen < 4, goal = recent ? player : s.lastSeen || player;
        const finished = car.waypoint >= car.route.length;
        if (!recent && length(car, goal) < 25) {
          const x = snap(goal.x + (random(s) - 0.5) * 260), z = snap(goal.z + (random(s) - 0.5) * 260);
          car.goal = { x, z }; car.route = roadRoute(car, car.goal); car.waypoint = 0; car.replan = 8;
        } else {
          // Only replan when the goal has moved, so a unit never abandons a good route mid-corner.
          if (finished || !car.goal || length(car.goal, goal) > 12) { car.goal = { x: goal.x, z: goal.z }; car.route = roadRoute(car, goal); car.waypoint = 0; }
          car.replan = 1.5;
        }
      } else if (car.waypoint >= car.route.length) car.replan = 0;
    }
    if (car.state === 'onscene') {
      // A suspect who drives off or runs far away is pursued by car again, so officers regroup first.
      const escaping = (s.driving && Math.abs(player.speed) > 8) || length(car, player) > 55;
      if (escaping) { car.state = 'regroup'; car.regroup = 6; }
    }
    if (car.state === 'regroup' || car.state === 'returning') {
      for (const e of s.enemies) if (e.unit === car.id && e.health > 0) e.returning = true;
      const aboard = s.enemies.filter(e => e.unit === car.id && e.health > 0 && length(e, car) < 4.5).length;
      if (aboard) { car.boarded = (car.boarded || 0) + aboard; s.enemies = s.enemies.filter(e => !(e.unit === car.id && e.health > 0 && length(e, car) < 4.5)); }
    }
    if (car.state === 'regroup') {
      car.regroup -= dt;
      const outside = s.enemies.filter(e => e.unit === car.id && e.health > 0);
      if (!outside.length || car.regroup <= 0) {
        // Anyone who could not make it back keeps chasing on foot.
        for (const e of outside) e.returning = false;
        car.state = 'responding'; car.deployed = false; car.boarded = 0; car.route = []; car.waypoint = 0; car.replan = 0;
      }
    }
    if (car.state === 'returning') {
      if (!s.enemies.some(e => e.unit === car.id && e.health > 0)) {
        if (!car.route.length || car.waypoint >= car.route.length && length(car, car.base) >= 5) { car.route = roadRoute(car, car.base); car.waypoint = 0; }
        if (length(car, car.base) < 5 && Math.hypot(car.vx, car.vz) < 2) {
          if (car.reinforcement) car.gone = true;
          car.state = 'patrol'; car.deployed = false; car.boarded = 0; car.loop = true;
          car.route = patrolRoute(car.home); car.waypoint = 0;
        }
      }
    }
  }
  if (s.policeCars.some(c => c.gone)) s.policeCars = s.policeCars.filter(c => !c.gone);
}
