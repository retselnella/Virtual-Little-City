// Weapons: your fists, the pistol everyone starts with, and the guns sold at the gun shop in Miami. Every player owns
// the pistol; bought guns are saved with the rest of your progress. Damage is against the city's people (police, gangs,
// bystanders); world boss damage is always decided by its server, whatever you fire.
//   damage: at close range, falling to `falloff` of that at full range · cooldown: seconds between attacks
//   magazine / reload: rounds per magazine and seconds to reload (spare ammunition is unlimited)
//   auto: keeps firing while J is held · assist: how far off your aim (radians) the lock-on still finds a target
//   alarm: how far away people and the police hear it
export const WEAPONS = Object.freeze({
  fists: { id: 'fists', name: 'Fists', slot: 1, gun: false, range: 5, cooldown: 0.45, damage: 34, assist: 0.9, alarm: 25 },
  pistol: { id: 'pistol', name: 'Pistol', slot: 2, gun: true, price: 0, range: 65, cooldown: 0.3, damage: 40, falloff: 0.6, magazine: 48, reload: 1.5, assist: 0.9, alarm: 70, recoil: 0.4,
    blurb: 'A reliable semi-automatic sidearm. Everyone starts with one.' },
  smg: { id: 'smg', name: 'SMG', slot: 3, gun: true, price: 1800, range: 50, cooldown: 0.09, damage: 16, falloff: 0.5, magazine: 40, reload: 1.8, assist: 1, alarm: 80, auto: true, recoil: 0.18,
    blurb: 'Compact and fully automatic. Hold J to spray at close range.' },
  shotgun: { id: 'shotgun', name: 'Shotgun', slot: 4, gun: true, price: 2800, range: 32, cooldown: 0.85, damage: 95, falloff: 0.25, magazine: 8, reload: 2.4, assist: 1.25, alarm: 90, recoil: 0.9, pellets: 6,
    blurb: 'Pump-action. Devastating up close, weak at range, and forgiving to aim.' },
  rifle: { id: 'rifle', name: 'Assault rifle', slot: 5, gun: true, price: 4500, range: 110, cooldown: 0.16, damage: 30, falloff: 0.75, magazine: 30, reload: 2.1, assist: 0.75, alarm: 100, auto: true, recoil: 0.3,
    blurb: 'Long range and automatic. The best all-rounder, and the most expensive.' },
});
export const WEAPON_ORDER = Object.freeze(['fists', 'pistol', 'smg', 'shotgun', 'rifle']);
export const SHOP_WEAPONS = Object.freeze(['pistol', 'smg', 'shotgun', 'rifle']);
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
