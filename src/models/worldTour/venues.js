// A place to hang out in every city, on a whole city block by the City Hub (its four buildings make way): the Lounge,
// a deck with a dance floor, a DJ booth, a bar and sofas. Your music plays while you are there.
// Sit on any sofa (E); move to get up. Local coordinates are metres from the block's centre.
export const LOUNGE = Object.freeze({ id: 'lounge', name: 'Skyline Lounge', x: -60, z: 60, half: 42 });
export const VENUES = Object.freeze([LOUNGE]);
// Seats: where you sit and which way you face (toward the dance floor).
const at = (venue, x, z, heading) => ({ venue: venue.id, x: venue.x + x, z: venue.z + z, heading });
export const SEATS = Object.freeze({
  lounge: Object.freeze([
    ...[-10, -4, 4, 10].flatMap(z => [-0.9, 0.9].map(d => at(LOUNGE, 17, z + d, -Math.PI / 2))), // east sofas face west
    ...[-8, 0, 8].flatMap(x => [-0.9, 0.9].map(d => at(LOUNGE, x + d, 17, Math.PI))),            // south sofas face north
  ]),
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
    if (d < reach && !taken.has(`${seat.x},${seat.z}`) && (!best || d < best.d)) best = { ...seat, d };
  }
  return best;
}
// The venue blocks replace the city buildings on their block.
export function venueBlocks(blocks) {
  return blocks.filter(b => !VENUES.some(v => Math.abs(b.x - v.x) < 60 && Math.abs(b.z - v.z) < 60));
}
