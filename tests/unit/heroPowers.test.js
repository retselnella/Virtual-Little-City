import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cleanCharacter, playerLook } from '../../src/models/worldTour/characterProfile.js';
import { CITIES, attack, createSession, equip, recover, setAppearance, stepWorld, useHeroPower, useKaijuPower } from '../../src/models/worldTour/worldAdventure.js';
import { BOSS_HP, KAIJU_POWERS } from '../../src/models/worldTour/bossRules.js';
import { kaijuPose } from '../../src/models/worldTour/worldBoss.js';
import { CITY_POWERS, FLASH_MOVEMENT, cityPowerTarget, guardMultiplier, kaijuPowerTarget, stepHeroPower } from '../../src/models/worldTour/heroPowers.js';
import { disposePhysics } from '../../src/models/worldTour/physicsEngine.js';
import { encodeProfile, cleanProfile, encodeState, cleanState, samplePlayer } from '../../src/models/worldTour/multiplayer.js';
import { createCharacter } from '../../src/scenes/shared/character.js';
import { createHeroEffects } from '../../src/scenes/worldTour/heroEffects.js';

function quiet(t, kind, blocks = []) {
  const s = createSession(CITIES[0], {}, cleanCharacter({ kind }));
  s.blocks = blocks; s.traffic = []; s.policeCars = []; s.pedestrians = []; s.car.x = 300;
  t.after(() => disposePhysics(s));
  return s;
}
function run(s, seconds, input = {}, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) stepWorld(s, input, dt, 0);
}

test('heroes keep their costumes, body scale and rig through save/network round trips', () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const kit = { box(size, color, position, parent) { const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(...size); mesh.position.set(...position); parent.add(mesh); return mesh; } };
  for (const kind of Object.keys(KAIJU_POWERS)) {
    const look = cleanCharacter({ kind });
    assert.equal(cleanCharacter(JSON.parse(JSON.stringify(look))).kind, kind);
    const remote = cleanProfile(encodeProfile(look, 'miami'));
    assert.equal(remote.look.kind, kind); assert.equal(remote.scale, playerLook(look).scale);
    const rig = createCharacter(new THREE.Group(), kit, { ...look, scale: remote.scale });
    const accessory = { thor: 'thunder-hammer', wonderwoman: 'golden-lasso', strange: 'arcane-amulet' }[kind];
    if (accessory) assert.ok(rig.avatar.getObjectByName(accessory), `${kind} has a distinct costume`);
    for (const side of ['left', 'right']) for (const part of ['shoulder', 'elbow', 'hand', 'hip', 'knee']) assert.ok(rig.avatar.getObjectByName(`${side}-${part}`));
    for (const flying of [false, true, false]) for (let i = 0; i < 100; i++) {
      rig.update({ x: 1, z: 2, height: flying ? 20 : 0, heading: i * 0.1, speed: 56, flying }, 1 / 60);
      rig.avatar.traverse(node => assert.ok([...node.position.toArray(), ...node.quaternion.toArray()].every(Number.isFinite)));
    }
  }
  geometry.dispose(); material.dispose();
});

test('Hulk smash has range, height and wall checks, cooldown, and real knockback', t => {
  const s = quiet(t, 'hulk', [{ x: 8, z: 15, width: 4, depth: 0.2, height: 15 }]);
  const enemy = (id, x, z, height = 0) => ({ id, x, z, height, kind: 'gang', health: 200 });
  s.enemies = [enemy('near', 11, 12), enemy('wall', 8, 17), enemy('far', 28, 12), enemy('above', 10, 12, 10)];
  assert.equal(useHeroPower(s), true);
  assert.ok(s.enemies[0].health < 200); assert.ok(s.enemies[0].kickX > 0); assert.ok(s.enemies[0].knockdown > 0);
  assert.deepEqual(s.enemies.slice(1).map(e => e.health), [200, 200, 200]);
  const health = s.enemies[0].health; assert.equal(useHeroPower(s), false); assert.equal(s.enemies[0].health, health);
  assert.deepEqual(s.bossHits, {}, 'no unvalidated boss damage');
  const jumper = quiet(t, 'hulk'); run(jumper, 0.4, { jump: true }); assert.ok(jumper.player.height > 4);
  assert.equal(useHeroPower(jumper), false, 'ground smash cannot be used in midair');
  run(jumper, 2); assert.ok(jumper.player.height < 0.12, 'super jump lands');
});

test('flight smoothly rises, settles to hover, respects the ceiling and lands', t => {
  for (const kind of ['superman', 'ironman', 'strange']) {
    const s = quiet(t, kind); assert.equal(useHeroPower(s), true);
    run(s, 1, { jump: true }); assert.ok(s.player.height > 15);
    run(s, 0.6); const hover = s.player.height; run(s, 0.5); assert.ok(Math.abs(s.player.height - hover) < 0.03);
    run(s, 10, { jump: true }); assert.ok(s.player.height <= 180.01);
    run(s, 9, { descend: true }); assert.ok(s.player.height < 0.12);
    run(s, 0.5, { jump: true }); assert.ok(s.player.height > 4);
    assert.equal(useHeroPower(s), true); run(s, 2); assert.ok(s.player.height < 0.12); assert.equal(s.player.flying, false);
  }
});

test('speed burst and flight cannot tunnel through a thin wall, even with stacked cheats', t => {
  for (const kind of Object.keys(KAIJU_POWERS)) {
    const s = quiet(t, kind, [{ x: 8, z: 25, width: 100, depth: 0.2, height: 220 }]);
    s.cheats.speed = true; useHeroPower(s);
    run(s, 2, { forward: true, run: true, jump: kind === 'superman' }, 0.05);
    assert.ok(s.player.z < 24.5, `${kind} stopped before wall: ${s.player.z}`);
    assert.ok(s.player.speed <= (kind === 'flash' ? FLASH_MOVEMENT.maxSpeed : 56) + 0.001);
    run(s, 0.75); assert.ok(s.player.speed < 0.02, 'releasing controls brakes smoothly');
  }
});

test('movement speed is consistent across diagonals, analog input and frame rates', t => {
  const straight = quiet(t, 'flash'), diagonal = quiet(t, 'flash'), analog = quiet(t, 'flash');
  for (const s of [straight, diagonal, analog]) useHeroPower(s);
  run(straight, 0.5, { forward: true, run: true }, 1 / 30);
  run(diagonal, 0.5, { forward: true, right: true, run: true }, 1 / 120);
  run(analog, 0.5, { stick: { x: 0, y: 0.5 }, run: true });
  assert.ok(Math.abs(straight.player.speed - diagonal.player.speed) < 0.02);
  assert.ok(Math.abs(analog.player.speed / straight.player.speed - 0.5) < 0.01);
  run(straight, 4); assert.equal(straight.player.powerActive, false); assert.ok(straight.player.powerCooldown > 0);
  assert.equal(useHeroPower(straight), false); run(straight, 4); assert.equal(useHeroPower(straight), true);
  const before = straight.time;
  for (const dt of [NaN, Infinity, -1, 0]) stepWorld(straight, {}, dt);
  assert.equal(straight.time, before);
  stepWorld(straight, { stick: { x: NaN, y: Infinity } }, 0.05);
  assert.ok([straight.player.x, straight.player.z, straight.player.height].every(Number.isFinite));
});

test('Flash has a faster sprint and burst, a bounded cheat stack, and smooth braking and expiry', t => {
  const s = quiet(t, 'flash');
  run(s, 1, { forward: true, run: true });
  assert.ok(Math.abs(s.player.speed - 36) < 0.01, 'normal sprint is 60% faster than the old 22.5');
  useHeroPower(s); run(s, 1, { forward: true, run: true });
  assert.ok(Math.abs(s.player.speed - 108) < 0.01, 'burst is nearly twice the old 56 cap');
  s.cheats.speed = true; run(s, 0.5, { forward: true, right: true, run: true });
  assert.ok(s.player.speed <= 108.001, 'cheats and diagonals cannot exceed the cap');
  const stopped = { x: s.player.x, z: s.player.z };
  run(s, 0.8);
  assert.ok(s.player.speed < 0.01);
  assert.ok(Math.hypot(s.player.x - stopped.x, s.player.z - stopped.z) < 10, 'braking travel stays bounded');
  s.cheats.speed = false; run(s, 2.5, { forward: true, run: true });
  assert.equal(s.player.powerActive, false);
  assert.ok(Math.abs(s.player.speed - 36) < 0.1, 'expiry returns to the normal sprint');
});

test('full-speed Flash cannot cross thin walls, corners or parked cars during long frames', t => {
  for (const diagonal of [false, true]) {
    const s = quiet(t, 'flash', [
      { x: 8, z: 130, width: 400, depth: 0.2, height: 30 },
      { x: -110, z: 12, width: 0.2, depth: 400, height: 30 },
    ]);
    s.cheats.speed = true; useHeroPower(s);
    run(s, 2.5, { forward: true, right: diagonal, run: true }, 0.05);
    assert.ok(s.player.z < 129.5 && s.player.x > -109.5, 'swept capsule stays outside the walls');
    const before = { x: s.player.x, z: s.player.z };
    stepWorld(s, { forward: true, right: diagonal, run: true }, 5, 0);
    assert.ok(Math.hypot(s.player.x - before.x, s.player.z - before.z) <= 5.41, 'a stalled frame never teleports the player');
    run(s, 0.5, { backward: true, run: true });
    assert.ok(s.player.z < before.z - 20, 'reversing gets away from the wall without sticking');
  }
  const car = quiet(t, 'flash'); Object.assign(car.car, { x: 8, z: 130 });
  useHeroPower(car); run(car, 2, { forward: true, run: true }, 0.05);
  assert.ok(car.player.z < car.car.z - 2, 'parked cars remain solid');
  assert.ok([car.player.x, car.player.z, car.player.height, car.player.speed].every(Number.isFinite));
});

test('Flash covers the same distance across frame rates and keeps his speed in shared-world snapshots', t => {
  const distances = [];
  for (const dt of [1 / 20, 1 / 30, 1 / 60, 1 / 120]) {
    const s = quiet(t, 'flash'); useHeroPower(s);
    run(s, 1, { forward: true, run: true }, dt);
    distances.push(s.player.z - 12);
    const state = cleanState(encodeState(s, 1000));
    assert.equal(state.s, 108, 'remote animation receives the full burst speed');
    const pose = samplePlayer({ snapshots: [{ ...state, at: 1000, z: 100 }, { ...state, at: 1100, z: 110.8 }] }, 1170);
    assert.ok(Math.abs(pose.z - 105.4) < 0.001, 'remote positions interpolate without snapping');
    assert.equal(pose.s, 108);
  }
  assert.ok(Math.min(...distances) > 95, 'the speed increase translates to actual travel');
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.1, 'travel does not depend on frame rate');
});

test('vehicles, stun, death, edits, recovery and city travel cannot leave powers stuck on', t => {
  for (const flag of ['driving', 'boating', 'riding', 'seated', 'down', 'stun']) {
    const s = quiet(t, 'superman'); s[flag] = true; assert.equal(useHeroPower(s), false, flag);
  }
  const s = quiet(t, 'superman'); useHeroPower(s); run(s, 0.2, { jump: true });
  s.stun = 1; run(s, 0.1); assert.equal(s.player.powerActive, false); assert.equal(s.player.flying, false);
  s.stun = 0; useHeroPower(s); setAppearance(s, cleanCharacter({ kind: 'human' }));
  assert.equal(s.player.powerActive, false); assert.equal(s.player.flying, false); assert.equal(useHeroPower(s), false);
  setAppearance(s, cleanCharacter({ kind: 'superman' })); useHeroPower(s); recover(s);
  assert.ok(!s.player.powerActive); assert.ok(!s.player.flying);
  useHeroPower(s); const travelled = createSession(CITIES[1], s, s.appearance);
  assert.equal(travelled.appearance.kind, 'superman'); assert.ok(!travelled.player.powerActive);
});

test('power effects use a bounded pool and dispose their GPU resources', t => {
  const parent = new THREE.Group(), effects = createHeroEffects(parent), s = quiet(t, 'flash');
  const group = parent.children[0]; assert.equal(group.children.length, 24);
  const pieces = [...group.children]; let geometryDisposed = false, materialDisposed = false;
  pieces[0].geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  pieces[0].material.addEventListener('dispose', () => { materialDisposed = true; });
  useHeroPower(s); s.player.speed = 40;
  for (let i = 0; i < 500; i++) { s.time += 0.016; effects.update(s); }
  assert.deepEqual(group.children, pieces); assert.equal(group.visible, true);
  s.driving = true; effects.update(s); assert.equal(group.visible, false);
  effects.dispose(); assert.equal(parent.children.length, 0); assert.ok(geometryDisposed && materialDisposed);
});

function eventFight(t, kind) {
  const s = quiet(t, kind);
  s.bossEvent = { id: 'boss-test', startsAt: 1000000, endsAt: 4600000, city: s.city, phase: 'active', hp: BOSS_HP, seed: 1 };
  s.worldTime = 1200; s.boss = { ...kaijuPose(200), t: 200, alive: true };
  Object.assign(s.player, { x: s.boss.x + (KAIJU_POWERS[kind]?.ground ? 35 : Math.min(100, KAIJU_POWERS[kind]?.reach * 0.7)), z: s.boss.z, grounded: true });
  return s;
}

test('every hero can strike a city hostile with bounded damage and shared recovery, without targeting bystanders', t => {
  for (const kind of Object.keys(KAIJU_POWERS)) {
    const s = quiet(t, kind), stats = CITY_POWERS[kind];
    const enemy = { id: 'gang', kind: 'gang', x: 8, z: 18, health: 250, heading: 0, cooldown: 100 };
    s.enemies = [enemy]; s.pedestrians = [{ id: 'bystander', kind: 'civilian', x: 8, z: 14, health: 100 }];
    assert.equal(cityPowerTarget(s)?.enemy, enemy);
    assert.equal(useKaijuPower(s), true, kind);
    assert.equal(enemy.health, 250 - stats.damage); assert.equal(s.pedestrians[0].health, 100);
    assert.deepEqual(s.bossHits, {}); assert.ok(s.player.kaijuPowerFx);
    assert.ok(Math.hypot(enemy.kickX, enemy.kickZ) <= 12.01, 'knockback stays bounded');
    assert.equal(useKaijuPower(s), false); const ammo = s.mags.pistol; attack(s); assert.equal(s.mags.pistol, ammo);
    setAppearance(s, cleanCharacter({ kind: kind === 'thor' ? 'hulk' : 'thor' })); assert.equal(useKaijuPower(s), false, 'editing cannot reset strike recovery');
    s.heroAttackCooldown = 0; s.cooldown = 0; enemy.child = true;
    assert.equal(cityPowerTarget(s), null); assert.equal(useKaijuPower(s), false, 'children are excluded even from malformed enemy lists');
  }
});

test('city powers reject blocked, distant, airborne-ground and incapacitated attacks without consuming recovery', t => {
  for (const change of [s => { s.blocks = [{ x: 8, z: 16, width: 10, depth: 0.2, height: 20 }]; },
    s => { s.enemies[0].z = 200; }, s => { s.player.height = 10; }, s => { s.down = 1; },
    s => { s.driving = true; }, s => { s.stun = 1; }, s => { s.player.knockdown = 1; }]) {
    const s = quiet(t, 'wonderwoman'); s.enemies = [{ id: 'gang', kind: 'gang', x: 8, z: 20, health: 200 }];
    change(s); assert.equal(useKaijuPower(s), false); assert.equal(s.heroAttackCooldown, 0); assert.equal(s.enemies[0].health, 200);
  }
});

test('Thor pulse obeys cover, spares children, shares attack recovery and can hit the Kaiju', t => {
  const s = quiet(t, 'thor', [{ x: 8, z: 16, width: 5, depth: 0.2, height: 20 }]);
  s.enemies = [
    { id: 'near', kind: 'gang', x: 12, z: 12, health: 200 },
    { id: 'wall', kind: 'gang', x: 8, z: 20, health: 200 },
    { id: 'kid', kind: 'gang', x: 8, z: 13, health: 100, child: true },
  ];
  assert.ok(useHeroPower(s)); assert.ok(s.enemies[0].health < 200);
  assert.equal(s.enemies[1].health, 200); assert.equal(s.enemies[2].health, 100);
  assert.equal(useKaijuPower(s), false); assert.equal(useHeroPower(s), false);
  const boss = eventFight(t, 'thor'); assert.ok(useHeroPower(boss)); assert.equal(boss.bossHits.thor_thunder, 1);
  const airborne = eventFight(t, 'thor'); airborne.player.height = 8; airborne.player.grounded = false;
  assert.equal(useHeroPower(airborne), false, 'the ground pulse requires solid footing');
  assert.ok(useKaijuPower(airborne), 'the ranged lightning strike works from the air');
});

test('Wonder Woman guard reduces real damage, expires, and cannot be refreshed through edits, recovery or travel', t => {
  const guarded = quiet(t, 'wonderwoman'), plain = quiet(t, 'wonderwoman');
  for (const s of [guarded, plain]) s.enemies = [{ id: 'gang', kind: 'gang', x: 8, z: 16, health: 200, cooldown: 0 }];
  assert.ok(useHeroPower(guarded)); assert.equal(guardMultiplier(guarded), 0.6);
  run(guarded, 0.05); run(plain, 0.05);
  assert.ok(plain.health < 100); assert.ok(Math.abs((100 - guarded.health) / (100 - plain.health) - 0.6) < 0.01);
  guarded.enemies = []; run(guarded, 5.1); assert.equal(guardMultiplier(guarded), 1); assert.equal(useHeroPower(guarded), false);
  setAppearance(guarded, cleanCharacter({ kind: 'thor' })); setAppearance(guarded, cleanCharacter({ kind: 'wonderwoman' }));
  assert.equal(useHeroPower(guarded), false); recover(guarded); assert.equal(useHeroPower(guarded), false);
  const travelled = createSession(CITIES[1], guarded, guarded.appearance);
  assert.equal(useHeroPower(travelled), false); assert.ok(travelled.heroGuardCooldown > 0);
  stepHeroPower(travelled, 5); assert.ok(useHeroPower(travelled));
  travelled.driving = true; assert.equal(guardMultiplier(travelled), 1);
});

test('each hero queues a distinct Kaiju hit, shows its effect and shares recovery with guns', t => {
  for (const [kind, spec] of Object.entries(KAIJU_POWERS)) {
    const s = eventFight(t, kind), mags = { ...s.mags };
    const before = { x: s.player.x, z: s.player.z, height: s.player.height };
    assert.equal(useKaijuPower(s), true, kind);
    assert.deepEqual(s.bossHits, { [spec.id]: 1 }); assert.deepEqual(s.mags, mags, 'no ammo consumed');
    assert.equal(s.heroAttackCooldown, spec.costMs / 1000); assert.equal(s.cooldown, spec.costMs / 1000);
    assert.ok(s.player.kaijuPowerFx); assert.equal(s.heat, 0); assert.equal(s.bossEvent.hp, BOSS_HP, 'only the server changes HP');
    assert.equal(useKaijuPower(s), false); equip(s, 'fists'); attack(s); assert.deepEqual(s.bossHits, { [spec.id]: 1 });
    assert.deepEqual({ x: s.player.x, z: s.player.z, height: s.player.height }, before, 'attacks do not teleport the player');
    stepHeroPower(s, spec.costMs / 1000); s.cooldown = 0;
    assert.equal(useKaijuPower(s), true, 'next strike after recovery'); assert.equal(s.bossHits[spec.id], 2);
  }
  const hulk = eventFight(t, 'hulk'); assert.equal(useHeroPower(hulk), true, 'G smash also hits boss');
  assert.equal(hulk.bossHits.hulk_smash, 1); assert.equal(useKaijuPower(hulk), false, 'G then H cannot double hit');
  for (const kind of ['superman', 'flash', 'ironman']) {
    const s = eventFight(t, kind); useHeroPower(s); assert.deepEqual(s.bossHits, {}, 'movement toggles do not deal damage');
  }
});

test('Kaiju powers require an active nearby event, clear sight and a living on-foot hero', t => {
  for (const change of [s => { s.bossEvent.phase = 'countdown'; }, s => { s.bossEvent.hp = 0; }, s => { s.bossEvent.defeatedAt = 1199000; },
    s => { s.worldTime = 900; }, s => { s.worldTime = 4600; }, s => { s.bossEvent.city = 'tokyo'; }, s => { s.boss = null; },
    s => { s.player.x += 300; }, s => { s.down = 3; }, s => { s.stun = 1; }, s => { s.player.knockdown = 1; },
    s => { s.driving = true; }, s => { s.boating = true; }, s => { s.riding = true; }, s => { s.seated = {}; },
    s => { s.appearance = cleanCharacter({ kind: 'human' }); },
    s => { s.blocks = [{ x: s.player.x - 20, z: s.player.z, width: 2, depth: 30, height: 200 }]; }]) {
    const s = eventFight(t, 'superman'); change(s); assert.equal(useKaijuPower(s), false);
    assert.deepEqual(s.bossHits, {}); assert.equal(s.heroAttackCooldown, 0, 'misses do not consume recovery');
  }
  for (const kind of ['hulk', 'flash']) {
    const s = eventFight(t, kind); s.player.height = 20; s.player.grounded = false;
    assert.equal(useKaijuPower(s), false, `${kind} cannot ground-strike in midair`);
  }
  const flying = eventFight(t, 'ironman'); flying.player.height = 30; flying.player.flying = true;
  flying.blocks = [{ x: flying.player.x - 20, z: flying.player.z, width: 2, depth: 30, height: 10 }];
  assert.ok(kaijuPowerTarget(flying), 'flying beams pass over low cover'); assert.equal(useKaijuPower(flying), true);
});

test('editing, recovery and city travel retain Kaiju attack recovery; effects stay bounded', t => {
  const s = eventFight(t, 'superman'); useKaijuPower(s);
  const cooldown = s.heroAttackCooldown; setAppearance(s, cleanCharacter({ kind: 'ironman' }));
  assert.equal(s.heroAttackCooldown, cooldown); assert.equal(useKaijuPower(s), false);
  recover(s); assert.equal(s.heroAttackCooldown, cooldown);
  const travelled = createSession(CITIES[1], s, s.appearance); assert.equal(travelled.heroAttackCooldown, cooldown);
  const ammo = travelled.mags.pistol; attack(travelled); assert.equal(travelled.mags.pistol, ammo, 'travel cannot bypass recovery with a gun');
  const parent = new THREE.Group(), effects = createHeroEffects(parent), pieces = [...parent.children[0].children];
  for (const kind of Object.keys(KAIJU_POWERS)) {
    const fight = eventFight(t, kind); useKaijuPower(fight);
    for (let i = 0; i < 25; i++) { fight.time += 0.01; effects.update(fight); }
    assert.deepEqual(parent.children[0].children, pieces);
    parent.traverse(node => assert.ok([...node.position.toArray(), ...node.scale.toArray(), ...node.quaternion.toArray()].every(Number.isFinite)));
    fight.time += 1; stepHeroPower(fight, 1); effects.update(fight);
    assert.equal(fight.player.kaijuPowerFx, null); assert.equal(parent.children[0].visible, false);
  }
  effects.dispose();
});
