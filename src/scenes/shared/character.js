import * as THREE from 'three';

// Darker (or, above 1, lighter) shade of a hex colour, for necks, noses and muzzles that match any skin or fur.
const shade = (hex, factor) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
// Hair styles on the head group (head box is 0.58 x 0.62 x 0.53, centred on the group). A cap takes the hair colour.
function hair(box, head, style, color) {
  if (style === 'bald') return;
  if (style === 'buzz') { box([0.6, 0.07, 0.55], color, [0, 0.32, -0.01], head); return; }
  if (style === 'cap') { box([0.64, 0.2, 0.6], color, [0, 0.3, -0.01], head); box([0.5, 0.05, 0.3], color, [0, 0.22, 0.36], head); return; }
  box([0.63, 0.19, 0.59], color, [0, 0.29, -0.02], head);
  if (style === 'long') {
    box([0.64, 0.95, 0.16], color, [0, -0.2, -0.26], head);
    for (const x of [-0.31, 0.31]) box([0.06, 0.6, 0.45], color, [x, -0.05, -0.05], head);
  } else box([0.62, 0.38, 0.14], color, [0, 0.08, -0.25], head);
  if (style === 'bun') box([0.26, 0.26, 0.26], color, [0, 0.42, -0.22], head);
  else box([0.32, 0.12, 0.15], color, [-0.16, 0.2, 0.22], head);
}

// Heads for each kind of character, on the head group (the human head box is 0.58 x 0.62 x 0.53, centred on it).
function humanHead(box, head, skin, palette) {
  box([0.58, 0.62, 0.53], skin, [0, 0, 0], head);
  hair(box, head, palette.hairStyle || 'short', palette.hair || '#46362e');
  for (const x of [-0.15, 0.15]) box([0.075, 0.08, 0.025], '#293747', [x, 0.015, 0.277], head);
  box([0.1, 0.12, 0.1], shade(skin, 0.92), [0, -0.06, 0.3], head);
  box([0.16, 0.025, 0.02], '#835641', [0, -0.2, 0.279], head);
}
function wolfHead(box, head, fur) {
  const light = shade(fur, parseInt(fur.slice(1, 3), 16) > 200 ? 0.9 : 1.25), dark = shade(fur, 0.6);
  box([0.58, 0.58, 0.55], fur, [0, 0.02, -0.02], head);
  box([0.34, 0.26, 0.36], light, [0, -0.12, 0.4], head); // muzzle
  box([0.14, 0.1, 0.08], '#141414', [0, -0.02, 0.6], head); // nose
  box([0.28, 0.04, 0.3], dark, [0, -0.26, 0.4], head); // jaw line
  for (const x of [-0.15, 0.15]) {
    box([0.1, 0.07, 0.03], '#e0a526', [x, 0.1, 0.27], head); box([0.04, 0.06, 0.02], '#141414', [x, 0.1, 0.29], head); // eyes
    const ear = box([0.2, 0.24, 0.1], fur, [x * 1.35, 0.38, -0.04], head); ear.rotation.z = -Math.sign(x) * 0.35;
    box([0.1, 0.14, 0.03], shade(fur, 0.75), [x * 1.35, 0.37, 0.02], head).rotation.z = -Math.sign(x) * 0.35;
  }
  for (const x of [-0.3, 0.3]) box([0.08, 0.3, 0.36], light, [x, -0.1, 0], head); // cheek ruff
}
function bruteHead(box, head, skin, palette) {
  box([0.62, 0.6, 0.56], skin, [0, 0, 0], head);
  box([0.66, 0.24, 0.52], skin, [0, -0.24, 0.03], head); // wide jaw
  box([0.64, 0.1, 0.12], shade(skin, 0.78), [0, 0.12, 0.27], head); // heavy brow
  for (const x of [-0.15, 0.15]) box([0.08, 0.06, 0.025], '#1c2226', [x, 0.03, 0.285], head);
  box([0.14, 0.12, 0.1], shade(skin, 0.9), [0, -0.07, 0.31], head);
  box([0.24, 0.03, 0.02], shade(skin, 0.6), [0, -0.24, 0.31], head);
  if ((palette.hairStyle || 'short') !== 'bald') box([0.64, 0.1, 0.58], palette.hair || '#46362e', [0, 0.32, -0.01], head);
}
function robotHead(box, head, plate) {
  const light = '#5ee0ff';
  box([0.6, 0.56, 0.54], plate, [0, 0, 0], head);
  box([0.5, 0.15, 0.04], '#10161b', [0, 0.06, 0.275], head); box([0.44, 0.07, 0.03], light, [0, 0.06, 0.29], head); // visor
  box([0.3, 0.1, 0.03], shade(plate, 0.6), [0, -0.17, 0.275], head); // grille
  for (const x of [-0.32, 0.32]) box([0.07, 0.2, 0.2], shade(plate, 0.7), [x, 0, 0], head); // ear bolts
  box([0.04, 0.3, 0.04], shade(plate, 0.7), [0.18, 0.42, -0.05], head); box([0.09, 0.09, 0.09], '#e2513c', [0.18, 0.6, -0.05], head); // antenna
}

// The player rig. `palette` takes the character creator's appearance (see models/worldTour/characterProfile.js).
// Every kind shares the same joints (names and pivots), so animation, poses, guns and the ragdoll work for all of them.
export function createCharacter(scene, kit, palette = {}) {
  const { box } = kit, kind = palette.kind || 'human';
  const skin = palette.skin || '#d6a07d', shirt = palette.shirt || '#496b92', pants = palette.pants || '#344653';
  const brute = kind === 'brute', robot = kind === 'robot', wolf = kind === 'wolf';
  const avatar = new THREE.Group(); avatar.visible = false; avatar.scale.setScalar(palette.scale || 1); scene.add(avatar);
  const body = new THREE.Group(); body.name = 'body'; avatar.add(body);
  if (brute) {
    // A barrel chest in a sleeveless top, bare arms, and a thick neck.
    box([1.08, 1.02, 0.66], shirt, [0, 1.8, 0.02], body);
    box([0.46, 0.22, 0.03], shade(skin, 0.95), [0, 2.2, 0.36], body); // open neckline
    box([0.98, 0.14, 0.6], shade(pants, 0.85), [0, 1.29, 0], body);
    box([0.38, 0.24, 0.34], shade(skin, 0.88), [0, 2.34, 0], body);
  } else if (robot) {
    box([0.86, 0.95, 0.52], skin, [0, 1.77, 0], body);
    box([0.5, 0.5, 0.04], shirt, [0, 1.9, 0.27], body); // chest panel
    for (const y of [1.75, 1.9, 2.05]) box([0.3, 0.04, 0.02], shade(skin, 0.55), [0, y, 0.3], body);
    box([0.88, 0.14, 0.54], shade(skin, 0.6), [0, 1.29, 0], body);
    box([0.18, 0.23, 0.18], shade(skin, 0.5), [0, 2.32, 0], body);
  } else {
    box([0.84, 0.95, 0.5], shirt, [0, 1.77, 0], body);
    box([0.26, 0.7, 0.025], wolf ? shade(skin, 1.15) : '#e6e8df', [0, 1.88, 0.263], body);
    box([0.88, 0.12, 0.53], shade(pants, 0.85), [0, 1.29, 0], body);
    box([0.23, 0.23, 0.24], shade(skin, 0.88), [0, 2.32, 0], body);
  }
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 2.65; body.add(head);
  (wolf ? wolfHead : brute ? bruteHead : robot ? robotHead : humanHead)(box, head, skin, palette);
  // The wolf's tail, from the small of the back; it wags when standing still.
  let tail = null;
  if (wolf) {
    tail = new THREE.Group(); tail.position.set(0, 1.42, -0.26); body.add(tail);
    box([0.2, 0.2, 0.62], skin, [0, 0, -0.3], tail); box([0.2, 0.2, 0.2], shade(skin, 1.2), [0, 0, -0.66], tail);
    tail.rotation.x = 0.75;
  }
  const arms = [], elbows = [], wrists = [], legs = [], knees = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.57, 2.13, 0); body.add(arm);
    arm.name = side === 1 ? 'right-shoulder' : 'left-shoulder';
    const elbow = new THREE.Group(); elbow.name = side === 1 ? 'right-elbow' : 'left-elbow'; elbow.position.y = -0.4; arm.add(elbow); elbows.push(elbow);
    const wrist = new THREE.Group(); wrist.position.y = -0.36; elbow.add(wrist); wrists.push(wrist);
    wrist.name = side === 1 ? 'right-hand' : 'left-hand';
    if (brute) {
      box([0.46, 0.42, 0.48], skin, [side * 0.1, -0.12, 0], arm); // shoulder
      box([0.4, 0.4, 0.42], skin, [side * 0.08, -0.14, 0], elbow);
      box([0.36, 0.32, 0.36], skin, [side * 0.06, -0.12, 0], wrist);
    } else if (robot) {
      box([0.3, 0.42, 0.32], skin, [0, -0.19, 0], arm); box([0.2, 0.12, 0.2], shade(skin, 0.5), [0, -0.4, 0], arm);
      box([0.26, 0.36, 0.29], skin, [0, -0.16, 0], elbow);
      box([0.26, 0.25, 0.26], shade(skin, 0.75), [0, -0.1, 0], wrist);
    } else {
      box([0.28, 0.42, 0.32], shirt, [0, -0.19, 0], arm);
      box([0.25, 0.36, 0.29], shirt, [0, -0.16, 0], elbow);
      box([0.24, 0.25, 0.25], skin, [0, -0.1, 0], wrist);
    }
    arms.push(arm);
    const leg = new THREE.Group(); leg.name = side === 1 ? 'right-hip' : 'left-hip'; leg.position.set(side * 0.23, 1.25, 0); avatar.add(leg);
    box(brute ? [0.44, 0.55, 0.48] : [0.34, 0.55, 0.4], pants, [0, -0.25, 0], leg);
    const knee = new THREE.Group(); knee.name = side === 1 ? 'right-knee' : 'left-knee'; knee.position.y = -0.53; leg.add(knee); knees.push(knee);
    box(brute ? [0.4, 0.5, 0.44] : [0.32, 0.5, 0.37], robot ? shade(pants, 0.9) : pants, [0, -0.24, 0], knee);
    if (robot) box([0.2, 0.12, 0.2], shade(skin, 0.5), [0, 0.02, 0], knee);
    if (wolf) box([0.36, 0.2, 0.62], skin, [0, -0.6, 0.12], knee); // paws
    else box(brute ? [0.44, 0.24, 0.7] : [0.38, 0.23, 0.65], palette.shoes || '#e8e2d6', [0, -0.59, 0.11], knee);
    box([0.39, 0.06, 0.67], wolf ? shade(skin, 0.6) : '#8a8f90', [0, -0.7, 0.11], knee); legs.push(leg);
  }
  let gait = 0, motion = 0, wave = 0, animationTime = 0;
  return {
    avatar,
    update(player, delta) {
      animationTime += delta;
      avatar.position.set(player.x, 0.96 + player.height, player.z);
      const turn = Math.atan2(Math.sin(player.heading - avatar.rotation.y), Math.cos(player.heading - avatar.rotation.y));
      avatar.rotation.y += turn * (1 - Math.exp(-14 * delta));
      const blend = 1 - Math.exp(-16 * delta);
      motion += (Math.min(player.speed / 5, 1) - motion) * blend;
      wave += ((player.waveTime > 0 ? 1 : 0) - wave) * blend;
      gait += player.speed * delta * 3.2;
      const amplitude = motion * 0.7;
      legs[0].rotation.x = Math.sin(gait) * amplitude;
      legs[1].rotation.x = -Math.sin(gait) * amplitude;
      arms[0].rotation.x = -Math.sin(gait) * amplitude * 0.8;
      arms[1].rotation.x = Math.sin(gait) * amplitude * 0.8;
      arms[0].rotation.z = -0.05;
      arms[1].rotation.z = 0.05 + wave * 1.95;
      arms[1].rotation.x *= 1 - wave;
      elbows.forEach((elbow, i) => { elbow.rotation.x = -motion * 0.45; elbow.rotation.z = i === 1 ? wave * (0.65 + Math.sin(animationTime * 9) * 0.16) : 0; });
      wrists[1].rotation.z = wave * Math.sin(animationTime * 9) * 0.3;
      knees.forEach((knee, i) => { knee.rotation.x = Math.max(0, Math.sin(gait + i * Math.PI)) * motion * 0.65; });
      body.position.y = player.speed > 0.1 ? Math.abs(Math.sin(gait)) * 0.035 : Math.sin(animationTime * 2) * 0.012;
      body.rotation.x = player.speed > 3 ? 0.09 : 0;
      if (tail) { tail.rotation.y = Math.sin(animationTime * (motion > 0.2 ? 4 : 7)) * (0.35 - motion * 0.2); tail.rotation.x = 0.75 - motion * 0.35; }
      // Seated (a lounge sofa or a cinema seat): thighs forward, shins down, hands resting on the knees.
      if (player.seated) {
        legs.forEach(leg => { leg.rotation.x = -1.45; }); knees.forEach(knee => { knee.rotation.x = 1.45; });
        arms.forEach((arm, i) => { arm.rotation.x = -0.55; arm.rotation.z = (i ? 1 : -1) * 0.08; }); elbows.forEach(elbow => { elbow.rotation.x = -0.6; elbow.rotation.z = 0; });
        body.position.y = Math.sin(animationTime * 1.6) * 0.01; body.rotation.x = -0.05;
      }
      else if (player.height > 0.03) {
        legs.forEach(leg => { leg.rotation.x = -0.35; }); knees.forEach(knee => { knee.rotation.x = 0.65; });
        arms[0].rotation.z = -0.3; if (wave < 0.1) arms[1].rotation.z = 0.3;
      }
    },
  };
}
