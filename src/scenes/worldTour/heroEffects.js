import * as THREE from 'three';
import { canUsePower } from '../../models/worldTour/heroPowers.js';

// A fixed pool: no particles, lights, materials or geometry are allocated during animation.
export function createHeroEffects(parent) {
  const group = new THREE.Group(); group.name = 'hero-effects'; parent.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: '#8eeaff', transparent: true, opacity: 0.75, depthWrite: false });
  const pieces = Array.from({ length: 24 }, () => { const mesh = new THREE.Mesh(geometry, material); group.add(mesh); return mesh; });
  return {
    update(s) {
      const p = s.player, kind = s.appearance?.kind, pulse = p.powerPulse, strike = p.kaijuPowerFx;
      const beam = strike && kind !== 'hulk' && s.time - strike.time < 0.4;
      const smash = kind === 'hulk' && pulse && s.time - pulse.time < 0.65;
      const active = p.powerActive && (kind === 'flash' ? p.speed > 2 : p.flying);
      group.visible = canUsePower(s) && !!(beam || smash || active);
      if (!group.visible) return;
      material.color.set(beam ? strike.color : smash ? '#9dff76' : kind === 'flash' ? '#ffd34e' : '#8eeaff');
      const age = smash ? Math.max(0, (s.time - pulse.time) / 0.65) : 0;
      material.opacity = beam ? Math.max(0, 1 - (s.time - strike.time) / 0.4) : smash ? 0.8 * (1 - age) : 0.65;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i], phase = i / pieces.length;
        piece.rotation.set(0, 0, 0);
        if (beam) {
          const a = strike.from, b = strike.to, segment = kind === 'superman' ? i % 12 : i, count = kind === 'superman' ? 12 : 24;
          const u = (segment + 0.5) / count, length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
          const offset = kind === 'flash' ? Math.sin(segment * 2.4) * 0.6 : kind === 'superman' ? (i < 12 ? -0.14 : 0.14) * (1 - u) : 0;
          piece.position.set(a.x + (b.x - a.x) * u + offset, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
          piece.lookAt(b.x, b.y, b.z);
          const width = kind === 'ironman' ? 0.24 : 0.09;
          piece.scale.set(width, width, length / count + (kind === 'flash' ? 0.6 : 0.03));
        } else if (smash) {
          const angle = phase * Math.PI * 2, radius = 1 + age * ((pulse.radius || 9) - 1);
          piece.position.set(pulse.x + Math.sin(angle) * radius, pulse.y + 0.18, pulse.z + Math.cos(angle) * radius);
          piece.rotation.y = angle; piece.scale.set(radius * 0.25, 0.12 * (1 - age) + 0.02, 0.12);
        } else if (kind === 'ironman') {
          const foot = i % 2 ? 1 : -1, fall = (phase + s.time * 2) % 1;
          piece.position.set(p.x + Math.cos(p.heading) * foot * 0.25, p.height + 0.15 - fall * 1.8, p.z - Math.sin(p.heading) * foot * 0.25);
          piece.scale.set(0.09 * (1 - fall), 0.22, 0.09 * (1 - fall));
        } else {
          const tail = (phase + s.time * 1.4) % 1, side = Math.sin(i * 7.3) * 0.6;
          piece.position.set(p.x - Math.sin(p.heading) * tail * 5 + Math.cos(p.heading) * side, p.height + 0.4 + (i % 5) * 0.45, p.z - Math.cos(p.heading) * tail * 5 - Math.sin(p.heading) * side);
          piece.rotation.y = p.heading; piece.rotation.z = kind === 'flash' ? Math.sin(i * 4) * 0.6 : 0;
          piece.scale.set(0.045, 0.045, (1 - tail) * 0.9 + 0.08);
        }
      }
    },
    dispose() { parent.remove(group); geometry.dispose(); material.dispose(); },
  };
}
