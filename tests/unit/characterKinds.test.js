import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_OPTIONS, KINDS, cleanCharacter, playerLook, randomCharacter, skinOptions } from '../../src/models/worldTour/characterProfile.js';
import { CITIES, attack, createSession, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { cleanProfile, encodeProfile } from '../../src/models/worldTour/multiplayer.js';

test('four kinds of character, each with its own colours; old saves stay human', () => {
  assert.deepEqual(CHARACTER_OPTIONS.kind.map(([id]) => id), ['human', 'wolf', 'brute', 'robot']);
  assert.equal(cleanCharacter({ skin: '#9a6644' }).kind, 'human', 'saves from before kinds existed');
  assert.equal(cleanCharacter({ kind: 'dragon', skin: '#9a6644' }).kind, 'human', 'unknown kinds are refused');
  const wolf = cleanCharacter({ kind: 'wolf', skin: '#9a6644' });
  assert.ok(skinOptions('wolf').some(([id]) => id === wolf.skin), 'a human skin tone is swapped for fur');
  assert.equal(cleanCharacter({ kind: 'robot', skin: '#b8bec6' }).skin, '#b8bec6');
  for (let i = 0; i < 40; i++) {
    const c = randomCharacter(Math.random);
    assert.ok(skinOptions(c.kind).some(([id]) => id === c.skin), `random ${c.kind} uses its own colours`);
  }
  for (const [id, kind] of Object.entries(KINDS)) assert.ok(kind.perk && kind.skin.length >= 5, id);
});

test('each kind plays a little differently', () => {
  assert.ok(playerLook({ kind: 'brute' }).scale > 1.15, 'the brute is bigger');
  assert.equal(playerLook({ kind: 'human', build: 'tall' }).scale, 1.07);
  // Brute punches harder.
  const punch = kind => {
    const s = createSession(CITIES[0], {}, { kind }); s.blocks = []; s.pedestrians = []; s.weapon = 'fists';
    s.enemies = [{ id: 'g', kind: 'gang', x: 8, z: 14, health: 200, cooldown: 9 }]; attack(s); return 200 - s.enemies[0].health;
  };
  assert.ok(punch('brute') > punch('human') * 1.3);
  // Robot armour takes less from the same hazards; wolves sprint faster.
  const shotBy = kind => {
    const s = createSession(CITIES[0], {}, { kind }); s.blocks = []; s.pedestrians = []; s.traffic = []; s.policeCars = [];
    s.enemies = [{ id: 'g', kind: 'gang', x: 8, z: 16, health: 100, cooldown: 0 }];
    stepWorld(s, {}, 0.02); return 100 - s.health;
  };
  const human = shotBy('human'), robot = shotBy('robot');
  assert.ok(human > 0, 'the gang member hits at point-blank range'); assert.ok(robot < human, 'plating absorbs part of a hit');
  assert.ok(playerLook({ kind: 'wolf' }).speed > 1);
});

test('other players see your kind and size', () => {
  const profile = cleanProfile(JSON.parse(JSON.stringify(encodeProfile({ name: 'Rex', kind: 'wolf', skin: '#8d8f93' }, 'miami'))));
  assert.equal(profile.look.kind, 'wolf'); assert.equal(profile.look.skin, '#8d8f93');
  assert.equal(cleanProfile({ v: 1, name: 'X', look: { kind: 'brute' }, city: 'miami' }).scale, playerLook({ kind: 'brute' }).scale);
});
