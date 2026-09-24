import * as THREE from 'three';
import { createCharacter } from '../shared/character.js';
import { playerLook } from '../../models/worldTour/characterProfile.js';

// A small turntable scene for the character creator: the same rig the game uses, idling, rebuilt on every change.
export function mountCharacterPreview(host, onError) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 2.2, 9.5); camera.lookAt(0, 1.75, 0);
  scene.add(new THREE.HemisphereLight('#fff2df', '#54647f', 2.3));
  const sun = new THREE.DirectionalLight('#ffd7b0', 2.6); sun.position.set(-4, 8, 6); scene.add(sun);
  const geometry = new THREE.BoxGeometry(1, 1, 1), materials = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); return materials.get(color); };
  const kit = { box(size, color, position, parent) { const mesh = new THREE.Mesh(geometry, material(color)); mesh.scale.set(...size); mesh.position.set(...position); parent.add(mesh); return mesh; } };
  const turntable = new THREE.Group(); scene.add(turntable);
  const plinthGeometry = new THREE.CylinderGeometry(1.6, 1.75, 0.3, 40);
  const plinth = new THREE.Mesh(plinthGeometry, material('#2b4150')); plinth.position.y = -0.15; turntable.add(plinth);
  let character = null, rig = null, spin = 0.5, dragging = null, velocity = 0.35, lost = false;
  const idle = { x: 0, z: 0, heading: 0, height: 0, speed: 0, waveTime: 0 };
  function build(appearance) {
    if (rig) turntable.remove(rig.avatar);
    rig = createCharacter(turntable, kit, { ...appearance, scale: playerLook(appearance).scale });
    rig.avatar.visible = true;
  }
  function resize() { const w = host.clientWidth, h = Math.max(1, host.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  // Drag to turn the model; it keeps a gentle spin when released.
  const down = e => { dragging = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); };
  const move = e => { if (dragging === null) return; spin += (e.clientX - dragging) * 0.012; velocity = (e.clientX - dragging) * 0.4; dragging = e.clientX; };
  const up = () => { dragging = null; velocity = Math.max(-2, Math.min(2, velocity)) || 0.35; };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up);
  const contextLost = event => { event.preventDefault(); lost = true; onError?.(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  let last = 0;
  renderer.setAnimationLoop(time => {
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0; last = time;
    if (lost || !rig) return;
    if (dragging === null) { velocity += (Math.sign(velocity || 1) * 0.35 - velocity) * Math.min(1, dt * 2); spin += velocity * dt; }
    turntable.rotation.y = spin;
    rig.update(idle, dt); rig.avatar.position.y = 0;
    renderer.render(scene, camera);
  });
  return {
    update(appearance) { const key = JSON.stringify(appearance); if (key !== character) { character = key; build(appearance); } },
    dispose() {
      renderer.setAnimationLoop(null); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometry.dispose(); plinthGeometry.dispose(); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
