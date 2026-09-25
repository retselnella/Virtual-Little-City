// Traffic lights at every crossing of the city's avenues. All lights run one cycle on the shared world clock, so every
// player sees the same colours: north–south traffic gets green, then yellow, then an all-red moment, then east–west
// traffic gets its turn. AI drivers (traffic, and patrol cars not on a call) stop at the line on red, and on yellow
// when they can still stop comfortably. Your own car is free to run them.
export const SIGNAL = Object.freeze({ green: 12, yellow: 3, allRed: 1.5 });
export const CYCLE = 2 * (SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed);
export const CROSSINGS = Object.freeze([-360, -240, -120, 0, 120, 240, 360]);
export const STOP_LINE = 13; // from the crossing's centre: the cross street is 21 m wide, plus the crosswalk
const HALF = SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed;

// 'green', 'yellow' or 'red' for traffic moving along `axis` ('ns': along z, 'ew': along x) at world time `t` (s).
export function signalAt(t, axis) {
  const phase = ((t % CYCLE) + CYCLE) % CYCLE, local = axis === 'ns' ? phase : (phase + HALF) % CYCLE;
  return local < SIGNAL.green ? 'green' : local < SIGNAL.green + SIGNAL.yellow ? 'yellow' : 'red';
}
const nearest = v => CROSSINGS.reduce((best, n) => Math.abs(v - n) < Math.abs(v - best) ? n : best, CROSSINGS[0]);
// How far `car` is from the stop line it must stop at, or null when it may drive on. Cars already past the line (in
// the crossing) keep going; so do cars that cannot stop in time on yellow.
export function stopLineAhead(car, t) {
  const along = Math.abs(Math.cos(car.heading)) >= Math.abs(Math.sin(car.heading)) ? 'ns' : 'ew';
  const [pos, side, dir] = along === 'ns' ? [car.z, car.x, Math.sign(Math.cos(car.heading))] : [car.x, car.z, Math.sign(Math.sin(car.heading))];
  if (Math.abs(side - nearest(side)) > 9 || Math.abs(side) > 372) return null; // not on a city avenue
  const next = CROSSINGS.filter(c => (c - pos) * dir > STOP_LINE - 2).sort((a, b) => (a - pos) * dir - (b - pos) * dir)[0];
  if (next === undefined) return null;
  const distance = (next - pos) * dir - STOP_LINE, light = signalAt(t, along);
  if (distance > 45 || light === 'green') return null;
  const speed = Math.hypot(car.vx || 0, car.vz || 0);
  if (light === 'yellow' && distance < speed * speed / (2 * 5)) return null; // too close to stop: clear the crossing
  return Math.max(0, distance);
}
// Every signal head, for the renderer: two per corner (one facing each street), four corners per crossing.
export function signalHeads() {
  const heads = [];
  for (const x of CROSSINGS) for (const z of CROSSINGS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = x + sx * 12.6, cz = z + sz * 12.6;
    heads.push({ x: cx, z: cz, axis: 'ns', facing: sz < 0 ? Math.PI : 0 }, { x: cx, z: cz, axis: 'ew', facing: sx < 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  return heads;
}
