import { kindOf } from './characterProfile.js';
import { KAIJU_POWERS } from './bossRules.js';
import { blockHit, kaijuRise } from './aiming.js';
import { kaijuPose } from './worldBoss.js';

export const HERO_POWERS = Object.freeze({
  smash: { name: 'Ground smash', cooldown: KAIJU_POWERS.hulk.costMs / 1000, duration: 0.65, color: '#9dff76' },
  flight: { name: 'Flight', cooldown: 0, duration: 0, color: '#8eeaff' },
  speed: { name: 'Speed burst', cooldown: 8, duration: 4, color: '#ffd34e' },
});
export const heroPower = s => HERO_POWERS[kindOf(s.appearance).power] || null;
export const canUsePower = s => !!heroPower(s) && !s.down && !s.driving && !s.boating && !s.riding && !s.seated && !(s.stun > 0) && !(s.player.knockdown > 0) && !s.player.ragdoll;

export function resetHeroPower(p) {
  p.powerActive = false; p.powerTime = 0; p.powerCooldown = 0; p.powerPulse = null; p.kaijuPowerFx = null; p.flying = false;
}

// Returns the activated ability; worldAdventure applies combat through its existing damage rules.
export function activateHeroPower(s) {
  if (!canUsePower(s) || s.player.powerCooldown > 0) return null;
  const p = s.player, kind = kindOf(s.appearance).power, power = HERO_POWERS[kind];
  if (kind === 'smash' && !p.grounded && p.height > 0.12) return null;
  if (kind === 'flight') { p.powerActive = !p.powerActive; p.velocityY = 0; }
  else {
    p.powerActive = true; p.powerTime = power.duration; p.powerCooldown = power.cooldown;
    if (kind === 'smash') p.powerPulse = { x: p.x, z: p.z, y: p.height || 0, time: s.time };
  }
  return kind;
}

export function stepHeroPower(s, dt) {
  const p = s.player;
  s.heroAttackCooldown = Math.max(0, (s.heroAttackCooldown || 0) - dt);
  if (p.kaijuPowerFx && s.time - p.kaijuPowerFx.time > 0.65) p.kaijuPowerFx = null;
  p.powerCooldown = Math.max(0, (p.powerCooldown || 0) - dt);
  p.powerTime = Math.max(0, (p.powerTime || 0) - dt);
  if (!canUsePower(s) || (kindOf(s.appearance).power !== 'flight' && !p.powerTime)) p.powerActive = false;
  if (p.powerPulse && s.time - p.powerPulse.time > HERO_POWERS.smash.duration) p.powerPulse = null;
}

export function heroMovement(s) {
  const power = kindOf(s.appearance).power, active = !!s.player.powerActive;
  return { flight: active && power === 'flight', speed: active && power === 'speed' ? 2.5 : 1 };
}

export const kaijuPower = s => Object.hasOwn(KAIJU_POWERS, s.appearance?.kind) ? KAIJU_POWERS[s.appearance.kind] : null;
export function activeKaijuEvent(s) {
  const ev = s.bossEvent, now = (s.worldTime ?? s.time) * 1000;
  return !!ev && ev.city === s.city && ev.phase === 'active' && ev.hp > 0 && !ev.defeatedAt && now >= ev.startsAt && now < ev.endsAt;
}
// Aim at the closest side of the body. Ground powers need solid footing; beams work from flight and over low cover.
// This pure query is shared by the HUD and simulation; it never changes position or consumes a cooldown on a miss.
export function kaijuPowerTarget(s) {
  const power = kaijuPower(s), p = s.player;
  if (!power || !activeKaijuEvent(s) || !s.boss?.alive || !canUsePower(s)) return null;
  if (power.ground && ((!p.grounded && p.height > 0.12) || p.flying)) return null;
  const t = (s.worldTime ?? s.time) - s.bossEvent.startsAt / 1000, boss = kaijuPose(t);
  const dx = boss.x - p.x, dz = boss.z - p.z, flat = Math.hypot(dx, dz);
  const from = { x: p.x, y: (p.height || 0) + 2.2, z: p.z };
  const y = power.ground ? 8 : Math.max(8, Math.min(120 + kaijuRise(t), from.y));
  if (Math.hypot(flat, y - from.y) > power.reach || (power.ground && p.height > 4)) return null;
  const surface = Math.max(0, flat - 18) / (flat || 1), to = { x: p.x + dx * surface, y, z: p.z + dz * surface };
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
  const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
  if (blockHit(s.blocks, from, direction, length) !== null) return null;
  return { power, from, to, heading: Math.atan2(dx, dz) };
}
