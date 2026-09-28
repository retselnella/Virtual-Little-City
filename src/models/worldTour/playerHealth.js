export const HEALTH = Object.freeze({ base: 100, eventBonus: 500, regenDelay: 8, regenPerSecond: 5 });

// Use the same event window as the Kaiju simulation. A stale phase label must not extend the buff past the hour.
export function syncEventHealth(s) {
  const ev = s.bossEvent, now = (s.worldTime ?? s.time) * 1000;
  const event = ev && ev.city === s.city && ev.hp > 0 && ev.defeatedAt == null && now >= ev.startsAt && now < ev.endsAt ? ev.id : null;
  const changed = event !== (s.healthBuffEvent ?? null);
  s.maxHealth = HEALTH.base + (event ? HEALTH.eventBonus : 0);
  if (changed && event && s.health > 0 && !s.down) s.health += HEALTH.eventBonus;
  s.health = Math.min(s.health, s.maxHealth);
  s.healthBuffEvent = event;
  if (changed) markCombat(s);
}

export function markCombat(s) { s.regenQuiet = 0; s.regenerating = false; }

// All player damage paths reset the recovery delay, including crashes and self-inflicted rocket damage.
export function hurtPlayer(s, amount) {
  if (!(amount > 0) || s.down || s.health <= 0) return;
  s.health = Math.max(0, s.health - amount);
  markCombat(s);
}

export function regenerateHealth(s, dt, threatened = false) {
  if (s.down || s.health <= 0 || s.heat > 0 || s.healthBuffEvent || threatened) { markCombat(s); return; }
  const before = Math.min(HEALTH.regenDelay, s.regenQuiet || 0);
  s.regenQuiet = Math.min(HEALTH.regenDelay, before + dt);
  const elapsed = Math.max(0, dt - (HEALTH.regenDelay - before));
  s.regenerating = elapsed > 0 && s.health < (s.maxHealth || HEALTH.base);
  if (s.regenerating) s.health = Math.min(s.maxHealth || HEALTH.base, s.health + HEALTH.regenPerSecond * elapsed);
}
