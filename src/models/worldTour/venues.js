// Two places to hang out in every city, each on a whole city block by the City Hub (its four buildings make way):
//  - the Lounge: a deck with a dance floor, a DJ booth, a bar and sofas. Your music plays while you are there.
//  - the Open-Air Cinema: a big screen and rows of seats, showing the site's shows and movies on a timetable that
//    follows the shared world clock, so everyone watching sees the same moment of the same film.
// Sit on any sofa or cinema seat (E); move to get up. Local coordinates are metres from the block's centre.
export const LOUNGE = Object.freeze({ id: 'lounge', name: 'Skyline Lounge', x: -60, z: 60, half: 42 });
export const CINEMA = Object.freeze({ id: 'cinema', name: 'Open-Air Cinema', x: -60, z: -60, half: 42 });
export const VENUES = Object.freeze([LOUNGE, CINEMA]);
// The cinema screen (16:9) on the face of its wall at the north end of the block, facing the seats.
export const SCREEN = Object.freeze({ x: CINEMA.x, z: CINEMA.z - 36.4, y: 15, width: 40, height: 22.5 });
export const SCREEN_WALL = Object.freeze({ x: CINEMA.x, z: CINEMA.z - 38, width: 44, depth: 2.5, height: 29 });
// Seats: where you sit and which way you face (toward the dance floor, or the screen).
const at = (venue, x, z, heading) => ({ venue: venue.id, x: venue.x + x, z: venue.z + z, heading });
export const SEATS = Object.freeze({
  lounge: Object.freeze([
    ...[-10, -4, 4, 10].flatMap(z => [-0.9, 0.9].map(d => at(LOUNGE, 17, z + d, -Math.PI / 2))), // east sofas face west
    ...[-8, 0, 8].flatMap(x => [-0.9, 0.9].map(d => at(LOUNGE, x + d, 17, Math.PI))),            // south sofas face north
  ]),
  // Some cinema seats are the regulars' (townspeople who are always at the movies); the rest are free.
  cinema: Object.freeze([-12, -7, -2, 3, 8, 13, 18, 23].flatMap((z, row) => Array.from({ length: 13 }, (_, i) => ({ ...at(CINEMA, -15 + i * 2.5, z, Math.PI), ...(row >= 1 && row <= 5 && (i + row) % 4 === 1 ? { npc: true } : {}) })))),
});
// Which venue a point is in (its block), if any.
export function venueAt(x, z) {
  return VENUES.find(v => Math.abs(x - v.x) < v.half && Math.abs(z - v.z) < v.half)?.id || null;
}
// The free seat nearest to `pos` within reach, if any. `taken` holds seats other people are using ("x,z" keys).
export function seatNear(pos, taken = new Set(), reach = 2.6) {
  const venue = venueAt(pos.x, pos.z);
  if (!venue) return null;
  let best = null;
  for (const seat of SEATS[venue]) {
    const d = Math.hypot(seat.x - pos.x, seat.z - pos.z);
    if (d < reach && !seat.npc && !taken.has(`${seat.x},${seat.z}`) && (!best || d < best.d)) best = { ...seat, d };
  }
  return best;
}
// The venue blocks replace the city buildings on their block; the cinema's screen wall is solid.
export function venueBlocks(blocks) {
  const kept = blocks.filter(b => !VENUES.some(v => Math.abs(b.x - v.x) < 60 && Math.abs(b.z - v.z) < 60));
  kept.push({ ...SCREEN_WALL, color: '#1c2530', venue: 'cinema' });
  return kept;
}

// ---- The cinema timetable
// The programme is the site's shows and movies (supabase/cinema.sql, folders shows/ and movies/), alternating a show
// and a movie, looping all day, with a short intermission between films. Times are world-clock seconds.
export const INTERMISSION = 20;
export function programmeOf(shows = [], movies = []) {
  const list = [], n = Math.max(shows.length, movies.length);
  for (let i = 0; i < n; i++) { if (shows[i]) list.push({ ...shows[i], kind: 'show' }); if (movies[i]) list.push({ ...movies[i], kind: 'movie' }); }
  return list.filter(item => Number.isFinite(item.duration) && item.duration > 1);
}
// What is on at world time `t`: the film and how far into it, or the intermission before the next one.
export function nowShowing(programme, t) {
  if (!programme.length) return null;
  const cycle = programme.reduce((sum, item) => sum + item.duration + INTERMISSION, 0);
  let offset = ((t % cycle) + cycle) % cycle;
  for (let i = 0; i < programme.length; i++) {
    const item = programme[i], next = programme[(i + 1) % programme.length];
    if (offset < INTERMISSION) return { intermission: true, item, index: i, offset: 0, startsIn: INTERMISSION - offset, next: item };
    offset -= INTERMISSION;
    if (offset < item.duration) return { intermission: false, item, index: i, offset, left: item.duration - offset, next };
    offset -= item.duration;
  }
  return null;
}
// How loud the cinema is where you stand: full in the seats, fading out by 90 m from the screen.
export function cinemaVolume(pos) {
  const d = Math.hypot(pos.x - SCREEN.x, pos.z - (SCREEN.z + 30));
  return Math.max(0, Math.min(1, 1 - (d - 30) / 60));
}
