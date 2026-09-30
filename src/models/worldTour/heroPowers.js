import { kindOf } from './characterProfile.js';

export const HERO_POWERS = Object.freeze({
  smash: { name: 'Ground smash', cooldown: 5, duration: 0.65, color: '#9dff76' },
  flight: { name: 'Flight', cooldown: 0, duration: 0, color: '#8eeaff' },
  speed: { name: 'Speed burst', cooldown: 8, duration: 4, color: '#ffd34e' },
});
export const heroPower = s => HERO_POWERS[kindOf(s.appearance).power] || null;
export const canUsePower = s => !!heroPower(s) && !s.down && !s.driving && !s.boating && !s.riding && !s.seated && !(s.stun > 0) && !(s.player.knockdown > 0) && !s.player.ragdoll;

export function resetHeroPower(p) {
  p.powerActive = false; p.powerTime = 0; p.powerCooldown = 0; p.powerPulse = null; p.flying = false;
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
  p.powerCooldown = Math.max(0, (p.powerCooldown || 0) - dt);
  p.powerTime = Math.max(0, (p.powerTime || 0) - dt);
  if (!canUsePower(s) || (kindOf(s.appearance).power !== 'flight' && !p.powerTime)) p.powerActive = false;
  if (p.powerPulse && s.time - p.powerPulse.time > HERO_POWERS.smash.duration) p.powerPulse = null;
}

export function heroMovement(s) {
  const power = kindOf(s.appearance).power, active = !!s.player.powerActive;
  return { flight: active && power === 'flight', speed: active && power === 'speed' ? 2.5 : 1 };
}
