// The city metro: an elevated loop that runs above the alleys between the blocks (never over a lane of traffic), with a
// station wherever it bridges one of the two central avenues. The timetable is a pure function of the world clock
// (seconds), so every player sees the same train in the same place. Heading uses the game's convention, atan2(dx, dz).
export const METRO = Object.freeze({ half: 180, deck: 10, cars: 4, carLength: 11, gap: 1.2, travel: 26, dwell: 12 });
const SIDE = METRO.half * 2, LOOP = SIDE * 4;
// Clockwise from the north-west corner: east along the north side, south, west, then north.
export function loopPoint(s) {
  const d = ((s % LOOP) + LOOP) % LOOP, side = Math.floor(d / SIDE), along = d - side * SIDE, h = METRO.half;
  return [
    { x: -h + along, z: -h, heading: Math.PI / 2 }, { x: h, z: -h + along, heading: 0 },
    { x: h - along, z: h, heading: -Math.PI / 2 }, { x: -h, z: h - along, heading: Math.PI },
  ][side];
}
// Stations sit where the loop crosses the central avenues (x = 0 and z = 0); `exit` is on the pavement below.
export const STATIONS = Object.freeze([
  { id: 'uptown', name: 'Uptown', s: 180, x: 0, z: -180, exit: { x: 13, z: -168 } },
  { id: 'harbourside', name: 'Harbourside', s: 540, x: 180, z: 0, exit: { x: 168, z: 13 } },
  { id: 'southgate', name: 'Southgate', s: 900, x: 0, z: 180, exit: { x: -13, z: 168 } },
  { id: 'westfield', name: 'Westfield', s: 1260, x: -180, z: 0, exit: { x: -168, z: -13 } },
].map(Object.freeze));
const LEG = METRO.travel + METRO.dwell, CYCLE = LEG * STATIONS.length;
// Where the train is at world time `t` (seconds): its lead car, the station it is stopped at (or null) and the next one.
export function trainAt(t) {
  const phase = ((t % CYCLE) + CYCLE) % CYCLE, leg = Math.floor(phase / LEG), local = phase - leg * LEG, from = STATIONS[leg];
  let s = from.s, speed = 0;
  if (local >= METRO.dwell) {
    const u = (local - METRO.dwell) / METRO.travel;
    s = from.s + SIDE * u * u * (3 - 2 * u); speed = SIDE * 6 * u * (1 - u) / METRO.travel;
  }
  const lead = loopPoint(s);
  return { id: 'train', kind: 'train', s, x: lead.x, z: lead.z, heading: lead.heading, speed, y: METRO.deck, station: local < METRO.dwell ? leg : null, next: (leg + 1) % STATIONS.length, departsIn: local < METRO.dwell ? METRO.dwell - local : 0 };
}
// Seconds until the train next stands at station `index`.
export function arrivalIn(t, index) {
  const phase = ((t % CYCLE) + CYCLE) % CYCLE, at = index * LEG;
  if (phase >= at && phase < at + METRO.dwell) return 0;
  return ((at - phase) % CYCLE + CYCLE) % CYCLE;
}
// Pillars carry the viaduct inside the alleys, never within reach of a road (roads are every 120 m from 0).
export function metroPillars() {
  const pillars = [];
  for (let s = 0; s < LOOP; s += 20) {
    const p = loopPoint(s), along = p.heading === 0 || p.heading === Math.PI ? p.z : p.x;
    if (Math.abs(along - Math.round(along / 120) * 120) < 22) continue;
    pillars.push({ x: p.x, z: p.z });
  }
  return pillars;
}
export const nearestStation = (x, z) => STATIONS.reduce((best, st, i) => Math.hypot(st.x - x, st.z - z) < Math.hypot(STATIONS[best].x - x, STATIONS[best].z - z) ? i : best, 0);
