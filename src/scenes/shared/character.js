import * as THREE from 'three';

// Darker shade of a hex colour, for the neck and nose so they match any skin tone.
const shade = (hex, factor) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0')).join('');
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

// The player rig. `palette` takes the character creator's appearance (see models/worldTour/characterProfile.js).
export function createCharacter(scene, kit, palette = {}) {
  const { box } = kit;
  const skin = palette.skin || '#d6a07d', shirt = palette.shirt || '#496b92', pants = palette.pants || '#344653';
  const avatar = new THREE.Group(); avatar.visible = false; avatar.scale.setScalar(palette.scale || 1); scene.add(avatar);
  const body = new THREE.Group(); body.name = 'body'; avatar.add(body);
  box([0.84, 0.95, 0.5], shirt, [0, 1.77, 0], body);
  box([0.26, 0.7, 0.025], '#e6e8df', [0, 1.88, 0.263], body);
  box([0.88, 0.12, 0.53], shade(pants, 0.85), [0, 1.29, 0], body);
  box([0.23, 0.23, 0.24], shade(skin, 0.88), [0, 2.32, 0], body);
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 2.65; body.add(head);
  box([0.58, 0.62, 0.53], skin, [0, 0, 0], head);
  hair(box, head, palette.hairStyle || 'short', palette.hair || '#46362e');
  for (const x of [-0.15, 0.15]) box([0.075, 0.08, 0.025], '#293747', [x, 0.015, 0.277], head);
  box([0.1, 0.12, 0.1], shade(skin, 0.92), [0, -0.06, 0.3], head);
  box([0.16, 0.025, 0.02], '#835641', [0, -0.2, 0.279], head);
  const arms = [], elbows = [], wrists = [], legs = [], knees = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.57, 2.13, 0); body.add(arm);
    arm.name = side === 1 ? 'right-shoulder' : 'left-shoulder';
    box([0.28, 0.42, 0.32], shirt, [0, -0.19, 0], arm);
    const elbow = new THREE.Group(); elbow.name = side === 1 ? 'right-elbow' : 'left-elbow'; elbow.position.y = -0.4; arm.add(elbow); elbows.push(elbow);
    box([0.25, 0.36, 0.29], shirt, [0, -0.16, 0], elbow);
    const wrist = new THREE.Group(); wrist.position.y = -0.36; elbow.add(wrist); wrists.push(wrist);
    wrist.name = side === 1 ? 'right-hand' : 'left-hand';
    box([0.24, 0.25, 0.25], skin, [0, -0.1, 0], wrist); arms.push(arm);
    const leg = new THREE.Group(); leg.name = side === 1 ? 'right-hip' : 'left-hip'; leg.position.set(side * 0.23, 1.25, 0); avatar.add(leg);
    box([0.34, 0.55, 0.4], pants, [0, -0.25, 0], leg);
    const knee = new THREE.Group(); knee.name = side === 1 ? 'right-knee' : 'left-knee'; knee.position.y = -0.53; leg.add(knee); knees.push(knee);
    box([0.32, 0.5, 0.37], pants, [0, -0.24, 0], knee);
    box([0.38, 0.23, 0.65], palette.shoes || '#e8e2d6', [0, -0.59, 0.11], knee);
    box([0.39, 0.06, 0.67], '#8a8f90', [0, -0.7, 0.11], knee); legs.push(leg);
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
      if (player.height > 0.03) {
        legs.forEach(leg => { leg.rotation.x = -0.35; }); knees.forEach(knee => { knee.rotation.x = 0.65; });
        arms[0].rotation.z = -0.3; if (wave < 0.1) arms[1].rotation.z = 0.3;
      }
    },
  };
}
