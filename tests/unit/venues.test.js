import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMA, INTERMISSION, LOUNGE, SCREEN, SEATS, cinemaVolume, nowShowing, programmeOf, seatNear, venueAt } from '../../src/models/worldTour/venues.js';
import { buildReels, titleFromFile } from '../../src/models/worldTour/cinema.js';
import { CITIES, attack, createSession, generateBlocks, interact, promptFor, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { cleanState, encodeState } from '../../src/models/worldTour/multiplayer.js';
import { ambientGroups } from '../../src/models/worldTour/ambientLife.js';
import { islandFor } from '../../src/models/worldTour/worldIsland.js';

const miami = CITIES.find(c => c.id === 'miami');

test('every city has a lounge and an open-air cinema on a block of their own by the City Hub', () => {
  for (const city of CITIES) {
    const blocks = generateBlocks(city);
    for (const venue of [LOUNGE, CINEMA]) assert.ok(!blocks.some(b => !b.venue && Math.abs(b.x - venue.x) < 60 && Math.abs(b.z - venue.z) < 60), `${city.id}: the ${venue.id} block is clear`);
    assert.equal(blocks.filter(b => b.venue === 'cinema').length, 1, 'the screen wall is solid');
    assert.ok(blocks.some(b => b.hub) && blocks.island, 'the City Hub stays');
  }
  assert.equal(venueAt(LOUNGE.x, LOUNGE.z + 20), 'lounge'); assert.equal(venueAt(CINEMA.x + 10, CINEMA.z), 'cinema'); assert.equal(venueAt(8, 12), null);
  assert.ok(SEATS.lounge.length >= 12 && SEATS.cinema.filter(s => !s.npc).length >= 60, 'plenty of seats');
});

test('sit on a sofa or a cinema seat with E, facing the dance floor or the screen; move to get up', () => {
  const s = createSession(miami); s.traffic = []; s.pedestrians = []; s.policeCars = [];
  const sofa = SEATS.lounge[0]; s.player = { ...s.player, x: sofa.x + 0.8, z: sofa.z };
  assert.equal(promptFor(s).text, 'Sit on the sofa');
  interact(s); assert.ok(s.seated && s.player.seated); assert.equal(s.player.heading, sofa.heading);
  for (let i = 0; i < 20; i++) stepWorld(s, {}, 0.05);
  assert.ok(Math.hypot(s.player.x - sofa.x, s.player.z - sofa.z) < 0.3, 'stays seated'); assert.equal(s.venue, 'lounge');
  s.cooldown = 0; const ammo = s.mags.pistol; attack(s); assert.equal(s.mags.pistol, ammo, 'no shooting from the sofa');
  assert.equal(promptFor(s).text, 'Get up');
  stepWorld(s, { forward: true }, 0.05); assert.equal(s.seated, null, 'moving gets you up'); assert.equal(s.player.seated, false);
  // The cinema: the regulars' seats are taken; so are seats other players are sitting in.
  const regular = SEATS.cinema.find(seat => seat.npc), free = SEATS.cinema.find(seat => !seat.npc);
  assert.equal(seatNear(regular, new Set(), 0.5), null);
  assert.equal(seatNear(free, new Set([`${free.x},${free.z}`]), 0.5), null);
  s.player = { ...s.player, x: free.x, z: free.z + 0.5 }; assert.equal(promptFor(s).text, 'Take a seat'); interact(s);
  assert.equal(s.seated.venue, 'cinema'); assert.equal(s.player.heading, Math.PI, 'facing the screen');
  assert.equal(cleanState(encodeState(s, 1000)).si, true, 'other players see you sitting');
  interact(s); assert.equal(s.seated, null, 'E gets you up too');
  s.heat = 2; s.player = { ...s.player, x: free.x, z: free.z + 0.5 }; assert.equal(promptFor(s), null, 'no sitting down while wanted');
});

test('the cinema alternates shows and movies on the shared clock, with intermissions', () => {
  const programme = programmeOf([{ title: 'Pilot', duration: 600 }, { title: 'Finale', duration: 900 }], [{ title: 'The Big Race', duration: 5400 }]);
  assert.deepEqual(programme.map(p => `${p.kind}:${p.title}`), ['show:Pilot', 'movie:The Big Race', 'show:Finale']);
  assert.equal(programmeOf([{ title: 'Broken', duration: NaN }], []).length, 0, 'files without a length are skipped');
  const cycle = 600 + 5400 + 900 + 3 * INTERMISSION;
  assert.equal(nowShowing(programme, 0).intermission, true); assert.equal(nowShowing(programme, 0).item.title, 'Pilot');
  const pilot = nowShowing(programme, INTERMISSION + 100);
  assert.equal(pilot.item.title, 'Pilot'); assert.equal(pilot.offset, 100); assert.equal(pilot.left, 500); assert.equal(pilot.next.title, 'The Big Race');
  assert.equal(nowShowing(programme, INTERMISSION * 2 + 600 + 60).item.title, 'The Big Race');
  assert.deepEqual(nowShowing(programme, 12345), nowShowing(programme, 12345 + cycle * 7), 'loops all day, the same for everyone');
  assert.equal(nowShowing([], 10), null);
  assert.ok(cinemaVolume({ x: SCREEN.x, z: SCREEN.z + 30 }) === 1 && cinemaVolume({ x: SCREEN.x + 200, z: SCREEN.z }) === 0);
});

test('films come from the cinema bucket: shows/ and movies/, titled from their file names', () => {
  const reels = buildReels({ '': [{ name: 'Top Movie.mp4' }, { name: 'notes.txt' }], shows: [{ name: '02 - Second.mp4' }, { name: '01 - First_Episode.webm' }], movies: [{ name: '../evil.mp4' }, { name: 'The Big Race.mov' }] }, path => `https://x/${path}`);
  assert.deepEqual(reels.shows.map(r => r.title), ['First Episode', 'Second']);
  assert.deepEqual(reels.movies.map(r => r.title), ['The Big Race', 'Top Movie']);
  assert.equal(reels.movies[0].url, 'https://x/movies/The Big Race.mov');
  assert.equal(titleFromFile('03. Night_Drive.mp4'), 'Night Drive');
});

test('the lounge has dancers (a bigger crowd at night) and a bar; the cinema has its regulars', () => {
  const groups = ambientGroups(islandFor('miami'), generateBlocks(miami), 3);
  const day = groups.find(g => g.id === 'lounge-day'), night = groups.find(g => g.id === 'lounge-night');
  assert.ok(night.members.length > day.members.length && day.members.every(m => m.pose === 'dance' && venueAt(m.x, m.z) === 'lounge'));
  const regulars = groups.find(g => g.id === 'cinema-regulars');
  assert.ok(regulars.members.length > 10 && regulars.members.every(m => m.pose === 'sit' && m.heading === Math.PI));
});
