// The wanted level: 0 to 5 stars. Attacking people brings the police, and killing people raises the level quickly:
//   ★      officers try to arrest you on foot
//   ★★     officers open fire
//   ★★★    more patrol cars join the pursuit
//   ★★★★   a police helicopter hunts you from the air
//   ★★★★★  every unit, and two helicopters with marksmen
// The pursuit only ends when you are busted, wasted, or get away: out of sight of every unit (cars, officers and the
// helicopters) for a while once they have started looking, longer at higher levels. Then the stars fade to zero, the
// units go home and the city calms.
export const MAX_STARS = 5;
// Kills (of bystanders or officers) while wanted, and the level they bring at least.
export const KILL_STARS = Object.freeze([[1, 2], [3, 3], [6, 4], [10, 5]]);
export const starsOf = heat => Math.max(0, Math.min(MAX_STARS, Math.ceil(heat - 1e-6)));
export const starsForKills = kills => KILL_STARS.reduce((best, [n, stars]) => kills >= n ? stars : best, 0);
// Seconds out of sight (and not attacking) before the stars start to fade: 9 s at one star, 21 s at five.
export const escapeTime = heat => 6 + 3 * starsOf(heat);
export const FADE_RATE = 0.35; // stars per second once you have got away
export const unitsFor = heat => Math.min(MAX_STARS, starsOf(heat));
export const helicoptersFor = heat => starsOf(heat) >= 5 ? 2 : starsOf(heat) >= 4 ? 1 : 0;
const ANNOUNCE = { 2: 'Wanted ★★: officers will open fire.', 3: 'Wanted ★★★: more units are joining the pursuit.', 4: 'Wanted ★★★★: a police helicopter is on its way.', 5: 'Wanted ★★★★★: every unit and two helicopters are hunting you.' };
// Raise the wanted level (never above five stars); returns the announcement for a new level, if any.
export function raiseHeat(s, heat) {
  const before = starsOf(s.heat);
  s.heat = Math.min(MAX_STARS, Math.max(s.heat, heat)); s.quiet = 0;
  const after = starsOf(s.heat);
  return after > before && after >= 2 ? ANNOUNCE[after] : null;
}
// A bystander or officer was killed: count it, and let the count raise the level.
export function recordKill(s) {
  s.kills = (s.kills || 0) + 1;
  return raiseHeat(s, Math.max(s.heat, 1, starsForKills(s.kills)));
}
