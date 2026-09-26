import * as THREE from 'three';
import { airTraffic } from '../../models/worldTour/airTraffic.js';

// Aircraft drawn from boxes (no third-party models): the airliner and cruising jets, the news and tour helicopters
// (airTraffic.js, on the shared clock) and the police helicopters of a four- or five-star pursuit (policeAir.js), with
// spinning rotors, blinking beacons, red and blue light bars and a searchlight beam that lights up the suspect.
const LIVERY = { news: ['#d9463b', '#f4f1ea'], tour: ['#f2c14e', '#2f3a44'], police: ['#1d2c4a', '#f4f5f2'] };

export function buildAircraft(root, kit, { color, geometries }) {
  const models = new Map(), glass = '#26394a';
  const lamp = hex => new THREE.MeshBasicMaterial({ color: hex });
  const materials = [lamp('#ff3b3b'), lamp('#3bff6a'), lamp('#ff3b52'), lamp('#3b7bff')];
  const [red, green, policeRed, policeBlue] = materials;
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spotMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.push(beamMaterial, spotMaterial);
  const beamGeometry = new THREE.ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0), spotGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  geometries.add(beamGeometry); geometries.add(spotGeometry);
  const light = (parent, material, position, size = 0.5) => { const m = kit.box([size, size, size], '#ffffff', position, parent); m.material = material; return m; };

  function airliner(scale = 1) {
    const group = new THREE.Group(), body = new THREE.Group(); body.position.y = 3.4; body.scale.setScalar(scale); group.add(body);
    kit.box([3.4, 3.6, 30], '#f4f5f2', [0, 0, 0], body); kit.box([2.8, 2.7, 3], '#f4f5f2', [0, -0.3, 16], body);
    kit.box([2.4, 0.6, 1.2], glass, [0, 0.9, 15.8], body);
    for (const side of [-1, 1]) kit.box([0.08, 0.35, 22], '#2f3a44', [side * 1.72, 0.7, 0], body);
    kit.box([3.46, 0.55, 26], color, [0, -0.6, 0], body);
    kit.box([30, 0.5, 5.5], '#cfd4d8', [0, -0.9, 1], body);
    for (const side of [-1, 1]) kit.box([1.6, 1.6, 4], '#9aa3ab', [side * 6.5, -2.1, 2.8], body);
    kit.box([0.5, 6, 4.5], color, [0, 4, -13], body); kit.box([11, 0.4, 3], '#cfd4d8', [0, 1.2, -13.5], body);
    const gear = [[0, -2.6, 11], [-3, -2.6, 0], [3, -2.6, 0]].map(p => kit.box([0.6, 1.6, 0.6], '#2b3037', p, body));
    const beacon = light(body, red, [0, 2, 0]);
    light(body, red, [-15, -0.9, 1], 0.4); light(body, green, [15, -0.9, 1], 0.4);
    return { group, gear, beacons: [beacon] };
  }
  function helicopter(livery) {
    const [paint, trim] = LIVERY[livery] || LIVERY.news, group = new THREE.Group();
    kit.box([2.6, 2.4, 5], paint, [0, 0, 0], group); kit.box([2.64, 0.5, 5.04], trim, [0, -0.4, 0], group);
    kit.box([2.4, 1.8, 2], glass, [0, 0.2, 2.3], group);
    kit.box([0.6, 0.6, 6.5], paint, [0, 0.4, -5.5], group); kit.box([0.3, 2, 1.4], paint, [0, 1.3, -8.6], group);
    for (const side of [-1, 1]) { kit.box([0.2, 0.2, 5], '#2b3037', [side * 1.2, -1.8, 0], group); for (const z of [-1.2, 1.2]) kit.box([0.15, 0.8, 0.15], '#2b3037', [side * 1.1, -1.3, z], group); }
    kit.box([0.3, 0.7, 0.3], '#2b3037', [0, 1.5, 0], group);
    const rotor = new THREE.Group(); rotor.position.set(0, 1.9, 0); group.add(rotor);
    kit.box([11, 0.08, 0.45], '#2b3037', [0, 0, 0], rotor); kit.box([0.45, 0.08, 11], '#2b3037', [0, 0, 0], rotor);
    const tail = new THREE.Group(); tail.position.set(0.35, 1.3, -8.6); group.add(tail);
    kit.box([0.08, 2.4, 0.3], '#2b3037', [0, 0, 0], tail);
    const beacons = [light(group, red, [0, -1.3, -2], 0.35)], bars = [];
    if (livery === 'police') { bars.push(light(group, policeRed, [-0.5, 1.35, 1.4], 0.4), light(group, policeBlue, [0.5, 1.35, 1.4], 0.4)); kit.box([0.5, 0.5, 0.6], '#dfe3e6', [0, -1.4, 2.2], group); }
    return { group, rotor, tail, beacons, bars };
  }
  function modelFor(id, make) {
    if (!models.has(id)) { const m = make(); root.add(m.group); models.set(id, m); }
    const m = models.get(id); m.seen = true; return m;
  }
  const beams = new Map();
  function beamFor(id) {
    if (!beams.has(id)) {
      const cone = new THREE.Mesh(beamGeometry, beamMaterial), spot = new THREE.Mesh(spotGeometry, spotMaterial);
      root.add(cone, spot); beams.set(id, { cone, spot });
    }
    const b = beams.get(id); b.seen = true; return b;
  }
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  function place(m, a) { m.group.position.set(a.x, a.y, a.z); m.group.rotation.set(-(a.pitch || 0), a.heading, a.bank || 0, 'YXZ'); }
  return {
    // `time` is the world clock in seconds; `night` is 0 (day) to 1.
    update(s, time, dt, night) {
      for (const m of models.values()) m.seen = false;
      for (const b of beams.values()) b.seen = false;
      const blink = Math.floor(time * 1.2) % 2 === 0, flash = Math.floor(time * 5) % 2;
      for (const a of airTraffic(time)) {
        const m = modelFor(a.id, () => a.kind === 'helicopter' ? helicopter(a.livery) : airliner(a.kind === 'jet' ? 1.3 : 1));
        place(m, a);
        if (m.gear) m.gear.forEach(g => { g.visible = a.y < 60; });
        if (m.rotor) { m.rotor.rotation.y += dt * 30; m.tail.rotation.x += dt * 40; }
        m.beacons.forEach(b => { b.visible = blink; });
      }
      // Police helicopters, tilting into their flight, with their searchlight on the ground below.
      for (const h of s.helicopters || []) {
        const m = modelFor(h.id, () => helicopter('police')), speed = Math.hypot(h.vx, h.vz);
        place(m, { x: h.x, y: h.y, z: h.z, heading: h.heading, pitch: -Math.min(0.28, speed / 110), bank: 0 });
        m.rotor.rotation.y += dt * 32; m.tail.rotation.x += dt * 42;
        m.bars[0].visible = flash === 0; m.bars[1].visible = flash === 1; m.beacons.forEach(b => { b.visible = blink; });
        if (h.light) {
          const b = beamFor(h.id), top = new THREE.Vector3(h.x, h.y - 1.4, h.z), ground = new THREE.Vector3(h.light.x, 0.3, h.light.z), length = top.distanceTo(ground);
          dir.subVectors(top, ground).normalize();
          b.cone.position.copy(top); b.cone.quaternion.setFromUnitVectors(up, dir); b.cone.scale.set(h.spotting ? 5 : 7, length, h.spotting ? 5 : 7);
          b.spot.position.copy(ground); b.spot.scale.setScalar(h.spotting ? 5.5 : 7.5);
          beamMaterial.opacity = 0.06 + night * 0.12; spotMaterial.opacity = 0.18 + night * 0.3;
        }
      }
      for (const [id, m] of models) m.group.visible = m.seen;
      for (const [id, b] of beams) { b.cone.visible = b.spot.visible = b.seen; if (!b.seen && !(s.helicopters || []).some(h => h.id === id)) { root.remove(b.cone, b.spot); beams.delete(id); } }
      for (const [id, m] of models) if (!m.seen && id.startsWith('heli-')) { root.remove(m.group); models.delete(id); }
    },
    dispose() { for (const m of models.values()) root.remove(m.group); for (const b of beams.values()) root.remove(b.cone, b.spot); models.clear(); beams.clear(); materials.forEach(m => m.dispose()); },
  };
}
