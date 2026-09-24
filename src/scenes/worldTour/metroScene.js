import * as THREE from 'three';
import { METRO, STATIONS, loopPoint, metroPillars } from '../../models/worldTour/metro.js';

// The elevated metro: a concrete viaduct on pillars in the alleys, a station with platforms, canopy and stairs wherever
// it bridges a central avenue, and a four-car train that follows the timetable in metro.js (driven by `train`).
export function buildMetro(root, { box, glowMaterial, label }) {
  const deck = METRO.deck, trackGlow = glowMaterial('#d5dde0', 0.5, '#9fd6ff');
  for (let s = 0; s < 1440; s += 10) {
    const p = loopPoint(s + 5);
    box([p.heading === 0 || p.heading === Math.PI ? 4.2 : 10.4, 0.8, p.heading === 0 || p.heading === Math.PI ? 10.4 : 4.2], '#b9bfbd', [p.x, deck - 0.4, p.z]);
    for (const side of [-1, 1]) {
      const along = p.heading === 0 || p.heading === Math.PI, ox = along ? side * 2 : 0, oz = along ? 0 : side * 2;
      box(along ? [0.2, 0.9, 10.4] : [10.4, 0.9, 0.2], '#9aa19f', [p.x + ox, deck + 0.45, p.z + oz]);
    }
  }
  for (const p of metroPillars()) { box([1.5, deck - 0.8, 1.5], '#a8aeac', [p.x, (deck - 0.8) / 2, p.z]); box([3.8, 0.8, 3.8], '#a8aeac', [p.x, deck - 1.2, p.z]); }
  for (const st of STATIONS) {
    const along = st.z === 0 ? 'z' : 'x', w = along === 'x' ? [36, 0.5, 3] : [3, 0.5, 36];
    for (const side of [-1, 1]) {
      const ox = along === 'x' ? 0 : side * 3.6, oz = along === 'x' ? side * 3.6 : 0;
      box(w, '#c9ceca', [st.x + ox, deck - 0.2, st.z + oz]);
      box(along === 'x' ? [36, 0.3, 0.12] : [0.12, 0.3, 36], '#f2c14e', [st.x + ox * 0.62, deck + 0.08, st.z + oz * 0.62]);
      // Stair towers down to the pavement (solid in physics).
      const tx = st.x + (along === 'x' ? side * 16 : 0), tz = st.z + (along === 'z' ? side * 16 : 0);
      box(along === 'x' ? [3, deck, 6] : [6, deck, 3], '#8f9a9c', [tx, deck / 2, tz]);
      box(along === 'x' ? [3.2, 0.4, 6.2] : [6.2, 0.4, 3.2], '#2f6fb0', [tx, deck + 0.2, tz]);
    }
    box(along === 'x' ? [38, 0.4, 11] : [11, 0.4, 38], '#e4e8e6', [st.x, deck + 4.6, st.z]);
    box(along === 'x' ? [38, 0.3, 0.3] : [0.3, 0.3, 38], '#9fd6ff', [st.x, deck + 4.3, st.z], 0, trackGlow);
    label(`M  ${st.name.toUpperCase()}`, st.x + (along === 'z' ? 7 : 0), st.z + (along === 'x' ? 7 : 0), '#9fd6ff', deck + 7, 1.2);
  }
  // The train: four cars with lit windows, each placed between its front and rear points on the loop so it rounds
  // corners smoothly.
  const cars = [], body = new THREE.MeshStandardMaterial({ color: '#e9eef0', roughness: 0.5 }), stripe = new THREE.MeshStandardMaterial({ color: '#2f6fb0', roughness: 0.5 });
  const windows = glowMaterial('#35424a', 1.2, '#ffe9b8'), unit = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < METRO.cars; i++) {
    const car = new THREE.Group();
    const add = (m, size, pos) => { const mesh = new THREE.Mesh(unit, m); mesh.scale.set(...size); mesh.position.set(...pos); car.add(mesh); };
    add(body, [3, 3, METRO.carLength], [0, 1.9, 0]); add(stripe, [3.05, 0.5, METRO.carLength], [0, 1.1, 0]);
    for (const side of [-1, 1]) add(windows, [0.1, 1, METRO.carLength - 2], [side * 1.52, 2.4, 0]);
    add(body, [2.6, 0.3, METRO.carLength - 1], [0, 3.5, 0]);
    root.add(car); cars.push(car);
  }
  return {
    update(train) {
      cars.forEach((car, i) => {
        const head = train.s - i * (METRO.carLength + METRO.gap), a = loopPoint(head), b = loopPoint(head - METRO.carLength);
        car.position.set((a.x + b.x) / 2, deck, (a.z + b.z) / 2); car.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
      });
    },
    dispose() { body.dispose(); stripe.dispose(); unit.dispose(); cars.forEach(car => root.remove(car)); },
  };
}
