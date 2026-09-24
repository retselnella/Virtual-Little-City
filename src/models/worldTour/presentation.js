export function policeStatus(s) {
  if (s.arrest > 0) return ['Officer making an arrest', 'Run or fight back to resist. Standing still gets you busted.'];
  if (s.policeCars.some(c => c.state === 'onscene')) return ['Officers on scene', s.heat <= 1 ? 'One star: officers try to arrest you on foot.' : 'Two stars or more: officers open fire.'];
  if (s.policeCars.some(c => c.state === 'regroup')) return ['Officers returning to their car', 'They will resume the pursuit by road.'];
  if (s.policeCars.some(c => c.chasing)) return ['Patrol car in pursuit', 'Break line of sight to lose the pursuit.'];
  if (s.policeCars.some(c => c.state === 'responding')) return s.unseen > 4 ? ['Searching your last known location', 'Stay out of sight for 8 seconds and do not attack.'] : ['Patrol cars en route', 'Break line of sight to lose the pursuit.'];
  return ['Dispatching patrol', 'Break line of sight to lose the pursuit.'];
}
export function snapshot(s) { return { ...s, player: { ...s.player }, car: { ...s.car }, boat: { ...s.boat }, train: { ...s.train }, course: s.course && { ...s.course }, metro: s.metro && { ...s.metro }, waypoint: s.waypoint && { ...s.waypoint }, mission: s.mission && { ...s.mission }, enemies: s.enemies.map(e => ({ ...e })), policeCars: s.policeCars.map(c => ({ ...c })) }; }

