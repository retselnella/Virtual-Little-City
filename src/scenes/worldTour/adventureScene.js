import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCharacter } from '../shared/character.js';
import { createCar } from '../shared/car.js';
import { createStreetNpc } from '../shared/streetNpc.js';
import { ROADS, actor, objectivePoint, stepWorld, targetFor } from '../../models/worldTour/worldAdventure.js';
import { ACTIVE_UNIT } from '../../models/worldTour/worldPolice.js';
import { vehicleSpec, wheelLayout } from '../../models/worldTour/physicsEngine.js';
import { sceneryLayout } from '../../models/worldTour/worldLayout.js';
import { dueActions, visiblePlayers } from '../../models/worldTour/multiplayer.js';
import { createRagdollRig } from '../shared/ragdollRig.js';

const BLOOD_DROPS = 360, BLOOD_POOLS = 160;
const OFFICER_SKIN = ['#e8bd98', '#c18b63', '#8d5a3b', '#5f3b28'];

// `remote` (optional) is the multiplayer roster ref from useMultiplayer: other players are drawn as ghosts.
export function mountAdventure(host, session, input, paused, onUpdate, onError, remote = null) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Open world game. WASD to move, F to enter your car, J to attack, E to interact.'); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.2, 1500);
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enablePan = false; orbit.enableDamping = true; orbit.minDistance = 12; orbit.maxDistance = 160; orbit.maxPolarAngle = Math.PI / 2.25;
  const hemisphere = new THREE.HemisphereLight('#fff2df', '#54647f', 2.4); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffd7b0', 3); sun.position.set(-90, 160, 100); scene.add(sun);
  let root, avatar, playerCar, marker, targetRing, dynamic, traffic = [], patrols = [], pedestrians = [], lastTime = 0, uiTime = 0, lastCity, shotLines = [], remoteShots = [], night = false;
  let muzzle, bloodDrops, bloodPools, drops = [], pools = [], poolCursor = 0, lastImpact = 0, shake = 0;
  const shakeOffset = new THREE.Vector3(), matrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0), bloodDummy = new THREE.Object3D();
  let postPoles, postLamps;
  const layout = sceneryLayout(), lean = new THREE.Quaternion(), forwardAxis = new THREE.Vector3(0, 0, 1);
  const bodyMatrix = new THREE.Matrix4(), partOffset = new THREE.Matrix4(), partWorld = new THREE.Matrix4(), partLocal = new THREE.Matrix4();
  const tmpPosition = new THREE.Vector3(), tmpQuaternion = new THREE.Quaternion(), tmpScale = new THREE.Vector3();
  const enemies = new Map(), geometries = new Set(), materials = new Map(), textures = new Set();
  const unitBox = new THREE.BoxGeometry(1, 1, 1); geometries.add(unitBox);
  function material(color) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); return materials.get(color); }
  const kit = {
    box(size, color, position, parent = root) { const mesh = new THREE.Mesh(unitBox, material(color)); mesh.scale.set(...size); mesh.position.set(...position); parent.add(mesh); return mesh; },
    cylinder(top, bottom, height, color, position, parent = root, sides = 8) { const geometry = new THREE.CylinderGeometry(top, bottom, height, sides); geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(...position); parent.add(mesh); return mesh; },
  };
  const glow = { glow() {}, light() {} };
  function disposeCity() {
    for (const id of [...remotes.keys()]) removeRemote(id);
    if (root) { root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); scene.remove(root); }
    geometries.forEach(g => { if (g !== unitBox) { g.dispose(); geometries.delete(g); } });
    textures.forEach(t => t.dispose()); textures.clear();
    for (const [key, mat] of materials) if (key.startsWith('label-')) { mat.dispose(); materials.delete(key); }
    enemies.clear(); traffic = []; patrols = []; pedestrians = []; drops = []; pools = []; poolCursor = 0;
    shotLines.forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); }); shotLines = []; remoteShots = [];
  }
  function build(city) {
    disposeCity(); lastCity = city.id; root = new THREE.Group(); scene.add(root); dynamic = new THREE.Group(); root.add(dynamic);
    scene.background = new THREE.Color(city.sky); scene.fog = new THREE.Fog(city.sky, 180, 800); night = city.id === 'tokyo'; hemisphere.intensity = night ? 1.5 : 2.4; sun.intensity = night ? 0.8 : 3;
    const batches = new Map();
    function box(size, color, position, rotation = 0) { if (!batches.has(color)) batches.set(color, []); batches.get(color).push({ size, position, rotation }); }
    box([2400, 1, 2400], '#4c91a1', [0, -3, 0]); box([910, 2, 910], city.ground, [0, -1.1, 0]); box([30, 0.3, 910], '#e5c79e', [455, -0.1, 0]);
    for (const road of ROADS) {
      box([21, 0.15, 880], '#36424c', [road, 0.05, 0]); box([880, 0.15, 21], '#36424c', [0, 0.06, road]);
      for (const side of [-1, 1]) { box([3, 0.3, 870], '#bac0b9', [road + side * 12, 0.1, 0]); box([870, 0.3, 3], '#bac0b9', [0, 0.1, road + side * 12]); }
      for (let n = -420; n <= 420; n += 16) { box([0.2, 0.03, 6], '#e8d8b0', [road, 0.15, n]); box([6, 0.03, 0.2], '#e8d8b0', [n, 0.16, road]); }
    }
    for (const b of session.current.blocks) {
      box([b.width + 3, 0.5, b.depth + 3], '#a6aca8', [b.x, 0.2, b.z]);
      box([b.width, b.height, b.depth], b.color, [b.x, b.height / 2, b.z]);
      box([b.width + 1, 0.8, b.depth + 1], '#d6d3c4', [b.x, b.height, b.z]);
      box([b.width * 0.4, 2, b.depth * 0.3], '#69797b', [b.x, b.height + 1, b.z]);
      const front = b.z + b.depth / 2 + 0.15;
      box([b.width - 5, 3.3, 0.3], '#314b58', [b.x, 1.9, front]);
      box([b.width - 3, 0.35, 2.5], city.color, [b.x, 3.8, front + 0.9]);
      for (let x = -b.width / 2 + 4; x < b.width / 2; x += 5) box([0.28, b.height - 3, 0.3], b.color, [b.x + x, b.height / 2 + 1, front]);
      for (let y = 5; y < b.height - 2; y += 7) for (const side of [-1, 1]) {
        box([b.width - 4, 2.4, 0.1], night ? '#9caaca' : '#587b88', [b.x, y, b.z + side * (b.depth / 2 + 0.08)]);
        box([0.1, 2.4, b.depth - 4], '#688c98', [b.x + side * (b.width / 2 + 0.08), y, b.z]);
      }
      if (night) box([b.width, 0.6, 0.4], city.color, [b.x, 3.4, b.z + b.depth / 2 + 0.3]);
      if (city.id === 'dubai' && b.height > 70) box([1.5, 25, 1.5], '#c3ced1', [b.x, b.height + 12, b.z]);
    }
    for (const tree of layout.trees) {
      if (tree.edge) {
        box([0.7, 10, 0.7], '#827362', [tree.x, 5, tree.z]);
        if (city.trees === 'palm') for (let a = 0; a < 5; a++) box([12, 0.6, 2.4], '#537e63', [tree.x, 10, tree.z], a * Math.PI / 5);
        else box([8, 7, 8], city.trees === 'cherry' ? '#d39eae' : '#668766', [tree.x, 11, tree.z]);
      } else {
        box([0.6, 8, 0.6], '#8b7f68', [tree.x, 4, tree.z]);
        if (city.trees === 'palm') for (let a = 0; a < 4; a++) box([8, 0.4, 1.6], '#547f68', [tree.x, 8, tree.z], a * Math.PI / 4);
        else box([5, 5, 5], city.trees === 'cherry' ? '#dca8bd' : '#648567', [tree.x, 8, tree.z]);
      }
    }
    // Street spots: food stalls (awning in the city colour), bus shelters, benches. Pedestrians use their slots.
    const SPOT_COLORS = { cart: '#c9b89a', counter: '#e9dcc4', pole: '#5c6770', awning: city.color, panel: '#9fc3cc', roof: '#dfe5e6', seat: '#8a6a4b', backrest: '#8a6a4b', leg: '#4d555c', sign: '#5c6770', plate: '#2f6fb0' };
    for (const spot of layout.spots) for (const prop of spot.props) box([prop.size[0], prop.height, prop.size[1]], SPOT_COLORS[prop.kind], [prop.x, prop.y, prop.z]);
    // A coastal promenade and an airport at the edge of every district.
    box([7, 0.3, 875], '#d5c7b5', [425, 0, 0]); box([21, 0.1, 220], '#53616b', [-413, 0.1, -200]);
    for (let z = -300; z < -100; z += 20) box([1, 0.05, 10], '#f1ebd2', [-413, 0.2, z]);
    box([4, 3, 28], '#e0e5e3', [-413, 3, -190]); box([30, 0.6, 5], '#e0e5e3', [-413, 3, -192]);
    box([11, 0.4, 3], '#e0e5e3', [-413, 4, -202]);
    box([10, 0.1, 9], '#5ca699', [8, 0.3, 12]);
    const dummy = new THREE.Object3D();
    for (const [color, entries] of batches) {
      const mesh = new THREE.InstancedMesh(unitBox, material(color), entries.length);
      entries.forEach((e, i) => { dummy.position.set(...e.position); dummy.scale.set(...e.size); dummy.rotation.set(0, e.rotation, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }); mesh.computeBoundingSphere(); root.add(mesh);
    }
    // Lamp posts are physics props that a fast car can knock over, so they are instanced separately.
    postPoles = new THREE.InstancedMesh(unitBox, material('#596773'), layout.posts.length); postLamps = new THREE.InstancedMesh(unitBox, material('#fff0b9'), layout.posts.length);
    postPoles.frustumCulled = postLamps.frustumCulled = false; root.add(postPoles, postLamps);
    layout.posts.forEach((post, i) => placePost(i, { x: post.x, y: 4, z: post.z, q: [0, 0, 0, 1] }));
    function label(text, x, z, color) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#142634'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = color; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 80, 480);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      const mat = new THREE.SpriteMaterial({ map: texture }); materials.set('label-' + text, mat); const sprite = new THREE.Sprite(mat); sprite.position.set(x, 6, z); sprite.scale.set(8, 2, 1); root.add(sprite);
    }
    label('SAFEHOUSE', 8, 12, '#86edcb'); label(city.district.toUpperCase(), 0, -32, city.color); label('AIRPORT', -413, -110, '#ffffff');
    buildAvatar(session.current.appearance);
    // Pooled blood droplets and ground stains, updated as instances.
    if (!materials.has('blood')) { materials.set('blood', new THREE.MeshStandardMaterial({ color: '#7b0913', roughness: 0.35 })); materials.set('blood-pool', new THREE.MeshStandardMaterial({ color: '#4f050c', roughness: 0.18, metalness: 0.05 })); }
    bloodDrops = new THREE.InstancedMesh(unitBox, materials.get('blood'), BLOOD_DROPS); bloodDrops.frustumCulled = false; bloodDrops.count = 0; root.add(bloodDrops);
    const poolGeometry = new THREE.CylinderGeometry(1, 1, 0.02, 14); geometries.add(poolGeometry);
    bloodPools = new THREE.InstancedMesh(poolGeometry, materials.get('blood-pool'), BLOOD_POOLS); bloodPools.frustumCulled = false; bloodPools.count = 0; root.add(bloodPools);
    lastImpact = session.current.impactSeq || 0;
    playerCar = createCar(root, kit, glow, { color: '#67dccc', headlights: false }); playerCar.car.scale.setScalar(1.7);
    for (let i = 0; i < session.current.traffic.length; i++) {
      const model = createCar(root, kit, glow, { color: ['#dba186', '#d0c9bb', '#798bac', '#bc7d94', '#e6d27a', '#8fb89a', '#f2f0ea', '#3b4450'][i % 8], headlights: false }); model.car.scale.setScalar(1.5);
      traffic.push(model);
    }
    for (let i = 0; i < session.current.policeCars.length; i++) {
      const model = createCar(root, kit, glow, { color: '#24394e', police: true, headlights: false }); model.car.scale.setScalar(1.7);
      for (const side of [-1, 1]) { kit.box([0.03, 0.4, 1.2], '#e5eaec', [side * 0.69, 0.6, -0.1], model.car); kit.box([0.04, 0.2, 0.18], '#d7b96b', [side * 0.71, 0.6, -0.1], model.car); }
      kit.box([1.1, 0.1, 0.3], '#142937', [0, 1.55, -0.1], model.car);
      model.lights = [-1, 1].map(side => kit.box([0.43, 0.18, 0.28], side < 0 ? '#ff4966' : '#438aff', [side * 0.28, 1.68, -0.1], model.car));
      model.lights.forEach(light => { light.material.emissive.copy(light.material.color); light.material.emissiveIntensity = 2; });
      patrols.push(model);
    }
    for (const person of session.current.pedestrians) { const model = createStreetNpc(root, kit, { shirt: person.look?.shirt, role: person.role, look: person.look }); model.rig = createRagdollRig(model.avatar, 'npc'); pedestrians.push(model); }
    const markerGeo = new THREE.OctahedronGeometry(2.8); geometries.add(markerGeo); marker = new THREE.Mesh(markerGeo, material('#f8d47a')); root.add(marker);
    if (!materials.has('lock')) materials.set('lock', new THREE.MeshBasicMaterial({ color: '#ff727f' }));
    const ringGeo = new THREE.TorusGeometry(2.2, 0.12, 6, 24); geometries.add(ringGeo); targetRing = new THREE.Mesh(ringGeo, materials.get('lock')); targetRing.rotation.x = Math.PI / 2; root.add(targetRing);
    const p = actor(session.current); camera.position.set(p.x, 11, p.z + 24); orbit.target.set(p.x, 1.8, p.z); orbit.update();
  }
  // The player's look comes from the character creator; editing it mid-game rebuilds the avatar in place.
  let avatarLook;
  function buildAvatar(appearance) {
    if (avatar) root.remove(avatar.avatar);
    avatarLook = appearance;
    avatar = createCharacter(root, kit, { shirt: '#e5ded5', ...appearance, scale: session.current.player.look?.scale || 1 }); avatar.avatar.visible = true; avatar.rig = createRagdollRig(avatar.avatar, 'player');
    muzzle = addPistol(avatar.avatar).muzzle;
  }
  // A pistol in the right hand with a hidden muzzle flash (the player's avatar and other players' ghosts).
  function addPistol(body) {
    const gun = kit.box([0.16, 0.22, 0.65], '#25303c', [0, -0.16, 0.23], body.getObjectByName('right-hand')); gun.name = 'pistol';
    if (!materials.has('muzzle')) materials.set('muzzle', new THREE.MeshBasicMaterial({ color: '#ffe7a3' }));
    const flash = new THREE.Mesh(unitBox, materials.get('muzzle')); flash.scale.set(2.2, 1.6, 0.9); flash.position.set(0, 0, 0.75); flash.visible = false; gun.add(flash);
    return { gun, muzzle: flash };
  }
  // ---- Other players (multiplayer ghosts): their own look, a name tag, and a car model while they drive.
  const remotes = new Map(), REMOTE_CARS = ['#f2c14e', '#e76f51', '#8ab17d', '#9d8df1', '#ef8fb1', '#5fa8d3'];
  function nameTag(text) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#142634d9'; ctx.fillRect(0, 8, 256, 48); ctx.fillStyle = '#9ee8d1'; ctx.fillRect(0, 8, 6, 48);
    ctx.fillStyle = '#f3eee5'; ctx.font = 'bold 26px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 131, 41, 236);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); sprite.scale.set(3.6, 0.9, 1); sprite.renderOrder = 5; return sprite;
  }
  function createRemote(id, profile, key) {
    const rig = createCharacter(root, kit, { ...profile.look, scale: profile.scale }); rig.avatar.visible = true;
    const { gun, muzzle: flash } = addPistol(rig.avatar);
    const hash = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const car = createCar(root, kit, glow, { color: REMOTE_CARS[hash % REMOTE_CARS.length], headlights: false }); car.car.scale.setScalar(1.7); car.car.visible = false;
    const tag = nameTag(profile.name); root.add(tag);
    const model = { rig, car, tag, key, gun, flash, punchTime: 0, combo: 0, fired: 0 }; remotes.set(id, model); return model;
  }
  function removeRemote(id) {
    const model = remotes.get(id); if (!model) return;
    root.remove(model.rig.avatar, model.car.car, model.tag); model.tag.material.map.dispose(); model.tag.material.dispose(); remotes.delete(id);
  }
  function updateRemotes(s, dt) {
    if (!remote?.current) return;
    const seen = new Set();
    const now = performance.now();
    remoteShots = remoteShots.filter(shot => (shot.ttl -= dt) > 0);
    for (const { id, player, profile, pose } of visiblePlayers(remote.current, actor(s), now)) {
      seen.add(id);
      const key = JSON.stringify(profile);
      let model = remotes.get(id);
      if (!model || model.key !== key) { removeRemote(id); model = createRemote(id, profile, key); }
      model.rig.avatar.visible = !pose.d; model.car.car.visible = pose.d;
      model.punchTime = Math.max(0, model.punchTime - dt); model.fired = Math.max(0, model.fired - dt);
      for (const action of dueActions(player, now)) playRemoteAction(s, model, pose, action);
      if (pose.d) {
        model.car.car.position.set(pose.x, pose.y, pose.z); model.car.car.quaternion.set(...pose.q);
        model.car.wheels.forEach(wheel => { wheel.rotation.x += pose.s * dt / 0.55; });
      } else {
        model.rig.update({ x: pose.x, z: pose.z, heading: pose.h, height: pose.y, speed: pose.s, waveTime: 0 }, dt);
        model.rig.avatar.position.y = 0.2 * profile.scale + pose.y;
        if (!pose.k) poseArms(model.rig.avatar, pose.w, pose.a, model.punchTime, model.combo, model.fired / 0.12);
      }
      model.gun.visible = pose.w; model.flash.visible = pose.w && model.fired > 0.07;
      model.tag.position.set(pose.x, pose.y + (pose.d ? 3.6 : 4.2 * profile.scale), pose.z);
    }
    for (const id of [...remotes.keys()]) if (!seen.has(id)) removeRemote(id);
  }
  // Another player's attack: the punch or recoil on their ghost, a tracer for shots, and blood where it landed.
  function playRemoteAction(s, model, pose, action) {
    if (pose.d) return;
    const dx = action.x - pose.x, dz = action.z - pose.z, d = Math.hypot(dx, dz) || 1;
    if (action.kind === 'punch') { model.punchTime = 0.28; model.combo = action.combo; }
    else { model.fired = 0.12; remoteShots.push({ x: pose.x, z: pose.z, tx: action.x, tz: action.z, ttl: 0.12 }); }
    if (action.blood && s.blood !== false) spray({ kind: action.kind, x: action.x, z: action.z, y: action.kind === 'punch' ? 2.6 : 2.2, dx: dx / d, dz: dz / d, power: action.kind === 'punch' ? 0.8 + action.combo * 0.3 : 1 });
  }
  const follow = new THREE.Vector3(), shift = new THREE.Vector3();
  const nearCamera = person => (person.x - orbit.target.x) ** 2 + (person.z - orbit.target.z) ** 2 < 240 * 240;
  // Cars take their full pose from Rapier: chassis position/orientation, wheel spin, steering and suspension travel.
  function updateCar(model, body) {
    model.car.position.set(body.x, (body.y || 0) + Math.sin(body.impact * 9) * body.impact * 0.06, body.z);
    if (body.q) model.car.quaternion.set(...body.q); else model.car.rotation.set(0, body.heading, 0);
    // A light cosmetic lean into corners on top of the simulated suspension.
    model.car.quaternion.multiply(lean.setFromAxisAngle(forwardAxis, Math.max(-0.08, Math.min(0.08, (body.yawRate || 0) * (body.speed || 0) * 0.004))));
    const scale = vehicleSpec(body).scale, rest = wheelLayout(scale).y;
    model.wheels.forEach((wheel, index) => {
      const w = body.wheels?.[index]; if (!w) return;
      wheel.rotation.x = w.rotation; wheel.rotation.y = w.steer; wheel.position.y = (rest - w.suspension) / scale;
    });
    const hood = model.car.children[1]; hood.scale.y = 0.2 * (1 - body.damage * 0.003);
  }
  function placePost(i, prop) {
    tmpPosition.set(prop.x, prop.y, prop.z); tmpQuaternion.set(...prop.q);
    bodyMatrix.compose(tmpPosition, tmpQuaternion, tmpScale.set(1, 1, 1));
    postPoles.setMatrixAt(i, partWorld.multiplyMatrices(bodyMatrix, partOffset.makeScale(0.3, 8, 0.3)));
    postLamps.setMatrixAt(i, partWorld.multiplyMatrices(bodyMatrix, partOffset.makeTranslation(-1, 4, 0).multiply(partLocal.makeScale(3, 0.3, 1))));
    postPoles.instanceMatrix.needsUpdate = postLamps.instanceMatrix.needsUpdate = true;
  }
  // Ground height under a point: sidewalk kerbs, road surface or grass.
  function surfaceY(x, z) {
    if (ROADS.some(r => Math.abs(Math.abs(x - r) - 12) < 1.6 || Math.abs(Math.abs(z - r) - 12) < 1.6)) return 0.27;
    return ROADS.some(r => Math.abs(x - r) < 10.6 || Math.abs(z - r) < 10.6) ? 0.19 : -0.08;
  }
  function addPool(x, z, radius, delay, grow) { pools[poolCursor % BLOOD_POOLS] = { x, z, y: surfaceY(x, z) + (poolCursor % 7) * 0.003, radius, age: -delay, grow, life: 75 }; poolCursor++; }
  // Blood from punches, gunshots and vehicle hits: droplets arc under gravity and stain the ground where they land.
  function spray(hit) {
    if (hit.kind === 'pool') { addPool(hit.x + hit.dx * 0.9, hit.z + hit.dz * 0.9, 1.3 + Math.random() * 0.7, 0.8, 5); return; }
    const count = Math.round((hit.kind === 'car' ? 28 : hit.kind === 'punch' ? 16 : 12) * hit.power);
    for (let i = 0; i < count && drops.length < BLOOD_DROPS; i++) {
      const force = (hit.kind === 'car' ? 6 : 3) + Math.random() * 4;
      drops.push({ x: hit.x + (Math.random() - 0.5) * 0.4, y: hit.y + (Math.random() - 0.5) * 0.5, z: hit.z + (Math.random() - 0.5) * 0.4, vx: hit.dx * force + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 4, vz: hit.dz * force + (Math.random() - 0.5) * 3, size: 0.08 + Math.random() * 0.15 });
    }
    addPool(hit.x + hit.dx * 1.2, hit.z + hit.dz * 1.2, 0.3 + Math.random() * 0.35 * hit.power, 0.2, 0.3);
  }
  function updateBlood(dt) {
    drops = drops.filter(d => {
      d.vy -= 20 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y > surfaceY(d.x, d.z) + 0.05) return true;
      if (Math.random() < 0.35) addPool(d.x, d.z, 0.1 + d.size * 1.5, 0, 0.12);
      return false;
    });
    drops.forEach((d, i) => { bloodDummy.position.set(d.x, d.y, d.z); bloodDummy.scale.set(d.size, d.size * 1.6, d.size); bloodDummy.rotation.set(0, 0, 0); bloodDummy.updateMatrix(); bloodDrops.setMatrixAt(i, bloodDummy.matrix); });
    bloodDrops.count = drops.length; bloodDrops.instanceMatrix.needsUpdate = true;
    pools.forEach((pool, i) => {
      pool.age += dt;
      const size = pool.radius * Math.min(1, Math.max(0, pool.age) / pool.grow) * Math.min(1, Math.max(0, (pool.life - pool.age) / 4));
      if (size <= 0.001) { bloodPools.setMatrixAt(i, hidden); return; }
      matrix.makeScale(size, 1, size * 0.85).setPosition(pool.x, pool.y, pool.z); bloodPools.setMatrixAt(i, matrix);
    });
    bloodPools.count = pools.length; bloodPools.instanceMatrix.needsUpdate = true;
  }
  const elbowOf = arm => arm.children.find(child => child.isGroup);
  // Combat poses layered over the shared character animation: two-handed aim with recoil, boxing guard and punches.
  function posePlayer(s) {
    const shot = s.shots.find(x => !x.police);
    muzzle.visible = !!shot && shot.ttl > 0.07 && s.weapon === 'pistol';
    if (s.driving || s.down) return;
    const pistol = s.weapon === 'pistol';
    poseArms(avatar.avatar, pistol, s.aimTime > 0 || (pistol && input.current.attack), s.punchTime, s.combo, shot ? shot.ttl / 0.12 : 0);
  }
  function poseArms(body, pistol, aiming, punchTime, combo, recoil) {
    const right = body.getObjectByName('right-shoulder'), left = body.getObjectByName('left-shoulder');
    if (pistol && aiming) {
      right.rotation.set(-1.5 - recoil * 0.4, 0, 0.12); elbowOf(right).rotation.set(recoil * -0.3, 0, 0);
      left.rotation.set(-1.35, 0, 0.55); elbowOf(left).rotation.set(-0.35, 0, 0);
    } else if (!pistol && (aiming || punchTime > 0)) {
      for (const [arm, inward] of [[left, 1], [right, -1]]) { arm.rotation.set(-1.05, 0, inward * 0.3); elbowOf(arm).rotation.set(-1.9, 0, 0); }
      if (punchTime > 0) {
        const reach = Math.sin(Math.min(1, (1 - punchTime / 0.28) * 1.7) * Math.PI), arm = combo === 1 ? left : right, inward = arm === left ? 1 : -1;
        arm.rotation.x = -1.05 - reach * 0.55; elbowOf(arm).rotation.x = -1.9 * (1 - reach);
        if (combo === 2) arm.rotation.z = inward * (0.3 + reach * 0.7);
      }
    }
  }
  function resize() { camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const lost = event => { event.preventDefault(); onError(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.setAnimationLoop(time => {
    const s = session.current;
    if (lastCity !== s.city) build(s.cityInfo);
    else if (s.appearance !== avatarLook) buildAvatar(s.appearance);
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0; lastTime = time;
    const yaw = Math.atan2(orbit.target.x - camera.position.x, orbit.target.z - camera.position.z);
    if (!paused.current && !document.hidden) stepWorld(s, input.current, dt, yaw);
    const p = actor(s), point = objectivePoint(s), step = paused.current || document.hidden ? 0 : dt;
    avatar.avatar.visible = !s.driving; avatar.rig.before(s.player); avatar.update(s.player, paused.current ? 0 : dt); avatar.avatar.position.y = 0.2 * (s.player.look?.scale || 1) + s.player.height; avatar.avatar.getObjectByName('pistol').visible = s.weapon === 'pistol';
    posePlayer(s); avatar.rig.after(s.player, step);
    for (const hit of s.impacts) {
      if (hit.id <= lastImpact) continue;
      lastImpact = hit.id;
      if (hit.blood && s.blood !== false) spray(hit);
      if (hit.kind !== 'pool' && Math.hypot(hit.x - p.x, hit.z - p.z) < 7) shake = Math.min(0.6, shake + (hit.kind === 'car' ? 0.35 : hit.kind === 'punch' ? 0.22 * hit.power : 0.12));
    }
    updateBlood(step);
    updateRemotes(s, paused.current ? 0 : dt);
    updateCar(playerCar, s.car);
    s.props?.forEach((prop, i) => { if (prop.fallen) placePost(i, prop); });
    marker.visible = !!point; if (point) { marker.position.set(point.x, 6 + Math.sin(s.time * 2), point.z); marker.rotation.y = s.time; }
    for (const e of s.enemies) {
      if (!enemies.has(e.id)) {
        const hash = [...e.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
        const model = createStreetNpc(dynamic, kit, { shirt: e.kind === 'police' ? '#4366af' : '#b64e6d', armed: true, police: e.kind === 'police', look: { skin: OFFICER_SKIN[hash % 4], hairStyle: hash % 3 ? 'short' : 'cap', hair: '#221a16' } });
        const bar = kit.box([1.6, 0.15, 0.15], '#ff747b', [0, 3.7, 0], model.avatar); bar.name = 'health'; model.rig = createRagdollRig(model.avatar, 'npc'); enemies.set(e.id, model);
      }
      const model = enemies.get(e.id); model.rig.before(e); model.update(e, paused.current ? 0 : dt); model.rig.after(e, step); model.avatar.getObjectByName('health').visible = e.health > 0; model.avatar.getObjectByName('health').scale.x = Math.max(0.01, e.health / 100 * 1.6);
    }
    for (const [id, model] of enemies) if (!s.enemies.some(e => e.id === id)) { dynamic.remove(model.avatar); enemies.delete(id); }
    // The ring marks exactly who an attack would hit now; while driving it marks the nearest threat.
    const lock = s.driving ? s.enemies.filter(e => e.health > 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : targetFor(s);
    targetRing.visible = !!lock;
    if (lock) { targetRing.position.set(lock.x, 0.35, lock.z); targetRing.rotation.z = s.time * 2; targetRing.material.color.set(lock.kind === 'civilian' ? '#f3ece1' : '#ff727f'); }
    shotLines.forEach(line => { root.remove(line); line.geometry.dispose(); line.material.dispose(); });
    shotLines = [...s.shots, ...remoteShots].map(shot => { const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(shot.x, 2.1, shot.z), new THREE.Vector3(shot.tx, 2, shot.tz)]); const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: shot.police ? '#ff7881' : '#fff4b0' })); root.add(line); return line; });
    traffic.forEach((model, i) => updateCar(model, s.traffic[i]));
    patrols.forEach((model, i) => {
      const car = s.policeCars[i]; updateCar(model, car);
      model.lights.forEach((light, side) => { light.visible = ACTIVE_UNIT.includes(car.state) && Math.floor(s.time * 8) % 2 === side; });
    });
    // Far-away pedestrians (beyond the fog) are neither drawn nor animated.
    pedestrians.forEach((model, i) => { const person = s.pedestrians[i]; model.avatar.visible = nearCamera(person); if (!model.avatar.visible) return; model.rig.before(person); model.update(person, paused.current ? 0 : dt); model.rig.after(person, step); });
    follow.set(p.x, 1.8 + (s.player.height || 0) * 0.3, p.z); shift.copy(follow).sub(orbit.target); camera.position.add(shift); orbit.target.copy(follow);
    orbit.enabled = !paused.current; orbit.update();
    // Keep the camera in front of walls, including when orbiting around a corner.
    const offset = camera.position.clone().sub(orbit.target); let fraction = 1;
    for (const b of s.blocks) {
      let enter = 0, exit = 1, hit = true;
      for (const [axis, center, half] of [['x', b.x, b.width / 2 + 1], ['y', b.height / 2, b.height / 2 + 1], ['z', b.z, b.depth / 2 + 1]]) {
        const start = orbit.target[axis], direction = offset[axis];
        if (Math.abs(direction) < 0.00001) { if (start < center - half || start > center + half) { hit = false; break; } }
        else { const a = (center - half - start) / direction, c = (center + half - start) / direction; enter = Math.max(enter, Math.min(a, c)); exit = Math.min(exit, Math.max(a, c)); }
        if (enter > exit) { hit = false; break; }
      }
      if (hit && enter > 0) fraction = Math.min(fraction, Math.max(0.04, enter - 0.02));
    }
    if (fraction < 1) camera.position.copy(orbit.target).addScaledVector(offset, fraction);
    // Impact shake is applied only for this render so it never accumulates into the orbit camera.
    shake *= Math.exp(-9 * step);
    const shaking = shake > 0.01 && step > 0;
    if (shaking) { shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake); camera.position.add(shakeOffset); }
    renderer.render(scene, camera);
    if (shaking) camera.position.sub(shakeOffset);
    if (time - uiTime > 100) { onUpdate(s); uiTime = time; }
  });
  return () => { renderer.setAnimationLoop(null); observer.disconnect(); orbit.dispose(); disposeCity(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove(); };
}
