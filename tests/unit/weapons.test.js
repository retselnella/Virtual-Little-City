import test from 'node:test';
import assert from 'node:assert/strict';
import { GUN_SHOP, SHOP_WEAPONS, WEAPONS, WEAPON_ORDER, atGunShop, buyWeapon, cleanOwned, damageAt, inventory, nextWeapon, weaponForSlot } from '../../src/models/worldTour/weapons.js';
import { KAIJU_DAMAGE, kaijuDps } from '../../src/models/worldTour/bossRules.js';
import { GUN_INFO } from '../../src/scenes/shared/guns.js';
import { CITIES, attack, cleanWorldSave, createSession, equip, generateBlocks, freePosition, interact, promptFor, startReload, stepWorld, targetFor } from '../../src/models/worldTour/worldAdventure.js';
import { cleanState, encodeState } from '../../src/models/worldTour/multiplayer.js';

const miami = CITIES.find(c => c.id === 'miami'), tokyo = CITIES.find(c => c.id === 'tokyo');

test('the gun shop is one store, in Miami, with its door on an open street', () => {
  const blocks = generateBlocks(miami);
  assert.equal(blocks.filter(b => b.shop).length, 1);
  assert.equal(generateBlocks(tokyo).some(b => b.shop), false, 'no other city has one');
  assert.ok(freePosition(GUN_SHOP.door.x, GUN_SHOP.door.z, blocks, 1), 'you can stand at the door');
  assert.equal(atGunShop('miami', GUN_SHOP.door), true); assert.equal(atGunShop('tokyo', GUN_SHOP.door), false);
});

test('buying checks cash and ownership, and bought guns are saved', () => {
  const s = createSession(miami, { cash: 13000 });
  assert.deepEqual(s.owned, ['pistol']);
  assert.equal(buyWeapon(s, 'rifle').ok, false, 'not enough cash'); assert.equal(s.cash, 13000);
  assert.equal(buyWeapon(s, 'bazooka').ok, false); assert.equal(buyWeapon(s, 'fists').ok, false);
  assert.equal(buyWeapon(s, 'smg').ok, true); assert.equal(s.cash, 1000); assert.deepEqual(s.owned, ['pistol', 'smg']);
  assert.equal(buyWeapon(s, 'smg').ok, false, 'no buying twice'); assert.equal(s.cash, 1000);
  assert.equal(s.mags.smg, WEAPONS.smg.magazine);
  const saved = cleanWorldSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(saved.owned, ['pistol', 'smg']);
  const later = createSession(tokyo, saved);
  assert.deepEqual(later.owned, ['pistol', 'smg'], 'your guns come with you to every city');
  assert.deepEqual(cleanOwned(['rifle', 'rifle', 'nuke', 7]), ['pistol', 'rifle']);
});

test('the shop door opens the counter, but not while you are wanted', () => {
  const s = createSession(miami); s.player.x = GUN_SHOP.door.x; s.player.z = GUN_SHOP.door.z;
  assert.match(promptFor(s).text, /Ocean Drive Arms/);
  interact(s); assert.equal(s.shopping, true);
  s.shopping = false; s.heat = 1; interact(s); assert.equal(s.shopping, false);
});

test('the inventory switches between fists and owned guns, each with its own magazine', () => {
  const s = createSession(miami, { owned: ['pistol', 'shotgun'] });
  assert.deepEqual(inventory(s.owned), ['fists', 'pistol', 'shotgun']);
  assert.equal(nextWeapon('pistol', s.owned), 'shotgun'); assert.equal(nextWeapon('shotgun', s.owned), 'fists'); assert.equal(nextWeapon('fists', s.owned, -1), 'shotgun');
  assert.equal(equip(s, 'rifle'), false, 'guns you do not own stay locked'); assert.equal(s.weapon, 'pistol');
  s.blocks = []; s.pedestrians = []; s.enemies = [{ id: 'g', kind: 'gang', x: 8, z: 20, health: 500, cooldown: 9 }];
  attack(s); assert.equal(s.mags.pistol, 14);
  assert.equal(equip(s, 'shotgun'), true); s.cooldown = 0; attack(s);
  assert.equal(s.mags.shotgun, 7); assert.equal(s.mags.pistol, 14, 'magazines are per gun');
  s.mags.shotgun = 0; s.cooldown = 0; attack(s); assert.equal(s.reload, WEAPONS.shotgun.reload, 'an empty gun reloads with its own reload time');
  equip(s, 'pistol'); assert.equal(s.reload, 0, 'switching cancels the reload');
  equip(s, 'shotgun'); startReload(s); for (let i = 0; i < 50; i++) stepWorld(s, {}, 0.05);
  assert.equal(s.mags.shotgun, WEAPONS.shotgun.magazine);
});

test('each gun behaves differently: shotgun up close, rifle at range, SMG fires fastest', () => {
  assert.ok(damageAt('shotgun', 3) > damageAt('pistol', 3) * 2, 'the shotgun hits hardest up close');
  assert.ok(damageAt('shotgun', 30) < damageAt('shotgun', 3) / 2, 'and falls off quickly');
  assert.ok(WEAPONS.rifle.range > WEAPONS.pistol.range && WEAPONS.smg.cooldown < WEAPONS.pistol.cooldown);
  const s = createSession(miami, { owned: ['rifle'] }); s.blocks = []; s.pedestrians = [];
  s.enemies = [{ id: 'far', kind: 'gang', x: 8, z: 12 - 90, health: 100, cooldown: 9 }]; s.aimYaw = Math.PI;
  assert.equal(targetFor(s), null, 'out of pistol range');
  equip(s, 'rifle'); assert.equal(targetFor(s)?.id, 'far', 'the rifle reaches it');
});

test('other players see which gun you are holding; unknown values are ignored', () => {
  const s = createSession(miami, { owned: ['rifle'] }); equip(s, 'rifle');
  const sent = encodeState(s, 1000);
  assert.equal(cleanState(sent).w, 'rifle');
  equip(s, 'fists'); assert.equal(cleanState(encodeState(s, 1000)).w, null);
  assert.equal(cleanState({ ...sent, w: 99 }).w, null); assert.equal(cleanState({ ...sent, w: 'rifle' }).w, null);
  assert.equal(cleanState({ ...sent, w: 1 }).w, 'pistol', 'older clients sending 1 still show a pistol');
});

test('the shop sells eight guns, dearer the better, each with its own model and number key', () => {
  assert.deepEqual(SHOP_WEAPONS, ['pistol', 'revolver', 'smg', 'shotgun', 'rifle', 'lmg', 'sniper', 'rocket']);
  for (let i = 1; i < SHOP_WEAPONS.length; i++) assert.ok(WEAPONS[SHOP_WEAPONS[i]].price > WEAPONS[SHOP_WEAPONS[i - 1]].price, `${SHOP_WEAPONS[i]} costs more`);
  assert.ok(WEAPONS.rocket.price >= 50000 && WEAPONS.smg.price >= 10000, 'prices went up');
  for (const id of SHOP_WEAPONS) { assert.ok(GUN_INFO[id], `${id} has a model`); assert.ok(WEAPONS[id].blurb && WEAPONS[id].reach > 0); }
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => weaponForSlot(i + 1)), ['fists', ...SHOP_WEAPONS], 'keys 1–9');
  assert.deepEqual(WEAPON_ORDER.slice(0, 5), ['fists', 'pistol', 'smg', 'shotgun', 'rifle'], 'older players still read the first five');
  assert.deepEqual([...WEAPON_ORDER].sort(), Object.keys(WEAPONS).sort());
  const s = createSession(miami, { owned: ['rocket', 'revolver'] });
  assert.deepEqual(inventory(s.owned), ['fists', 'pistol', 'revolver', 'rocket']);
  assert.equal(cleanState(encodeState((equip(s, 'rocket'), s), 1000)).w, 'rocket');
});

test('kaiju damage is balanced: it rises with price, the best gun about twice the free pistol', () => {
  // The server charges each hit the fastest the weapon can keep firing: its cooldowns plus a share of one reload.
  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id], cycle = w.gun ? ((w.magazine - 1) * w.cooldown + w.reload) / w.magazine : w.cooldown;
    assert.equal(KAIJU_DAMAGE[id].costMs, Math.round(cycle * 1000), `${id} fire-time cost matches its cooldown and reload`);
  }
  const dps = SHOP_WEAPONS.map(kaijuDps);
  for (let i = 1; i < dps.length; i++) assert.ok(dps[i] > dps[i - 1], `${SHOP_WEAPONS[i]} out-damages ${SHOP_WEAPONS[i - 1]} (${dps[i]} vs ${dps[i - 1]})`);
  const ratio = kaijuDps('rocket') / kaijuDps('pistol');
  assert.ok(ratio > 1.8 && ratio < 2.3, `the best gun is about twice the pistol (${ratio.toFixed(2)})`);
  assert.ok(kaijuDps('fists') > kaijuDps('pistol') && kaijuDps('fists') < kaijuDps('smg'), 'fists reward the risk of standing under it, but no more than a bought gun');
  assert.ok(WEAPONS.shotgun.reach < 100 && WEAPONS.sniper.reach > 200 && WEAPONS.sniper.reach < 220, 'the shotgun needs you close; the sniper hits from farther, inside the server range');
});

test('the rocket launcher blows up where it lands', () => {
  const s = createSession(miami, { owned: ['rocket'] }); s.blocks = []; s.pedestrians = []; equip(s, 'rocket');
  s.enemies = [{ id: 'a', kind: 'gang', x: 8, z: 32, health: 300, cooldown: 9, heading: 0 }, { id: 'b', kind: 'gang', x: 10, z: 34, health: 100, cooldown: 9, heading: 0 }];
  s.aimYaw = 0; s.cooldown = 0; attack(s);
  assert.ok(s.enemies[0].health < 300, 'the direct hit'); assert.ok(s.enemies[1].health < 100, 'and the blast next to it');
  assert.ok(s.impacts.some(i => i.kind === 'blast')); assert.equal(s.mags.rocket, WEAPONS.rocket.magazine - 1);
});
