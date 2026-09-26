// Weapons: your fists, the pistol everyone starts with, and the guns sold at the gun shop in Miami. Every player owns
// the pistol; bought guns are saved with the rest of your progress. Damage here is against the city's people (police,
// gangs, bystanders); damage to the world boss is set per gun by its server (bossRules.js KAIJU_DAMAGE), whatever the
// browser claims.
//   damage: at close range, falling to `falloff` of that at full range · cooldown: seconds between attacks
//   magazine / reload: rounds per magazine and seconds to reload (spare ammunition is unlimited)
//   auto: keeps firing while J is held · assist: how far off your aim (radians) the lock-on still finds a target
//   alarm: how far away people and the police hear it · reach: how far away it can hit the kaiju
//   pellets: shotgun pellets (the spread you see) · blast: splash radius (m) of an explosive round
export const WEAPONS = Object.freeze({
  fists: { id: 'fists', name: 'Fists', slot: 1, gun: false, range: 5, cooldown: 0.45, damage: 34, assist: 0.9, alarm: 25, reach: 32 },
  pistol: { id: 'pistol', name: 'Pistol', slot: 2, gun: true, price: 0, range: 65, cooldown: 0.3, damage: 40, falloff: 0.6, magazine: 15, reload: 1.3, assist: 0.9, alarm: 70, recoil: 0.4, reach: 170,
    blurb: 'A reliable semi-automatic sidearm. Everyone starts with one.' },
  revolver: { id: 'revolver', name: 'Magnum revolver', slot: 3, gun: true, price: 6500, range: 80, cooldown: 0.55, damage: 75, falloff: 0.7, magazine: 6, reload: 2, assist: 0.8, alarm: 85, recoil: 0.9, reach: 170,
    blurb: 'Six heavy rounds. Slow, loud, and it drops most people in one shot.' },
  smg: { id: 'smg', name: 'SMG', slot: 4, gun: true, price: 12000, range: 50, cooldown: 0.09, damage: 16, falloff: 0.5, magazine: 40, reload: 1.8, assist: 1, alarm: 80, auto: true, recoil: 0.18, reach: 170,
    blurb: 'Compact and fully automatic. Hold J to spray at close range.' },
  shotgun: { id: 'shotgun', name: 'Shotgun', slot: 5, gun: true, price: 16000, range: 32, cooldown: 0.85, damage: 95, falloff: 0.25, magazine: 8, reload: 2.4, assist: 1.25, alarm: 90, recoil: 0.9, pellets: 6, reach: 70,
    blurb: 'Pump-action. Devastating up close, weak at range, and forgiving to aim. Get close to the kaiju to use it.' },
  rifle: { id: 'rifle', name: 'Assault rifle', slot: 6, gun: true, price: 24000, range: 110, cooldown: 0.16, damage: 30, falloff: 0.75, magazine: 30, reload: 2.1, assist: 0.75, alarm: 100, auto: true, recoil: 0.3, reach: 170,
    blurb: 'Long range and automatic. The best all-rounder.' },
  lmg: { id: 'lmg', name: 'Light machine gun', slot: 7, gun: true, price: 38000, range: 95, cooldown: 0.11, damage: 26, falloff: 0.7, magazine: 100, reload: 4.5, assist: 0.8, alarm: 110, auto: true, recoil: 0.35, reach: 170,
    blurb: 'A 100-round belt. Lay down fire for a long time, then a long reload.' },
  sniper: { id: 'sniper', name: 'Sniper rifle', slot: 8, gun: true, price: 52000, range: 200, cooldown: 1.4, damage: 150, falloff: 1, magazine: 5, reload: 2.8, assist: 0.35, alarm: 120, recoil: 1, reach: 210,
    blurb: 'Bolt-action. One shot, one takedown, and the only gun that hits the kaiju from 200 m.' },
  rocket: { id: 'rocket', name: 'Rocket launcher', slot: 9, gun: true, price: 75000, range: 120, cooldown: 1.2, damage: 220, falloff: 1, magazine: 4, reload: 3.2, assist: 0.6, alarm: 160, recoil: 1.2, blast: 5, reach: 170,
    blurb: 'Four rockets that blow up where they land. The heaviest hitter against the kaiju.' },
});
// Weapon ids in the order other players' games know them (multiplayer sends the index), so new guns are appended.
export const WEAPON_ORDER = Object.freeze(['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'revolver', 'lmg', 'sniper', 'rocket']);
// The shop's guns, cheapest first; this is also the inventory order (slot keys 2–9).
export const SHOP_WEAPONS = Object.freeze(['pistol', 'revolver', 'smg', 'shotgun', 'rifle', 'lmg', 'sniper', 'rocket']);
export const weaponForSlot = n => Object.values(WEAPONS).find(w => w.slot === n)?.id || null;
// The gun shop: one store in the world, in Miami, in the block across the avenue from the City Hub. `block` is the
// building it occupies; you shop at its door on the avenue.
export const GUN_SHOP = Object.freeze({ city: 'miami', name: 'Ocean Drive Arms', block: { x: 83, z: -37 }, door: { x: 83, z: -14 } });
export const atGunShop = (city, at) => city === GUN_SHOP.city && Math.hypot(at.x - GUN_SHOP.door.x, at.z - GUN_SHOP.door.z) < 9;

export const weaponOf = id => WEAPONS[id] || WEAPONS.pistol;
export const isGun = id => !!WEAPONS[id]?.gun;
// Owned guns from a save: known ids only, in shop order, and always the pistol.
export function cleanOwned(value) {
  const list = Array.isArray(value) ? value : [];
  return SHOP_WEAPONS.filter(id => id === 'pistol' || list.includes(id));
}
export function fullMagazines(owned = ['pistol']) { return Object.fromEntries(cleanOwned(owned).map(id => [id, WEAPONS[id].magazine])); }
// Damage to a person at distance `d`: full up close, easing to `falloff` of it at full range.
export function damageAt(weapon, d) {
  const w = weaponOf(weapon);
  if (!w.gun) return w.damage;
  const t = Math.max(0, Math.min(1, (d - w.range * 0.4) / (w.range * 0.6)));
  return Math.round(w.damage * (1 - t * (1 - w.falloff)));
}
// The weapons you can switch between, in slot order: fists and every gun you own.
export const inventory = owned => ['fists', ...cleanOwned(owned)];
export function nextWeapon(current, owned, step = 1) {
  const list = inventory(owned), i = list.indexOf(current);
  return list[((i < 0 ? 0 : i) + step + list.length) % list.length];
}
// Buying a gun: enough cash, not already owned, and standing in the shop.
export function buyWeapon(state, id) {
  const w = WEAPONS[id];
  if (!w?.gun || !SHOP_WEAPONS.includes(id)) return { ok: false, reason: 'Not for sale.' };
  if (state.owned.includes(id)) return { ok: false, reason: 'You already own it.' };
  if (state.cash < w.price) return { ok: false, reason: `You need $${(w.price - state.cash).toLocaleString()} more.` };
  state.cash -= w.price; state.owned = cleanOwned([...state.owned, id]); state.mags[id] = w.magazine;
  return { ok: true };
}
