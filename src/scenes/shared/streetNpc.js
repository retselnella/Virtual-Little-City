import * as THREE from 'three';

// A shared articulated rig for civilians (adults, children, office workers, joggers), gang members and officers.
export function createStreetNpc(scene, kit, { shirt = '#9ab6c0', police = false, armed = false, role = 'adult', look = {} } = {}) {
  const kid = role === 'kid', business = role === 'business', jogger = role === 'jogger';
  const skin = look.skin || '#cea280', hairColor = look.hair || '#4c3c36', pants = police ? '#1d2a3b' : business ? shirt : look.pants || '#344655';
  const avatar = new THREE.Group(); scene.add(avatar); avatar.scale.setScalar(look.scale || 1);
  const hips = new THREE.Group(); hips.name = 'hips'; avatar.add(hips); hips.position.y = 1.35;
  const torso = kit.box([0.9, 1, 0.55], shirt, [0, 0.45, 0], hips); torso.name = 'torso';
  kit.box([0.88, 0.12, 0.6], business ? '#1c1f25' : '#253747', [0, -0.06, 0], hips);
  if (business) { kit.box([0.3, 0.72, 0.04], '#f1f0ea', [0, 0.6, 0.28], hips); kit.box([0.1, 0.55, 0.05], '#9d2f3c', [0, 0.55, 0.305], hips); }
  if (look.backpack) kit.box([0.66, 0.7, 0.3], '#e76f51', [0, 0.5, -0.4], hips);
  // The head and hair hang from a neck joint (top of the torso) so ragdolls can move the head independently.
  const neck = new THREE.Group(); neck.name = 'neck'; neck.position.y = 0.95; hips.add(neck);
  // Children have proportionally larger heads.
  const headSize = kid ? 0.78 : 0.65;
  const head = kit.box([headSize, headSize, headSize * 0.92], skin, [0, 0.35 + (headSize - 0.65) / 2, 0], neck); head.name = 'head';
  const top = 0.69 + (headSize - 0.65);
  const style = police ? 'police' : look.hairStyle || 'short';
  if (style === 'police') { kit.box([0.7, 0.18, 0.63], '#22344d', [0, top, 0], neck); kit.box([0.78, 0.08, 0.3], '#22344d', [0, top - 0.06, 0.35], neck); kit.box([0.13, 0.2, 0.06], '#ebcd7e', [-0.22, 0.64, 0.3], hips); }
  else if (style === 'cap') { const cap = jogger ? shirt : kid ? '#3d7dd8' : '#2f4858'; kit.box([headSize + 0.05, 0.16, headSize * 0.95], cap, [0, top, 0], neck); kit.box([headSize * 0.8, 0.06, 0.3], cap, [0, top - 0.08, headSize * 0.55], neck); }
  else if (style !== 'bald') {
    kit.box([headSize + 0.05, 0.18, headSize * 0.97], hairColor, [0, top, 0], neck);
    if (style === 'long') kit.box([headSize + 0.04, headSize * 0.95, 0.16], hairColor, [0, top - headSize * 0.5, -headSize * 0.45], neck);
  }
  const arms = [], elbows = [], legs = [], knees = [];
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'left' : 'right';
    const arm = new THREE.Group(); arm.name = name + '-shoulder'; arm.position.set(side * 0.6, 0.8, 0); hips.add(arm);
    kit.box([0.28, 0.52, 0.33], shirt, [0, -0.23, 0], arm);
    const elbow = new THREE.Group(); elbow.name = name + '-elbow'; elbow.position.y = -0.46; arm.add(elbow);
    kit.box([0.25, 0.44, 0.29], jogger ? skin : shirt, [0, -0.19, 0], elbow);
    const hand = kit.box([0.25, 0.26, 0.27], skin, [0, -0.47, 0], elbow); hand.name = name + '-hand';
    if (side > 0 && armed) kit.box([0.16, 0.18, 0.6], '#29333d', [0, -0.5, 0.23], elbow);
    if (side < 0 && business) { const briefcase = kit.box([0.16, 0.5, 0.72], '#5a3b28', [0, -0.78, 0], elbow); briefcase.name = 'briefcase'; }
    if (side > 0 && business) { const phone = kit.box([0.08, 0.3, 0.16], '#1a1d22', [0.12, -0.52, 0.08], elbow); phone.name = 'phone'; phone.visible = false; }
    const leg = new THREE.Group(); leg.name = name + '-hip'; leg.position.set(side * 0.24, -0.12, 0); hips.add(leg);
    kit.box([0.35, 0.56, 0.41], pants, [0, -0.24, 0], leg);
    const knee = new THREE.Group(); knee.name = name + '-knee'; knee.position.y = -0.5; leg.add(knee);
    kit.box([0.33, 0.55, 0.39], jogger ? skin : pants, [0, -0.25, 0], knee);
    kit.box([0.38, 0.22, 0.63], business ? '#1a1a1a' : kid ? '#f4f1ea' : '#dddccf', [0, -0.61, 0.1], knee);
    arms.push(arm); elbows.push(elbow); legs.push(leg); knees.push(knee);
  }
  const phone = avatar.getObjectByName('phone');
  let gait = 0, clock = Math.random() * 10;
  return {
    avatar,
    update(person, dt) {
      clock += dt;
      const down = person.health <= 0 || person.knockdown > 0, speed = !down ? person.speed || 0 : 0; gait += speed * dt * (kid ? 4.4 : 3);
      avatar.position.set(person.x, 0.15 * (look.scale || 1) + (person.height || 0), person.z); avatar.rotation.y = person.heading || 0;
      const fall = person.fall || 0; hips.rotation.x = fall * (person.fallDir || 1); hips.position.y = 1.35 - Math.sin(fall) * 1.05;
      hips.rotation.z = (person.flinch || 0) * Math.sin((person.flinch || 0) * 30) * 0.5;
      const swing = Math.min(0.7, speed * 0.14), dead = person.health <= 0, idle = !down && person.idle > 0 && speed < 0.3;
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = Math.sin(gait + i * Math.PI) * swing;
        knees[i].rotation.x = down ? 0.35 : Math.max(0, Math.sin(gait + i * Math.PI)) * swing;
        arms[i].rotation.x = armed && !down ? -1.25 + (person.fireTime || 0) * 0.5 : -Math.sin(gait + i * Math.PI) * swing;
        arms[i].rotation.z = (i ? 1 : -1) * (down ? 0.55 : 0.08);
        elbows[i].rotation.x = armed && !down ? -0.25 : down ? -0.6 : -swing * 0.3;
        if (down || armed) continue;
        if (person.panic) {
          // Running for cover with hands raised.
          arms[i].rotation.x = -2.5 + Math.sin(gait + i * Math.PI) * 0.3; arms[i].rotation.z = (i ? 1 : -1) * 0.35; elbows[i].rotation.x = -0.7;
        } else if (idle && business && i === 1) {
          // Phone call.
          arms[i].rotation.x = -0.55; arms[i].rotation.z = 0.35; elbows[i].rotation.x = -2.3;
        } else if (idle && !kid && person.slot && i === 1) {
          // Companions chat with the group leader while waiting.
          arms[i].rotation.x = -0.6 + Math.sin(clock * 3) * 0.25; elbows[i].rotation.x = -1.1 + Math.sin(clock * 5) * 0.2;
        } else if (kid && person.slot && i === (person.slot[0] < 0 ? 0 : 1)) {
          // Holding the parent's hand. Joints named "left" sit at local -x, which faces a parent on the child's right.
          arms[i].rotation.z = (i ? 1 : -1) * 0.5; arms[i].rotation.x = -0.25; elbows[i].rotation.x = -0.1;
        }
      }
      // Street-spot poses (worldPedestrians.js): seated on benches, serving at a stall, chatting in a circle.
      if (!down && !armed && !person.panic && person.pose) {
        const calling = idle && business;
        for (let i = 0; i < 2; i++) {
          if (calling && i === 1) continue;
          if (person.pose === 'sit') {
            legs[i].rotation.x = -1.45; knees[i].rotation.x = 1.45; arms[i].rotation.x = -0.45; arms[i].rotation.z = (i ? 1 : -1) * 0.12; elbows[i].rotation.x = -0.75;
          } else if (person.pose === 'vendor') {
            arms[i].rotation.x = -0.9 + Math.sin(clock * 2.4 + i * 2) * 0.25; elbows[i].rotation.x = -0.9 + Math.sin(clock * 3.1 + i) * 0.2;
          } else if (person.pose === 'chat' && i === 1) {
            arms[i].rotation.x = -0.6 + Math.sin(clock * 3) * 0.25; elbows[i].rotation.x = -1.1 + Math.sin(clock * 5) * 0.2;
          }
        }
        if (person.pose === 'sit') hips.position.y = 0.72;
      }
      if (phone) phone.visible = idle && business;
      if (dead) knees.forEach(k => { k.rotation.x = 0.35; });
    },
  };
}
