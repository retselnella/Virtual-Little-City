import * as THREE from 'three';
import { KAIJU, beamPoint, currentAttack, kaijuPose } from '../../models/worldTour/worldBoss.js';
import { createKaijuAudio } from './kaijuAudio.js';

// The kaiju and its attacks, drawn from the same deterministic behaviour the gameplay uses (worldBoss.js): a
// procedurally built monster ~150 m tall (legs, belly, arms, head with a hinged jaw, glowing dorsal plates and a
// swinging tail), plus telegraphs, fire, a beam, shockwaves, fireballs, explosions, debris and smoke.
const SCALE = 10, FLAMES = 180, DEBRIS = 260;

export function createKaiju(root) {
  const disposables = [], unit = new THREE.BoxGeometry(1, 1, 1); disposables.push(unit);
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }); disposables.push(m); return m; };
  const skin = mat('#2c3530'), belly = mat('#5d6456'), claw = mat('#d8d2c2'), plate = mat('#9fb2b8', { emissive: '#6fd3ff', emissiveIntensity: 0 }), eye = mat('#ffd35a', { emissive: '#ffb020', emissiveIntensity: 2 });
  const box = (parent, material, size, position, rotation = [0, 0, 0]) => { const m = new THREE.Mesh(unit, material); m.scale.set(...size); m.position.set(...position); m.rotation.set(...rotation); parent.add(m); return m; };
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); group.scale.setScalar(SCALE); root.add(group);
  // Legs (hip → knee → foot), pelvis, belly, chest and arms.
  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(); hip.position.set(side * 1.05, 5.2, 0); body.add(hip);
    box(hip, skin, [1.5, 2.9, 1.7], [0, -1.2, 0]);
    const knee = new THREE.Group(); knee.position.set(0, -2.5, 0.2); hip.add(knee);
    box(knee, skin, [1.15, 2.4, 1.25], [0, -1.1, 0]); box(knee, skin, [1.6, 0.55, 2.3], [0, -2.35, 0.35]);
    for (const t of [-0.5, 0, 0.5]) box(knee, claw, [0.25, 0.25, 0.5], [t, -2.45, 1.6]);
    return { hip, knee, side };
  });
  box(body, skin, [3, 2.2, 2.5], [0, 5.9, -0.1]); box(body, skin, [3.2, 3.6, 2.8], [0, 8.1, 0.1]); box(body, belly, [2.2, 3.4, 0.4], [0, 8, 1.55]);
  box(body, skin, [3.3, 2.4, 2.5], [0, 10.4, 0.45]);
  const arms = [-1, 1].map(side => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 1.7, 10.6, 1.2); body.add(shoulder);
    box(shoulder, skin, [0.6, 1.8, 0.6], [0, -0.8, 0.2], [0.5, 0, side * 0.2]);
    const elbow = new THREE.Group(); elbow.position.set(0, -1.6, 0.8); shoulder.add(elbow);
    box(elbow, skin, [0.5, 1.4, 0.5], [0, -0.6, 0.3], [0.8, 0, 0]); for (const t of [-0.15, 0.15]) box(elbow, claw, [0.12, 0.12, 0.45], [t, -1.2, 0.8]);
    return shoulder;
  });
  // Neck, head, jaw and eyes.
  const neck = new THREE.Group(); neck.position.set(0, 11.6, 1.1); body.add(neck); box(neck, skin, [1.7, 1.9, 1.7], [0, 0.6, 0.2], [0.35, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.5, 0.9); neck.add(head);
  box(head, skin, [1.7, 1.3, 2], [0, 0.2, 0.3]); box(head, skin, [1.3, 0.75, 1.6], [0, 0.1, 1.8]); box(head, skin, [1.8, 0.3, 1.2], [0, 0.85, 0.5]);
  for (const side of [-1, 1]) { box(head, eye, [0.25, 0.18, 0.1], [side * 0.55, 0.55, 1.35]); for (let k = 0; k < 4; k++) box(head, claw, [0.1, 0.22, 0.1], [side * 0.5, -0.3, 1.2 + k * 0.4]); }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.25, 0.5); head.add(jaw); box(jaw, skin, [1.25, 0.4, 2.2], [0, -0.15, 1.1]);
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.1, 2.7); head.add(mouth);
  // Dorsal plates along the spine; they glow before the beam.
  const plateGeometry = new THREE.ConeGeometry(0.9, 2.3, 3); disposables.push(plateGeometry);
  [[0, 12.4, -0.8, 0.7], [0, 11, -1.3, 1], [0, 9.3, -1.5, 1.15], [0, 7.5, -1.5, 1.1], [0, 5.9, -1.4, 0.9], [0, 4.8, -2.4, 0.7], [0, 4.4, -3.8, 0.55]].forEach(([x, y, z, s]) => {
    const m = new THREE.Mesh(plateGeometry, plate); m.position.set(x, y, z); m.scale.set(s, s, s * 0.28); m.rotation.x = -0.3; body.add(m);
  });
  // Tail: a chain of tapering segments, each swinging a little more than the last.
  const tail = []; let parent = body, size = 1.8;
  for (let k = 0; k < 9; k++) {
    const seg = new THREE.Group(); seg.position.set(0, k ? -0.12 : 4.6, k ? -1.35 : -1.8); parent.add(seg);
    box(seg, skin, [size, size * 0.85, 1.6], [0, 0, -0.7]); tail.push(seg); parent = seg; size *= 0.84;
  }

  // ---- Effects
  const additive = color => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }); disposables.push(m); return m; };
  const ball = new THREE.IcosahedronGeometry(1, 1); disposables.push(ball);
  const flameMesh = new THREE.InstancedMesh(ball, additive('#ff8a2a'), FLAMES); flameMesh.frustumCulled = false; root.add(flameMesh);
  const flames = Array.from({ length: FLAMES }, () => ({ life: 0 }));
  const debrisMesh = new THREE.InstancedMesh(unit, mat('#8d8a82'), DEBRIS); debrisMesh.frustumCulled = false; root.add(debrisMesh);
  const debris = Array.from({ length: DEBRIS }, () => ({ life: 0 }));
  const smokeMaterial = new THREE.MeshStandardMaterial({ color: '#4b4a47', roughness: 1, transparent: true, opacity: 0.5, depthWrite: false, flatShading: true }); disposables.push(smokeMaterial);
  const smokeMesh = new THREE.InstancedMesh(ball, smokeMaterial, 90); smokeMesh.frustumCulled = false; root.add(smokeMesh);
  const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2); disposables.push(beamGeometry);
  const beam = new THREE.Mesh(beamGeometry, additive('#9fe3ff')), beamCore = new THREE.Mesh(beamGeometry, additive('#ffffff')); root.add(beam, beamCore);
  const ringGeometry = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2); disposables.push(ringGeometry);
  const warnMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }); disposables.push(warnMaterial);
  const warnings = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(ringGeometry, warnMaterial); m.visible = false; root.add(m); return m; });
  const shock = new THREE.Mesh(ringGeometry, additive('#ffe3b0')); shock.visible = false; root.add(shock);
  const roarShell = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.15, depthWrite: false, side: THREE.BackSide })); disposables.push(roarShell.material); roarShell.visible = false; root.add(roarShell);
  const fireballs = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(ball, additive('#ff6a1a')); m.visible = false; root.add(m); return m; });
  const flashes = Array.from({ length: 16 }, () => { const m = new THREE.Mesh(ball, additive('#ffd08a')); m.visible = false; root.add(m); return { m, age: 9 }; });
  const dummy = new THREE.Object3D(), mouthWorld = new THREE.Vector3(), audio = createKaijuAudio();
  const boomed = new Set();
  let lastHit = 0, lastStep = 0, lastPhase = '', ruinedSeen = null, flameCursor = 0, debrisCursor = 0, flashCursor = 0, smokeSites = [];

  const emitFlame = (from, dir, speed) => { const f = flames[flameCursor++ % FLAMES]; Object.assign(f, { x: from.x, y: from.y, z: from.z, vx: dir.x * speed + (Math.random() - 0.5) * 12, vy: dir.y * speed + (Math.random() - 0.5) * 8, vz: dir.z * speed + (Math.random() - 0.5) * 12, life: 1.1, size: 3 }); };
  const burst = (x, y, z, n, power, color) => { for (let k = 0; k < n; k++) { const d = debris[debrisCursor++ % DEBRIS]; Object.assign(d, { x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 6, z: z + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * power, vy: Math.random() * power * 0.9, vz: (Math.random() - 0.5) * power, life: 2.5 + Math.random(), size: 0.8 + Math.random() * 2.2, spin: Math.random() * 6 }); } };
  const flash = (x, y, z, size) => { const f = flashes[flashCursor++ % flashes.length]; f.m.position.set(x, y, z); f.age = 0; f.size = size; f.m.visible = true; };

  function update(s, dt, camera, blocks) {
    const boss = s.boss, ev = s.bossEvent;
    group.visible = !!boss;
    const t = boss ? boss.t : 0, pose = boss || { x: 0, z: 0, heading: 0 }, listener = camera.position;
    const distance = Math.hypot(listener.x - pose.x, listener.z - pose.z), loud = Math.max(0, 1 - distance / 900);
    // Rising from the sea, walking, and (when defeated) toppling and sinking.
    const rise = Math.min(1, t / 40), stride = (t < 104 ? t * 5 : 520 + (t - 104) * 2.5) / 22 * Math.PI;
    group.position.set(pose.x, boss && !boss.alive ? -Math.min(90, boss.dying * 4) : -70 * (1 - rise), pose.z);
    group.rotation.set(boss && !boss.alive ? Math.min(1.2, boss.dying * 0.15) : 0, pose.heading, 0);
    legs.forEach(({ hip, knee, side }) => { const swing = Math.sin(stride + (side > 0 ? 0 : Math.PI)); hip.rotation.x = swing * 0.35; knee.rotation.x = Math.max(0, -swing) * 0.5; });
    body.position.y = Math.abs(Math.sin(stride)) * 0.25; body.rotation.z = Math.sin(stride) * 0.04;
    tail.forEach((seg, k) => { seg.rotation.y = Math.sin(t * 0.9 - k * 0.5) * 0.12 * (1 + k * 0.15); seg.rotation.x = 0.05 + k * 0.01; });
    arms.forEach((a, k) => { a.rotation.x = Math.sin(stride + k) * 0.15; });
    let jawOpen = 0.05, headPitch = 0, plateGlow = 0, bodyLean = 0, turn = 0;
    const attack = boss?.alive && ev ? currentAttack(ev.seed, t) : null;
    warnings.forEach(w => { w.visible = false; }); beam.visible = beamCore.visible = false; shock.visible = false; roarShell.visible = false; fireballs.forEach(f => { f.visible = false; });
    if (attack) {
      const wind = Math.min(1, (t - attack.start) / (attack.impact - attack.start)), live = t >= attack.impact, into = live ? (t - attack.impact) / (attack.end - attack.impact) : 0;
      const phase = `${attack.id}:${live ? 'live' : 'wind'}`;
      if (phase !== lastPhase) { lastPhase = phase; if (live) audio.play(attack.type, loud); else if (attack.type === 'laser') audio.play('charge', loud); }
      const warn = (i, x, z, r) => { const w = warnings[i]; w.visible = true; w.position.set(x, 0.4, z); w.scale.setScalar(r * (0.9 + Math.sin(t * 10) * 0.05)); };
      if (attack.type === 'fire') { jawOpen = 0.25 + wind * 0.45; headPitch = live ? 0.25 : -0.3 * wind; }
      if (attack.type === 'laser') {
        plateGlow = live ? 3 : wind * 3; jawOpen = 0.2 + wind * 0.5; headPitch = 0.2;
        if (!live) { warn(0, attack.sweep[0].x, attack.sweep[0].z, 10); warn(1, attack.sweep[1].x, attack.sweep[1].z, 10); }
        else {
          mouth.getWorldPosition(mouthWorld); const hit = beamPoint(attack, Math.min(1, into)), end = new THREE.Vector3(hit.x, 0.5, hit.z), length = mouthWorld.distanceTo(end);
          for (const [m, r] of [[beam, 4.5], [beamCore, 1.6]]) { m.visible = true; m.position.copy(mouthWorld); m.lookAt(end); m.scale.set(r, r, length); }
          if (Math.random() < 0.6) burst(hit.x, 1, hit.z, 2, 26); if (Math.random() < 0.3) flash(hit.x, 3, hit.z, 10);
        }
      }
      if (attack.type === 'slam') {
        bodyLean = live ? 0.35 : 0.2 * wind; arms.forEach(a => { a.rotation.x = live ? 1.1 : -0.8 * wind; });
        if (!live) warn(0, attack.target.x, attack.target.z, 55);
        else { shock.visible = true; shock.position.set(attack.target.x, 0.6, attack.target.z); shock.scale.setScalar(10 + into * 90); shock.material.opacity = 0.9 * (1 - into); if (into < 0.05) { burst(attack.target.x, 1, attack.target.z, 30, 40); flash(attack.target.x, 4, attack.target.z, 22); } }
      }
      if (attack.type === 'roar') {
        headPitch = -0.55 * wind; jawOpen = 0.2 + 0.7 * wind;
        if (live) { roarShell.visible = true; roarShell.position.set(pose.x, 120, pose.z); roarShell.scale.setScalar(40 + into * 260); roarShell.material.opacity = 0.18 * (1 - into); }
      }
      if (attack.type === 'meteors') {
        jawOpen = 0.3 + 0.4 * wind; headPitch = -0.4;
        attack.shells.forEach((shell, k) => {
          if (t < shell.at - 2.2) { if (!live) warn(k, shell.x, shell.z, 16); return; }
          if (t < shell.at) {
            warn(k, shell.x, shell.z, 16);
            const u = 1 - (shell.at - t) / 2.2; mouth.getWorldPosition(mouthWorld);
            fireballs[k].visible = true; fireballs[k].scale.setScalar(4);
            fireballs[k].position.set(mouthWorld.x + (shell.x - mouthWorld.x) * u, mouthWorld.y * (1 - u) + Math.sin(u * Math.PI) * 60, mouthWorld.z + (shell.z - mouthWorld.z) * u);
          } else if (t < shell.at + 0.3 && !boomed.has(`${attack.id}:${k}`)) { boomed.add(`${attack.id}:${k}`); if (boomed.size > 60) boomed.clear(); burst(shell.x, 1, shell.z, 16, 34); flash(shell.x, 4, shell.z, 18); audio.play('blast', loud * 0.8); }
        });
      }
      if (attack.type === 'tail') { turn = Math.sin(Math.min(1, (t - attack.start) / (attack.end - attack.start)) * Math.PI) * 0.9; if (!live) warn(0, attack.target.x, attack.target.z, 50); }
      if (attack.type === 'fire' && live) {
        mouth.getWorldPosition(mouthWorld); const dir = new THREE.Vector3(attack.target.x - mouthWorld.x, 1 - mouthWorld.y, attack.target.z - mouthWorld.z).normalize();
        for (let k = 0; k < 6; k++) emitFlame(mouthWorld, dir, 120 + Math.random() * 40);
      }
    } else lastPhase = '';
    jaw.rotation.x = jawOpen; head.rotation.x = headPitch; body.rotation.x = bodyLean; body.rotation.y = turn;
    plate.emissiveIntensity = plateGlow; plate.emissive.set(plateGlow > 0 ? '#6fd3ff' : '#000000');
    // Footfalls: a thud and a puff of dust at each step.
    if (boss?.alive) { const step = Math.floor(stride / Math.PI); if (step !== lastStep) { lastStep = step; audio.play('step', loud * 0.7); burst(pose.x + Math.sin(pose.heading + Math.PI / 2) * (step % 2 ? 10 : -10), 0.5, pose.z + Math.cos(pose.heading + Math.PI / 2) * (step % 2 ? 10 : -10), 5, 12); } }
    // Your hits land where you aimed: a spark for bullets, a fireball for rockets.
    const hit = s.kaijuImpact;
    if (hit && hit.id !== lastHit) {
      lastHit = hit.id;
      if (boss?.alive && s.time - hit.time < 0.5) {
        const size = { rocket: 9, sniper: 3.2, shotgun: 2.6, revolver: 2.2, punch: 2 }[hit.kind] || 1.3;
        flash(hit.x, hit.y, hit.z, size); if (size > 2) burst(hit.x, hit.y, hit.z, size > 5 ? 10 : 3, size > 5 ? 22 : 8);
        if (size > 5) audio.play('blast', 0.5);
      }
    }
    // Buildings that fall: debris, dust and smoke that keeps rising from the ruins.
    const ruined = s.ruins?.ruined;
    if (ruined && ruinedSeen && ruined.size > ruinedSeen.size) for (const i of ruined) if (!ruinedSeen.has(i)) { const b = blocks[i]; burst(b.x, b.height ?? 10, b.z, 24, 34); flash(b.x, 8, b.z, 16); audio.play('collapse', loud); }
    ruinedSeen = ruined ? new Set(ruined) : null;
    smokeSites = ruined ? [...ruined].slice(-30).map(i => blocks[i]) : [];
    // Particles.
    flames.forEach((f, i) => {
      if (f.life <= 0) { flameMesh.setMatrixAt(i, dummy.matrix.makeScale(0, 0, 0)); return; }
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= 20 * dt; if (f.y < 1) { f.y = 1; f.vy = 0; }
      dummy.position.set(f.x, f.y, f.z); dummy.scale.setScalar(f.size * (1.5 + (1.1 - f.life) * 7)); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); flameMesh.setMatrixAt(i, dummy.matrix);
    });
    flameMesh.instanceMatrix.needsUpdate = true;
    debris.forEach((d, i) => {
      if (d.life <= 0) { debrisMesh.setMatrixAt(i, dummy.matrix.makeScale(0, 0, 0)); return; }
      d.life -= dt; d.vy -= 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < 0.3) { d.y = 0.3; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; }
      dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.spin * d.life, d.spin * 0.7 * d.life, 0); dummy.scale.setScalar(d.size * Math.min(1, d.life)); dummy.updateMatrix(); debrisMesh.setMatrixAt(i, dummy.matrix);
    });
    debrisMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 90; i++) {
      const site = smokeSites[i % Math.max(1, smokeSites.length)];
      if (!site) { smokeMesh.setMatrixAt(i, dummy.matrix.makeScale(0, 0, 0)); continue; }
      const k = ((t * 0.05 + i * 0.137) % 1);
      dummy.position.set(site.x + Math.sin(i) * 6 + k * 20, 4 + k * 70, site.z + Math.cos(i) * 6); dummy.scale.setScalar(5 + k * 14); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); smokeMesh.setMatrixAt(i, dummy.matrix);
    }
    smokeMesh.instanceMatrix.needsUpdate = true;
    for (const f of flashes) { if (f.age > 0.5) { f.m.visible = false; continue; } f.age += dt; f.m.scale.setScalar(f.size * (0.4 + f.age * 3)); f.m.material.opacity = Math.max(0, 0.9 - f.age * 1.8); }
    return { shake: attack && t >= attack.impact && ['slam', 'roar', 'tail'].includes(attack.type) ? loud * 0.5 : 0 };
  }
  function dispose() {
    root.remove(group, flameMesh, debrisMesh, smokeMesh, beam, beamCore, shock, roarShell, ...warnings, ...fireballs, ...flashes.map(f => f.m));
    disposables.forEach(d => d.dispose()); audio.dispose();
  }
  // An explosion anywhere (a rocket hitting the street): a fireball and flying debris.
  const blast = (x, y, z) => { flash(x, y, z, 5); burst(x, y, z, 10, 16); audio.play('blast', 0.35); };
  return { update, dispose, blast, pose: kaijuPose, height: KAIJU.height };
}
