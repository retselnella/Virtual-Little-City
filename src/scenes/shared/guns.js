import * as THREE from 'three';

// Guns built from boxes in code (no third-party models). Each is modelled with +Z along the barrel and +Y up, with the
// origin where the hand closes on the grip. `createGunHolder` mounts them in a character's right hand so the barrel
// follows the forearm: pointing at the target when the arm is raised to aim, down at the ground when it hangs.
const METAL = '#2b3037', DARK = '#16191d', STEEL = '#59606a', POLYMER = '#23262b', WOOD = '#6e4a2c', WOOD_DARK = '#4f3520';
// [size, colour, position, tilt about X (radians)]
const PARTS = {
  pistol: [
    [[0.1, 0.11, 0.44], METAL, [0, 0.19, 0.1]], // slide
    [[0.035, 0.012, 0.3], STEEL, [0, 0.25, 0.1]], // slide top rib
    [[0.09, 0.07, 0.3], POLYMER, [0, 0.11, 0.13]], // frame
    [[0.05, 0.05, 0.03], DARK, [0, 0.19, 0.33]], // muzzle
    [[0.088, 0.3, 0.13], POLYMER, [0, -0.03, -0.06], 0.26], // grip
    [[0.03, 0.02, 0.13], POLYMER, [0, 0.04, 0.1]], // trigger guard
    [[0.03, 0.07, 0.02], POLYMER, [0, 0.07, 0.165]],
    [[0.018, 0.05, 0.02], STEEL, [0, 0.07, 0.07]], // trigger
    [[0.02, 0.03, 0.02], DARK, [0, 0.26, 0.29]], // front sight
    [[0.07, 0.03, 0.02], DARK, [0, 0.26, -0.1]], // rear sight
  ],
  smg: [
    [[0.11, 0.15, 0.46], METAL, [0, 0.19, 0.08]], // receiver
    [[0.05, 0.05, 0.16], DARK, [0, 0.21, 0.39]], // barrel
    [[0.09, 0.08, 0.14], POLYMER, [0, 0.14, 0.25]], // foregrip
    [[0.07, 0.28, 0.09], DARK, [0, -0.03, 0.15], -0.12], // magazine
    [[0.08, 0.24, 0.1], POLYMER, [0, -0.01, -0.05], 0.26], // grip
    [[0.03, 0.02, 0.1], POLYMER, [0, 0.07, 0.04]], // trigger guard
    [[0.03, 0.03, 0.24], STEEL, [0, 0.2, -0.26]], // folded stock
    [[0.08, 0.12, 0.03], STEEL, [0, 0.16, -0.38]],
    [[0.03, 0.05, 0.12], DARK, [0, 0.29, 0.05]], // sight rail
  ],
  shotgun: [
    [[0.12, 0.15, 0.36], METAL, [0, 0.19, 0.05]], // receiver
    [[0.06, 0.06, 0.66], STEEL, [0, 0.235, 0.54]], // barrel
    [[0.055, 0.055, 0.5], METAL, [0, 0.165, 0.46]], // magazine tube
    [[0.1, 0.1, 0.24], WOOD, [0, 0.165, 0.5]], // pump
    [[0.08, 0.22, 0.12], WOOD_DARK, [0, 0.03, -0.06], 0.4], // grip
    [[0.1, 0.16, 0.38], WOOD, [0, 0.12, -0.36], -0.08], // stock
    [[0.105, 0.19, 0.03], DARK, [0, 0.1, -0.56]], // butt pad
    [[0.03, 0.02, 0.11], METAL, [0, 0.08, 0.06]], // trigger guard
    [[0.025, 0.03, 0.025], STEEL, [0, 0.28, 0.85]], // bead sight
  ],
  rifle: [
    [[0.12, 0.17, 0.56], METAL, [0, 0.19, 0.1]], // receiver
    [[0.11, 0.12, 0.34], POLYMER, [0, 0.19, 0.53]], // handguard
    [[0.045, 0.045, 0.32], DARK, [0, 0.21, 0.84]], // barrel
    [[0.06, 0.06, 0.06], DARK, [0, 0.21, 1.02]], // flash hider
    [[0.02, 0.09, 0.02], DARK, [0, 0.29, 0.78]], // front sight
    [[0.05, 0.07, 0.24], DARK, [0, 0.31, 0.06]], // optic
    [[0.08, 0.3, 0.12], DARK, [0, -0.04, 0.24], -0.3], // curved magazine
    [[0.08, 0.24, 0.1], POLYMER, [0, -0.01, -0.05], 0.3], // grip
    [[0.03, 0.02, 0.12], POLYMER, [0, 0.07, 0.07]], // trigger guard
    [[0.07, 0.07, 0.3], POLYMER, [0, 0.19, -0.3]], // buffer tube
    [[0.09, 0.2, 0.18], POLYMER, [0, 0.13, -0.48]], // stock
  ],
};
// Where the muzzle flash sits on each gun, whether it is held with both hands at chest height, and its size in the
// hand (the characters are chunky, so guns are drawn a little larger than life to read at a distance).
export const GUN_INFO = Object.freeze({
  pistol: { muzzle: [0, 0.19, 0.4], long: false, scale: 1.3 },
  smg: { muzzle: [0, 0.21, 0.5], long: false, scale: 1.35 },
  shotgun: { muzzle: [0, 0.235, 0.92], long: true, scale: 1.55 },
  rifle: { muzzle: [0, 0.21, 1.1], long: true, scale: 1.55 },
});

export function buildGun(kit, id, flashMaterial) {
  const group = new THREE.Group(); group.name = `gun-${id}`; group.scale.setScalar((GUN_INFO[id] || GUN_INFO.pistol).scale);
  for (const [size, color, position, tilt] of PARTS[id] || PARTS.pistol) {
    const mesh = kit.box(size, color, position, group);
    if (tilt) mesh.rotation.x = tilt;
  }
  const flash = kit.box([0.24, 0.24, 0.2], '#ffe7a3', (GUN_INFO[id] || GUN_INFO.pistol).muzzle, group);
  flash.material = flashMaterial; flash.visible = false;
  return { group, flash };
}

// Guns for one character, built the first time each is shown. `set(id)` shows that gun (or none for fists or null).
export function createGunHolder(body, kit, flashMaterial) {
  const hand = body.getObjectByName('right-hand');
  const mount = new THREE.Group(); mount.name = 'pistol';
  // Model +Z (the barrel) along the hand's -Y (the way the forearm points) and model +Y along the hand's +Z.
  mount.rotation.x = Math.PI / 2; mount.position.set(0, -0.12, 0); hand.add(mount);
  const built = new Map(); let current = null;
  return {
    mount,
    get current() { return current; },
    set(id) {
      const next = GUN_INFO[id] ? id : null;
      if (next === current) return;
      if (current) built.get(current).group.visible = false;
      if (next && !built.has(next)) { const gun = buildGun(kit, next, flashMaterial); mount.add(gun.group); built.set(next, gun); }
      if (next) built.get(next).group.visible = true;
      current = next;
    },
    flash(on) { if (current) built.get(current).flash.visible = on; },
  };
}

// Combat poses layered over the shared character animation (player and ghosts alike).
const elbowOf = arm => arm.children.find(child => child.isGroup);
// `gun` is the weapon id in hand (null for fists). Handguns are aimed at arm's length, gripped with both hands; long
// guns are held at chest height with the left hand on the fore-end. Between shots a gun is carried at low ready.
export function poseArms(body, gun, aiming, punchTime, combo, recoil) {
  const right = body.getObjectByName('right-shoulder'), left = body.getObjectByName('left-shoulder');
  if (gun && aiming && GUN_INFO[gun].long) {
    right.rotation.set(-1.02 - recoil * 0.25, 0, 0.3); elbowOf(right).rotation.set(-0.55 + recoil * 0.2, 0, 0);
    left.rotation.set(-1.5, 0, -0.35); elbowOf(left).rotation.set(-0.12, 0, 0);
  } else if (gun && aiming) {
    right.rotation.set(-1.5 - recoil * 0.4, 0, 0.12); elbowOf(right).rotation.set(recoil * -0.3, 0, 0);
    left.rotation.set(-1.35, 0, 0.55); elbowOf(left).rotation.set(-0.35, 0, 0);
  } else if (gun) {
    right.rotation.set(-0.35, 0, 0.1); elbowOf(right).rotation.set(GUN_INFO[gun].long ? -0.95 : -0.45, 0, 0);
    if (GUN_INFO[gun].long) { left.rotation.set(-0.9, 0, -0.45); elbowOf(left).rotation.set(-0.7, 0, 0); }
  } else if (aiming || punchTime > 0) {
    for (const [arm, inward] of [[left, 1], [right, -1]]) { arm.rotation.set(-1.05, 0, inward * 0.3); elbowOf(arm).rotation.set(-1.9, 0, 0); }
    if (punchTime > 0) {
      const reach = Math.sin(Math.min(1, (1 - punchTime / 0.28) * 1.7) * Math.PI), arm = combo === 1 ? left : right, inward = arm === left ? 1 : -1;
      arm.rotation.x = -1.05 - reach * 0.55; elbowOf(arm).rotation.x = -1.9 * (1 - reach);
      if (combo === 2) arm.rotation.z = inward * (0.3 + reach * 0.7);
    }
  }
}
