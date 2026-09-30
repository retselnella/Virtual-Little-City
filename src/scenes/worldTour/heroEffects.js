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
      const p = s.player, kind = s.appearance?.kind, pulse = p.powerPulse;
      const smash = kind === 'hulk' && pulse && s.time - pulse.time < 0.65;
      const active = p.powerActive && (kind === 'flash' ? p.speed > 2 : p.flying);
      group.visible = canUsePower(s) && !!(smash || active);
      if (!group.visible) return;
      material.color.set(smash ? '#9dff76' : kind === 'flash' ? '#ffd34e' : '#8eeaff');
      const age = smash ? Math.max(0, (s.time - pulse.time) / 0.65) : 0;
      material.opacity = smash ? 0.8 * (1 - age) : 0.65;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i], phase = i / pieces.length;
        piece.rotation.set(0, 0, 0);
        if (smash) {
          const angle = phase * Math.PI * 2, radius = 1 + age * 8;
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
