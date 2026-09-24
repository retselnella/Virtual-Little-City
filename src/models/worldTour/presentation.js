import { missionSteps } from './worldAdventure.js';
export function policeStatus(s) {
  if (s.arrest > 0) return ['Officer making an arrest', 'Run or fight back to resist. Standing still gets you busted.'];
  if (s.policeCars.some(c => c.state === 'onscene')) return ['Officers on scene', s.heat <= 1 ? 'One star: officers try to arrest you on foot.' : 'Two stars or more: officers open fire.'];
  if (s.policeCars.some(c => c.state === 'regroup')) return ['Officers returning to their car', 'They will resume the pursuit by road.'];
  if (s.policeCars.some(c => c.chasing)) return ['Patrol car in pursuit', 'Break line of sight to lose the pursuit.'];
  if (s.policeCars.some(c => c.state === 'responding')) return s.unseen > 4 ? ['Searching your last known location', 'Stay out of sight for 8 seconds and do not attack.'] : ['Patrol cars en route', 'Break line of sight to lose the pursuit.'];
  return ['Dispatching patrol', 'Break line of sight to lose the pursuit.'];
}
export function snapshot(s) { return { ...s, mags: { ...s.mags }, owned: [...s.owned], player: { ...s.player }, car: { ...s.car }, boat: { ...s.boat }, train: { ...s.train }, course: s.course && { ...s.course }, metro: s.metro && { ...s.metro }, waypoint: s.waypoint && { ...s.waypoint }, mission: s.mission && { ...s.mission }, enemies: s.enemies.map(e => ({ ...e })), policeCars: s.policeCars.map(c => ({ ...c })) }; }
// The objective line on the contract card.
export function missionTask(s, contract) {
  if (!contract) return 'The world is yours.';
  const m = s.mission, steps = missionSteps(s.city, contract.id), point = steps[m.stage];
  if (contract.id === 'race') return m.stage === 0 ? 'Drive to the first checkpoint' : `${point.label} · ${Math.max(0, Math.ceil(m.deadline - s.time))} s left`;
  if (contract.id === 'tour') return `Visit ${point.label} · ${m.stage + 1}/${steps.length}`;
  if (m.stage === 0 && contract.id === 'crew') return `Eliminate the crew · ${s.enemies.filter(e => e.kind === 'gang' && e.health <= 0).length}/4`;
  if (m.stage === 0 && contract.id === 'bounty') return 'Take down the gang boss';
  if (m.stage === 0) return 'Collect the marked package';
  return s.heat > 0 ? 'Lose the police' : contract.id === 'crew' || contract.id === 'bounty' ? 'Report to the City Hub' : 'Reach the drop-off';
}
