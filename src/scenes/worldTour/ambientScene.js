import * as THREE from 'three';
import { createStreetNpc } from '../shared/streetNpc.js';
import { ambientGroups, isOut } from '../../models/worldTour/ambientLife.js';

// Draws the island's ambient life (ambientLife.js): props once (picnic blankets, café tables, bonfires, desert
// umbrellas), and people only for the groups that are out at this time of day and near the camera, up to a cap, so
// the crowd costs little wherever you are.
const RANGE = 240, MAX_PEOPLE = 64;
export function buildAmbient(root, kit, { island, blocks, seed, box, glowMaterial, geometries }) {
  const groups = ambientGroups(island, blocks, seed), fires = [];
  for (const g of groups) {
    if (g.prop === 'blanket') { box([3.4, 0.06, 2.6], '#d8574f', [g.x, 0.05, g.z]); box([1.2, 0.07, 2.6], '#f3eee5', [g.x, 0.06, g.z]); box([0.7, 0.4, 0.5], '#8a5a3b', [g.x + 1.3, 0.25, g.z - 0.9]); }
    if (g.prop === 'table') { box([1.3, 0.08, 1.3], '#e9e2d3', [g.x, 1.02, g.z]); box([0.14, 1, 0.14], '#4a4f55', [g.x, 0.5, g.z]); for (const side of [-1, 1]) box([0.7, 0.1, 0.7], '#6b5a48', [g.x + side * 1, 0.62, g.z]); box([2.8, 0.1, 2.2], '#c9523c', [g.x, 3.1, g.z]); box([0.1, 2.1, 0.1], '#e6e1d6', [g.x, 2.05, g.z]); }
    if (g.prop === 'umbrella') { box([0.2, 3.2, 0.2], '#e6e1d6', [g.at.x, 1.6, g.at.z]); box([4.4, 0.35, 4.4], '#f3eee5', [g.at.x, 3.3, g.at.z], 0.4); box([1.2, 0.3, 3], '#f1e7d0', [g.x, 0.25, g.z]); }
    if (g.prop === 'bonfire') {
      for (let a = 0; a < 7; a++) box([0.5, 0.35, 0.5], '#77796f', [g.x + Math.sin(a) * 1.1, 0.18, g.z + Math.cos(a) * 1.1]);
      for (const a of [0, 1.2, 2.4]) box([1.6, 0.25, 0.25], '#5c4330', [g.x, 0.3, g.z], a);
      for (const m of g.members) if (m.pose === 'sit') box([1, 0.6, 0.5], '#6b4a31', [m.x, 0.3, m.z], m.heading + Math.PI / 2); // log seats
      const shape = new THREE.OctahedronGeometry(0.75, 0); geometries.add(shape);
      const fire = new THREE.Mesh(shape, glowMaterial('#ff9a3c', 2.5, '#ff7a1a')); fire.position.set(g.x, 0.8, g.z); fire.visible = false; root.add(fire); fires.push(fire);
    }
  }
  const people = groups.flatMap(g => g.members.map((m, i) => ({ key: `${g.id}:${i}`, group: g, member: m })));
  const shown = new Map();
  return {
    groups,
    // `at` is where the camera looks; `night` is 0 (day) to 1 (night); `t` is seconds.
    update(at, night, dt, t) {
      for (const fire of fires) { fire.visible = night >= 0.5; if (fire.visible) { fire.rotation.y += dt * 2; fire.scale.setScalar(0.85 + Math.sin(t * 9 + fire.position.x) * 0.15); } }
      const near = people.filter(p => isOut(p.group, night) && Math.hypot(p.member.x - at.x, p.member.z - at.z) < RANGE)
        .sort((a, b) => Math.hypot(a.member.x - at.x, a.member.z - at.z) - Math.hypot(b.member.x - at.x, b.member.z - at.z)).slice(0, MAX_PEOPLE);
      const wanted = new Set(near.map(p => p.key));
      for (const [key, entry] of shown) if (!wanted.has(key)) { root.remove(entry.model.avatar); shown.delete(key); }
      for (const p of near) {
        let entry = shown.get(p.key);
        if (!entry) {
          const m = p.member, model = createStreetNpc(root, kit, { shirt: m.look.shirt, role: m.role, look: m.look });
          entry = { model, person: { x: m.x, z: m.z, heading: m.heading, speed: 0, health: 100, idle: 1, height: 0, pose: null } };
          shown.set(p.key, entry);
        }
        animate(entry.person, p.member, t);
        entry.model.update(entry.person, dt);
        if (p.member.pose === 'ground') sitOnGround(entry.model.avatar);
      }
    },
    dispose() { for (const entry of shown.values()) root.remove(entry.model.avatar); shown.clear(); },
  };
}
// Sitting on a towel or blanket: the seated pose lowered to the ground, legs stretched out in front.
function sitOnGround(avatar) {
  avatar.getObjectByName('hips').position.y = 0.42;
  for (const side of ['left', 'right']) { avatar.getObjectByName(`${side}-hip`).rotation.x = -1.5; avatar.getObjectByName(`${side}-knee`).rotation.x = 0.08; }
}
// Poses on top of the street rig: sitting, chatting, kids hopping and turning, swimmers bobbing with their arms
// going, and dancers bouncing and swaying.
function animate(person, m, t) {
  const c = t + m.phase;
  person.pose = m.pose === 'sit' || m.pose === 'ground' ? 'sit' : m.pose === 'chat' || m.pose === 'dance' ? 'chat' : null;
  person.speed = 0; person.height = 0; person.heading = m.heading;
  if (m.pose === 'play') { person.height = Math.abs(Math.sin(c * 5)) * 0.45; person.speed = 3; person.heading = m.heading + Math.sin(c * 0.7) * 1.6; }
  if (m.pose === 'swim') { person.height = -3.55 + Math.sin(c * 1.6) * 0.12; person.speed = 1.6; person.heading = m.heading + c * 0.15; }
  if (m.pose === 'dance') { person.height = Math.abs(Math.sin(c * 4.2)) * 0.18; person.speed = 1.2; person.heading = m.heading + Math.sin(c * 2.1) * 0.5; }
}
