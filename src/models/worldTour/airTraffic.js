import { AIRPORT } from './worldIsland.js';

// Air traffic over every island: an airliner that lands on the airport runway, taxis round and takes off again, jets
// cruising high overhead, a news helicopter circling downtown and a tour helicopter following the coast. It is all a
// function of the shared world clock (seconds), so every player sees the same aircraft in the same places. It is
// scenery: nothing collides with it.
//   { id, kind: 'airliner' | 'jet' | 'helicopter', x, y, z, heading, pitch, bank, livery }
export const RUNWAY = Object.freeze({ x: AIRPORT.x, z0: -300, z1: -100 });
export const AIRLINER_CYCLE = 150;
const smooth = u => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

// The airliner's day: approach from the north over the sea, touch down, roll out, turn round at the end of the runway,
// wait, then take off back the way it came and climb away.
export function airlinerAt(t) {
  const c = ((t % AIRLINER_CYCLE) + AIRLINER_CYCLE) % AIRLINER_CYCLE, x = RUNWAY.x;
  const TOUCH = 22, ROLL = 32, TURN = 44, HOLD = 58, LIFT = 70, GONE = 105;
  if (c < TOUCH) { // approach: 1400 m out at 140 m, gliding down to the threshold
    const u = c / TOUCH, z = lerp(RUNWAY.z0 - 1400, RUNWAY.z0, u), y = lerp(140, 1.2, u);
    return { x, y, z, heading: 0, pitch: -Math.atan2(139, 1400), bank: 0, visible: true };
  }
  if (c < ROLL) { const u = smooth((c - TOUCH) / (ROLL - TOUCH)); return { x, y: 1.2, z: lerp(RUNWAY.z0, RUNWAY.z1 - 25, u), heading: 0, pitch: 0, bank: 0, visible: true }; }
  if (c < TURN) { const u = smooth((c - ROLL) / (TURN - ROLL)); return { x: x + Math.sin(u * Math.PI) * 9, y: 1.2, z: RUNWAY.z1 - 25 + Math.sin(u * Math.PI) * 6, heading: u * Math.PI, pitch: 0, bank: 0, visible: true }; }
  if (c < HOLD) return { x, y: 1.2, z: RUNWAY.z1 - 25, heading: Math.PI, pitch: 0, bank: 0, visible: true };
  if (c < LIFT) { const u = (c - HOLD) / (LIFT - HOLD); return { x, y: 1.2 + Math.max(0, u - 0.7) * 30, z: lerp(RUNWAY.z1 - 25, RUNWAY.z0 - 20, u * u), heading: Math.PI, pitch: u > 0.7 ? 0.2 : 0, bank: 0, visible: true }; }
  if (c < GONE) { const u = (c - LIFT) / (GONE - LIFT); return { x: x - u * 300, y: 10 + u * 420, z: RUNWAY.z0 - 20 - u * 2400, heading: Math.PI + u * 0.12, pitch: 0.2, bank: -0.12 * Math.sin(u * Math.PI), visible: true }; }
  return { x, y: 600, z: RUNWAY.z0 - 5000, heading: 0, pitch: 0, bank: 0, visible: false };
}
// Jets crossing the sky high up, each on its own line and timetable.
const JETS = Object.freeze([
  { angle: 0.55, offset: -300, y: 460, speed: 120, period: 95, phase: 0 },
  { angle: 2.3, offset: 420, y: 520, speed: 130, period: 120, phase: 40 },
  { angle: 4.1, offset: 150, y: 390, speed: 110, period: 140, phase: 85 },
]);
const SPAN = 7000;
export function jetsAt(t) {
  return JETS.map((j, i) => {
    const run = ((t + j.phase) % j.period + j.period) % j.period * j.speed - SPAN / 2, dx = Math.sin(j.angle), dz = Math.cos(j.angle);
    return { id: 'jet-' + i, kind: 'jet', x: dx * run + dz * j.offset, y: j.y, z: dz * run - dx * j.offset, heading: j.angle, pitch: 0, bank: 0, visible: run < SPAN / 2 };
  });
}
// A news helicopter circling downtown, and a tour helicopter flying round the coast.
export function helicoptersAt(t) {
  const a = t * (Math.PI * 2 / 70), b = t * (Math.PI * 2 / 160);
  return [
    { id: 'news', kind: 'helicopter', livery: 'news', x: Math.cos(a) * 170, y: 95 + Math.sin(a * 2) * 8, z: Math.sin(a) * 170, heading: -a, pitch: 0.08, bank: -0.18, visible: true },
    { id: 'tour', kind: 'helicopter', livery: 'tour', x: Math.cos(b) * 560, y: 70, z: Math.sin(b) * 470, heading: Math.atan2(-Math.sin(b) * 560, Math.cos(b) * 470), pitch: 0.06, bank: -0.1, visible: true },
  ];
}
export function airTraffic(t) {
  return [{ id: 'airliner', kind: 'airliner', ...airlinerAt(t) }, ...jetsAt(t), ...helicoptersAt(t)].filter(a => a.visible);
}
