import * as THREE from 'three';

export function createCar(scene, kit, lighting, options = {}) {
  const { box, cylinder } = kit;
  const car = new THREE.Group(); scene.add(car);
  box([1.35, 0.46, 2.25], options.color || '#ed9167', [0, 0.48, 0], car);
  box([1.23, 0.2, 2.05], options.color || '#f4ab79', [0, 0.77, 0], car);
  box([1.08, 0.63, 1.05], options.police ? '#e3e8eb' : '#f9d3a2', [0, 1.08, -0.15], car);
  box([0.96, 0.43, 0.02], '#566b79', [0, 1.09, 0.386], car);
  box([0.96, 0.39, 0.02], '#71838a', [0, 1.09, -0.687], car);
  for (const x of [-0.547, 0.547]) box([0.018, 0.4, 0.78], '#617882', [x, 1.09, -0.15], car);
  box([1.18, 0.11, 1.16], options.police ? '#eef1f2' : '#f8e8c9', [0, 1.44, -0.15], car);
  for (const z of [-1.17, 1.17]) box([1.4, 0.16, 0.16], '#eee5d4', [0, 0.4, z], car);
  for (const x of [-0.46, 0.46]) {
    lighting.glow(box([0.27, 0.22, 0.045], '#fff4c9', [x, 0.64, 1.145], car), '#fff0c9', 3);
    lighting.glow(box([0.22, 0.16, 0.045], '#bf5e56', [x, 0.64, -1.145], car), '#ff533d', 1.5);
  }
  if (options.headlights !== false) {
  const headlights = new THREE.SpotLight('#fff0c9', 0, 24, Math.PI / 5, 0.55, 2);
  headlights.position.set(0, 1, 1.3); headlights.target.position.set(0, -0.4, 12);
  car.add(headlights, headlights.target); lighting.light(headlights, 120);
  }
  const wheels = [];
  for (const x of [-0.73, 0.73]) for (const z of [-0.72, 0.72]) {
    const wheel = cylinder(0.34, 0.34, 0.2, '#484652', [x, 0.33, z], car, 12);
    wheel.rotation.z = Math.PI / 2; wheels.push(wheel);
    cylinder(0.17, 0.17, 0.215, '#d9c9b1', [x, 0.33, z], car, 12).rotation.z = Math.PI / 2;
  }
  return { car, wheels };
}
