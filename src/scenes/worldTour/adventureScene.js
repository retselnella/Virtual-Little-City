import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCharacter } from '../shared/character.js';
import { createCar } from '../shared/car.js';
import { createStreetNpc } from '../shared/streetNpc.js';
import { ROADS, actor, attack, guidePoint, onFoot, stepWorld, targetFor } from '../../models/worldTour/worldAdventure.js';
import { aimFromRay } from '../../models/worldTour/aiming.js';
import { WEAPONS } from '../../models/worldTour/weapons.js';
import { ACTIVE_UNIT } from '../../models/worldTour/worldPolice.js';
import { BODY_TIME, bodyGone } from '../../models/worldTour/worldPedestrians.js';
import { CREW_RANGE } from '../../models/worldTour/wanted.js';
import { vehicleSpec, wheelLayout } from '../../models/worldTour/physicsEngine.js';
import { sceneryLayout } from '../../models/worldTour/worldLayout.js';
import { dueActions, visiblePlayers } from '../../models/worldTour/multiplayer.js';
import { createRagdollRig } from '../shared/ragdollRig.js';
import { GUN_INFO, createGunHolder, poseArms } from '../shared/guns.js';
import { signalAt, signalHeads } from '../../models/worldTour/trafficLights.js';
import { MARINA, THEMES, islandFor } from '../../models/worldTour/worldIsland.js';
import { buildMetro } from './metroScene.js';
import { createKaiju } from './kaijuScene.js';
import { buildAircraft } from './aircraftScene.js';
import { buildVenues } from './venuesScene.js';
import { worldConditions } from '../../models/worldTour/worldClock.js';
import { buildIsland } from './islandScenery.js';
import { buildAmbient } from './ambientScene.js';
import { createSky } from './skyWeather.js';

const BLOOD_DROPS = 360, BLOOD_POOLS = 160;
const OFFICER_SKIN = ['#e8bd98', '#c18b63', '#8d5a3b', '#5f3b28'];

// `remote` (optional) is the multiplayer roster ref from useMultiplayer: other players are drawn as ghosts.
// `environment` (optional) is a ref to a function returning worldConditions() (Philippine time and the world's weather).
// `clock` (optional) is a ref to the world clock in ms (kept in step with the server for the world boss).
export function mountAdventure(host, session, input, paused, onUpdate, onError, remote = null, environment = null, clock = null) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Open world game. WASD to move, F to enter your car, J or click to attack (point with the mouse to aim), E to interact.'); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.3, 3200);
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enablePan = false; orbit.enableDamping = true; orbit.minDistance = 12; orbit.maxDistance = 200; orbit.maxPolarAngle = Math.PI * 0.6;
  const hemisphere = new THREE.HemisphereLight('#fff2df', '#54647f', 2.4); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffd7b0', 3); sun.position.set(-90, 160, 100); scene.add(sun);
  const sky = createSky(scene, { hemisphere, sun });
  let kaiju = null, citySlots = new Map(), ruinsShown = '', hiddenOwners = new Map(), rubble = null, craterMesh = null;
  let teleporterFx = null, ambient = null, aircraft = null, venues = null, root, avatar, playerCar, playerBoat, marker, targetRing, dynamic, island, islandData, metro, horizon, clearPools, traffic = [], patrols = new Map(), pedestrians = [], lastTime = 0, uiTime = 0, lastCity, shotLines = [], remoteShots = [], followY = null;
  let guns, bloodDrops, bloodPools, drops = [], pools = [], poolCursor = 0, lastImpact = 0, shake = 0;
  const shakeOffset = new THREE.Vector3(), matrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0), bloodDummy = new THREE.Object3D();
  let postPoles, postLamps;
  const layout = sceneryLayout(), lean = new THREE.Quaternion(), forwardAxis = new THREE.Vector3(0, 0, 1);
  const bodyMatrix = new THREE.Matrix4(), partOffset = new THREE.Matrix4(), partWorld = new THREE.Matrix4(), partLocal = new THREE.Matrix4();
  const tmpPosition = new THREE.Vector3(), tmpQuaternion = new THREE.Quaternion(), tmpScale = new THREE.Vector3();
  const enemies = new Map(), geometries = new Set(), materials = new Map(), textures = new Set();
  const unitBox = new THREE.BoxGeometry(1, 1, 1); geometries.add(unitBox);
  function material(color) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); return materials.get(color); }
  // Materials that light up at night (windows, lamps, neon, car lights); skyWeather.js sets their brightness each frame.
  const glows = [];
  // The City Hub teleporter: a dark pad with a ring of light that turns, and a shimmering column above it.
  function buildTeleporter(at, label) {
    const light = key => { if (!materials.has(key)) materials.set(key, key === 'teleport-beam' ? new THREE.MeshBasicMaterial({ color: '#b9a8ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }) : new THREE.MeshBasicMaterial({ color: '#c9b8ff' })); return materials.get(key); };
    const group = new THREE.Group(); group.position.set(at.x, 0, at.z); root.add(group);
    kit.box([6.6, 0.3, 6.6], '#23263a', [0, 0.15, 0], group); kit.box([5.2, 0.05, 5.2], '#3a3360', [0, 0.32, 0], group);
    const ring = new THREE.Group(); ring.position.y = 0.4; group.add(ring);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, seg = new THREE.Mesh(unitBox, light('teleport-ring')); seg.scale.set(0.95, 0.12, 0.28); seg.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); seg.rotation.y = Math.PI / 2 - a; ring.add(seg); }
    const column = new THREE.CylinderGeometry(2.2, 2.4, 9, 28, 1, true); geometries.add(column);
    const beam = new THREE.Mesh(column, light('teleport-beam')); beam.position.y = 4.9; group.add(beam);
    label('TELEPORT', at.x, at.z, '#c9b8ff', 10.5, 1.2);
    teleporterFx = { ring, beam };
  }
  // Traffic light lamps: lit or dim by the shared signal cycle.
  const SIGNAL_COLORS = ['red', 'yellow', 'green'], SIGNAL_LIT = { red: '#ff3b30', yellow: '#ffc53d', green: '#39e27a' }, SIGNAL_DIM = { red: '#3a1512', yellow: '#3a2e10', green: '#10301c' };
  let signalShown = '';
  function signalMaterial(axis, color) {
    const key = `signal-${axis}-${color}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshBasicMaterial({ color: SIGNAL_DIM[color] }));
    return materials.get(key);
  }
  function updateSignals(t) {
    const ns = signalAt(t, 'ns'), ew = signalAt(t, 'ew'), key = ns + ew;
    if (key === signalShown) return;
    signalShown = key;
    for (const [axis, state] of [['ns', ns], ['ew', ew]]) for (const color of SIGNAL_COLORS) signalMaterial(axis, color).color.set(state === color ? SIGNAL_LIT[color] : SIGNAL_DIM[color]);
  }
  function glowMaterial(color, strength = 1, emissive = color) {
    const key = `glow-${color}-${emissive}-${strength}`;
    if (!materials.has(key)) { const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive, emissiveIntensity: 0 }); materials.set(key, mat); glows.push({ material: mat, strength }); }
    return materials.get(key);
  }
  const wetSurfaces = [material('#36424c')];
  const kit = {
    box(size, color, position, parent = root) { const mesh = new THREE.Mesh(unitBox, material(color)); mesh.scale.set(...size); mesh.position.set(...position); parent.add(mesh); return mesh; },
    cylinder(top, bottom, height, color, position, parent = root, sides = 8) { const geometry = new THREE.CylinderGeometry(top, bottom, height, sides); geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(...position); parent.add(mesh); return mesh; },
  };
  const glow = { glow(mesh, color, strength = 1) { mesh.material = glowMaterial(`#${mesh.material.color.getHexString()}`, strength * 0.7, color); }, light() {} };
  function disposeCity() {
    for (const id of [...remotes.keys()]) removeRemote(id);
    if (root) { root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); scene.remove(root); }
    island?.dispose(); island = null; ambient?.dispose(); ambient = null; aircraft?.dispose(); aircraft = null; venues?.dispose(); venues = null; metro?.dispose(); metro = null; clearPools?.(); clearPools = null; kaiju?.dispose(); kaiju = null;
    citySlots = new Map(); hiddenOwners = new Map(); ruinsShown = '';
    hullGeometry = deckGeometry = null; // disposed with the city's geometries below; rebuilt for the next city
    geometries.forEach(g => { if (g !== unitBox) { g.dispose(); geometries.delete(g); } });
    textures.forEach(t => t.dispose()); textures.clear();
    for (const [key, mat] of materials) if (key.startsWith('label-')) { mat.dispose(); materials.delete(key); }
    enemies.clear(); traffic = []; patrols = new Map(); pedestrians = []; drops = []; pools = []; poolCursor = 0;
    shotLines.forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); }); shotLines = []; remoteShots = [];
  }
  function build(city) {
    disposeCity(); lastCity = city.id; root = new THREE.Group(); scene.add(root); dynamic = new THREE.Group(); root.add(dynamic);
    // Sky colour, fog and light are set every frame by skyWeather.js from the time of day and the weather.
    scene.fog = new THREE.Fog(city.sky, 220, 2000);
    const batches = new Map();
    // Boxes are batched per material into instanced meshes; `mat` overrides the plain colour material (e.g. a glow).
    // `owner` tags the boxes of one building or tree, so the world boss can knock it down (and it can be rebuilt).
    let owner = null;
    function box(size, color, position, rotation = 0, mat = null) {
      const key = mat ? mat.uuid : color;
      if (!batches.has(key)) batches.set(key, { mat: mat || material(color), entries: [] });
      batches.get(key).entries.push({ size, position, rotation, owner });
    }
    box([910, 2, 910], city.ground, [0, -1.1, 0]); box([30, 0.3, 910], '#e5c79e', [455, -0.1, 0]);
    islandData = islandFor(city.id);
    island = buildIsland(root, city, islandData, { box, glowMaterial });
    // Beach families, picnics, bonfires, café tables and night crowds (ambientLife.js).
    ambient = buildAmbient(root, kit, { island: islandData, blocks: session.current.baseBlocks || session.current.blocks, seed: city.seed, box, glowMaterial, geometries });
    metro = buildMetro(root, { box, glowMaterial, label });
    // Airliner, jets and helicopters overhead, and police helicopters in a big pursuit.
    aircraft = buildAircraft(root, kit, { color: city.color, geometries });
    const windowGlow = glowMaterial('#587b88', 0.95, '#ffd08a'), sideGlow = glowMaterial('#688c98', 0.8, '#ffe0a6'), neon = glowMaterial(city.color, 1.3);
    const lit = (x, y, side) => Math.abs(Math.sin(x * 12.9898 + y * 78.233 + side * 37.719) * 43758.5453) % 1 < 0.55;
    for (const road of ROADS) {
      box([21, 0.15, 880], '#36424c', [road, 0.05, 0]); box([880, 0.15, 21], '#36424c', [0, 0.06, road]);
      for (const side of [-1, 1]) { box([3, 0.3, 870], '#bac0b9', [road + side * 12, 0.1, 0]); box([870, 0.3, 3], '#bac0b9', [0, 0.1, road + side * 12]); }
      for (let n = -420; n <= 420; n += 16) { box([0.2, 0.03, 6], '#e8d8b0', [road, 0.15, n]); box([6, 0.03, 0.2], '#e8d8b0', [n, 0.16, road]); }
    }
    // Traffic lights at every crossing (trafficLights.js): a pole on each corner and a head facing each street. The
    // lamps share six materials (red, yellow, green for each direction) that the frame loop lights up.
    for (const h of signalHeads()) {
      const ox = Math.sin(h.facing), oz = Math.cos(h.facing), hx = h.x + ox * 0.32, hz = h.z + oz * 0.32;
      if (h.axis === 'ns') box([0.22, 5.8, 0.22], '#3b4046', [h.x, 2.9, h.z]);
      box([0.46, 1.3, 0.3], '#1d2126', [hx, 5.05, hz], h.facing);
      SIGNAL_COLORS.forEach((color, k) => box([0.28, 0.28, 0.06], color, [hx + ox * 0.17, 5.45 - k * 0.4, hz + oz * 0.17], h.facing, signalMaterial(h.axis, color)));
    }
    const hubGlass = glowMaterial('#6fa9bc', 0.7, '#ffe6b8');
    let blockIndex = -1;
    const cityBlocks = session.current.baseBlocks || session.current.blocks;
    for (const b of cityBlocks) {
      owner = `block:${++blockIndex}`;
      if (b.hub) { cityHub(b); continue; }
      if (b.venue) continue; // drawn with its venue (venuesScene.js)
      box([b.width + 3, 0.5, b.depth + 3], '#a6aca8', [b.x, 0.2, b.z]);
      box([b.width, b.height, b.depth], b.color, [b.x, b.height / 2, b.z]);
      box([b.width + 1, 0.8, b.depth + 1], '#d6d3c4', [b.x, b.height, b.z]);
      box([b.width * 0.4, 2, b.depth * 0.3], '#69797b', [b.x, b.height + 1, b.z]);
      const front = b.z + b.depth / 2 + 0.15;
      box([b.width - 5, 3.3, 0.3], '#314b58', [b.x, 1.9, front]);
      box([b.width - 3, 0.35, 2.5], city.color, [b.x, 3.8, front + 0.9]);
      for (let x = -b.width / 2 + 4; x < b.width / 2; x += 5) box([0.28, b.height - 3, 0.3], b.color, [b.x + x, b.height / 2 + 1, front]);
      for (let y = 5; y < b.height - 2; y += 7) for (const side of [-1, 1]) {
        // About half of the windows light up after sunset.
        box([b.width - 4, 2.4, 0.1], '#587b88', [b.x, y, b.z + side * (b.depth / 2 + 0.08)], 0, lit(b.x, y, side) ? windowGlow : null);
        box([0.1, 2.4, b.depth - 4], '#688c98', [b.x + side * (b.width / 2 + 0.08), y, b.z], 0, lit(b.z, y, side + 2) ? sideGlow : null);
      }
      box([b.width, 0.6, 0.4], city.color, [b.x, 3.4, b.z + b.depth / 2 + 0.3], 0, neon);
      if (city.id === 'dubai' && b.height > 70) box([1.5, 25, 1.5], '#c3ced1', [b.x, b.height + 12, b.z]);
      if (b.shop) gunShopFront(b, front);
    }
    // Miami's gun shop: a dark storefront with a red neon band, a lit display window of rifles and a door on the avenue.
    function gunShopFront(b, front) {
      const red = glowMaterial('#b8322a', 1.4, '#ff5a4a');
      box([b.width - 2, 4.6, 0.5], '#1d2024', [b.x, 2.4, front + 0.2]);
      box([b.width - 1, 1.3, 0.6], '#b8322a', [b.x, 5.3, front + 0.4], 0, red);
      box([b.width - 12, 2.6, 0.2], '#3b4a52', [b.x - 4, 2.3, front + 0.5], 0, windowGlow);
      for (let i = 0; i < 4; i++) { box([0.25, 0.25, 0.1], '#16191d', [b.x - 9 + i * 3, 2.9, front + 0.62]); box([2.2, 0.25, 0.1], '#16191d', [b.x - 9 + i * 3, 2.3 - (i % 2) * 0.5, front + 0.62]); }
      box([3, 3.4, 0.3], '#6e4a2c', [b.x + 9, 1.8, front + 0.5]);
      box([4.4, 0.35, 3], '#b8322a', [b.x + 9, 3.8, front + 1.6]);
    }
    // The City Hub: a low glass office with white floor bands, an accent crown, an entrance canopy facing the spawn
    // forecourt, flags and planters. Its glass lights up at night.
    function cityHub(b) {
      const west = b.x - b.width / 2, north = b.z - b.depth / 2;
      box([b.width + 5, 0.5, b.depth + 5], '#d3dad6', [b.x, 0.2, b.z]);
      box([b.width - 1, b.height, b.depth - 1], '#e4ebe8', [b.x, b.height / 2, b.z]);
      for (const side of [-1, 1]) {
        box([b.width - 3, b.height - 3.5, 0.2], '#6fa9bc', [b.x, (b.height + 2.5) / 2, b.z + side * (b.depth / 2 - 0.4)], 0, hubGlass);
        box([0.2, b.height - 3.5, b.depth - 3], '#6fa9bc', [b.x + side * (b.width / 2 - 0.4), (b.height + 2.5) / 2, b.z], 0, hubGlass);
      }
      for (let y = 4.4; y < b.height; y += 4.6) box([b.width + 0.4, 0.5, b.depth + 0.4], '#f6f8f7', [b.x, y, b.z]);
      for (let x = -b.width / 2 + 5; x < b.width / 2 - 2; x += 6) for (const side of [-1, 1]) box([0.5, b.height - 1, 0.5], '#f6f8f7', [b.x + x, b.height / 2, b.z + side * (b.depth / 2 - 0.2)]);
      box([b.width + 1.2, 1.4, b.depth + 1.2], city.color, [b.x, b.height + 0.7, b.z], 0, neon);
      box([b.width * 0.5, 2.4, b.depth * 0.4], '#c9d2ce', [b.x + 3, b.height + 2.6, b.z + 3]);
      // Entrance: canopy, pillars and lit doors on the west face, looking onto the forecourt.
      const door = north + 8;
      box([5, 0.4, 11], '#f6f8f7', [west - 2.3, 4.2, door]); box([0.3, 4.2, 0.3], '#c9d2ce', [west - 4.5, 2.1, door - 5]); box([0.3, 4.2, 0.3], '#c9d2ce', [west - 4.5, 2.1, door + 5]);
      box([0.25, 3.2, 5], '#6fa9bc', [west - 0.3, 1.8, door], 0, hubGlass); box([5.2, 0.25, 11.2], city.color, [west - 2.3, 4.5, door], 0, neon);
      for (let i = 0; i < 3; i++) { box([0.18, 9, 0.18], '#d9dedb', [west - 7, 4.5, north + 16 + i * 4]); box([0.08, 1.4, 2.2], ['#f3eee5', city.color, '#8fd3c0'][i], [west - 7, 8.2, north + 17.2 + i * 4]); }
      for (const z of [north + 22, north + 28]) { box([2.4, 0.8, 2.4], '#b9c2bd', [west - 3, 0.6, z]); box([2, 1.3, 2], '#5f8c4a', [west - 3, 1.5, z]); }
    }
    owner = null;
    let treeIndex = -1;
    for (const tree of layout.trees) {
      owner = `tree:${++treeIndex}`;
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
    // The City Hub forecourt: where everyone arrives, respawns and heals (press E).
    owner = null;
    box([10, 0.1, 9], '#8fd3c0', [8, 0.3, 12]); box([8, 0.12, 0.4], '#f6f8f7', [8, 0.32, 8.2]); box([8, 0.12, 0.4], '#f6f8f7', [8, 0.32, 15.8]);
    const dummy = new THREE.Object3D();
    for (const { mat, entries } of batches.values()) {
      const mesh = new THREE.InstancedMesh(unitBox, mat, entries.length);
      entries.forEach((e, i) => {
        dummy.position.set(...e.position); dummy.scale.set(...e.size); dummy.rotation.set(0, e.rotation, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        if (e.owner) { if (!citySlots.has(e.owner)) citySlots.set(e.owner, []); citySlots.get(e.owner).push({ mesh, index: i }); }
      });
      mesh.computeBoundingSphere(); root.add(mesh);
    }
    // Rubble piles and craters for the world boss's destruction (hidden until something is destroyed).
    rubble = new THREE.InstancedMesh(unitBox, material('#8a8780'), cityBlocks.length * 5); rubble.frustumCulled = false; rubble.count = 0; root.add(rubble);
    const craterGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2); geometries.add(craterGeometry);
    craterMesh = new THREE.InstancedMesh(craterGeometry, new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 800); craterMesh.frustumCulled = false; craterMesh.count = 0; root.add(craterMesh);
    kaiju = createKaiju(root);
    // Lamp posts are physics props that a fast car can knock over, so they are instanced separately.
    postPoles = new THREE.InstancedMesh(unitBox, material('#596773'), layout.posts.length); postLamps = new THREE.InstancedMesh(unitBox, glowMaterial('#fff0b9', 1.8, '#ffe3a3'), layout.posts.length);
    postPoles.frustumCulled = postLamps.frustumCulled = false; root.add(postPoles, postLamps);
    layout.posts.forEach((post, i) => placePost(i, { x: post.x, y: 4, z: post.z, q: [0, 0, 0, 1] }));
    clearPools = sky.setLampPools(root, [...layout.posts.map(post => ({ x: post.x - 3, z: post.z })), ...islandData.lamps.map(l => ({ x: l.x + Math.sin(l.heading) * 3, z: l.z + Math.cos(l.heading) * 3 })), ...island.lights]);
    function label(text, x, z, color, y = 7.5, size = 1) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#142634e6'; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(8, 20, 496, 88, 44); ctx.fill(); } else ctx.fillRect(8, 20, 496, 88);
      ctx.fillStyle = color; ctx.font = 'bold 44px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 80, 440);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      const mat = new THREE.SpriteMaterial({ map: texture }); materials.set(`label-${text}-${x}-${z}`, mat); const sprite = new THREE.Sprite(mat); sprite.position.set(x, y, z); sprite.scale.set(5.2 * size, 1.3 * size, 1); root.add(sprite);
    }
    const hub = session.current.blocks.find(b => b.hub); label('CITY HUB', 8, 12, '#86edcb'); label('CITY HUB', hub.x, hub.z, '#ffffff', hub.height + 5, 1.5);
    buildTeleporter(session.current.teleporter, label);
    // The Lounge and the Open-Air Cinema by the City Hub.
    venues = buildVenues(root, { box, label, glowMaterial, geometries, color: city.color });
    const shop = session.current.blocks.find(b => b.shop); if (shop) label('GUN SHOP', shop.x + 9, shop.z + shop.depth / 2 + 3, '#ff8a7a', 7.5, 1.2); label(city.district.toUpperCase(), 0, -32, city.color); label('AIRPORT', -413, -110, '#ffffff'); label('MARINA', MARINA.x0 + 20, MARINA.z - 8, '#9fd6ff');
    const lighthouse = islandData.landmarks.lighthouse; label('LIGHTHOUSE', lighthouse.x + 10, lighthouse.z + 10, '#f8d47a', 40, 1.4);
    if (islandData.landmarks.feature) label(islandData.landmarks.feature.name.toUpperCase(), islandData.landmarks.feature.x, islandData.landmarks.feature.z, '#f3eee5', 16, 1.4);
    for (const suburb of islandData.suburbs) label(suburb.name.toUpperCase(), suburb.x, suburb.z, '#f3eee5', 14, 1.4);
    buildAvatar(session.current.appearance);
    // Pooled blood droplets and ground stains, updated as instances.
    if (!materials.has('blood')) { materials.set('blood', new THREE.MeshStandardMaterial({ color: '#7b0913', roughness: 0.35 })); materials.set('blood-pool', new THREE.MeshStandardMaterial({ color: '#4f050c', roughness: 0.18, metalness: 0.05 })); }
    bloodDrops = new THREE.InstancedMesh(unitBox, materials.get('blood'), BLOOD_DROPS); bloodDrops.frustumCulled = false; bloodDrops.count = 0; root.add(bloodDrops);
    const poolGeometry = new THREE.CylinderGeometry(1, 1, 0.02, 14); geometries.add(poolGeometry);
    bloodPools = new THREE.InstancedMesh(poolGeometry, materials.get('blood-pool'), BLOOD_POOLS); bloodPools.frustumCulled = false; bloodPools.count = 0; root.add(bloodPools);
    lastImpact = session.current.impactSeq || 0;
    playerCar = createCar(root, kit, glow, { color: '#67dccc', headlights: false }); playerCar.car.scale.setScalar(1.7);
    playerBoat = createBoatModel('#f3eee5', city.color);
    // Seen from a sea voyage: the destination island rising on the horizon.
    horizon = new THREE.Group(); horizon.visible = false; root.add(horizon);
    const moundGeometry = new THREE.ConeGeometry(900, 70, 24), peakGeometry = new THREE.ConeGeometry(260, 280, 9); geometries.add(moundGeometry); geometries.add(peakGeometry);
    const mound = new THREE.Mesh(moundGeometry, material('#6f9a5c')), peak = new THREE.Mesh(peakGeometry, material('#7c8279'));
    mound.position.y = 20; peak.position.set(-200, 140, 120); horizon.add(mound, peak);
    for (let i = 0; i < session.current.traffic.length; i++) {
      const model = createCar(root, kit, glow, { color: ['#dba186', '#d0c9bb', '#798bac', '#bc7d94', '#e6d27a', '#8fb89a', '#f2f0ea', '#3b4450'][i % 8], headlights: false }); model.car.scale.setScalar(1.5);
      traffic.push(model);
    }
    for (const person of session.current.pedestrians) { const model = createStreetNpc(root, kit, { shirt: person.look?.shirt, role: person.role, look: person.look }); model.rig = createRagdollRig(model.avatar, 'npc'); pedestrians.push(model); }
    const markerGeo = new THREE.OctahedronGeometry(2.8); geometries.add(markerGeo); marker = new THREE.Mesh(markerGeo, material('#f8d47a')); root.add(marker);
    if (!materials.has('lock')) materials.set('lock', new THREE.MeshBasicMaterial({ color: '#ff727f' }));
    const ringGeo = new THREE.TorusGeometry(2.2, 0.12, 6, 24); geometries.add(ringGeo); targetRing = new THREE.Mesh(ringGeo, materials.get('lock')); targetRing.rotation.x = Math.PI / 2; root.add(targetRing);
    const p = actor(session.current); camera.position.set(p.x, 11, p.z + 24); orbit.target.set(p.x, 1.8, p.z); orbit.update(); followY = null;
  }
  // A speedboat: a tapered hull, deck, cabin with a lit windscreen, and an outboard; bobbing and heeling are added per frame.
  // A speedboat: one pointed, extruded hull with a waterline stripe, a teak deck, a cabin with a lit windscreen and an
  // outboard; bobbing and heeling are added per frame.
  let hullGeometry = null, deckGeometry = null;
  function hullShape(scale) {
    const shape = new THREE.Shape(), w = 1.6 * scale, back = -4.4 * scale;
    shape.moveTo(-w, -back); shape.lineTo(w, -back); shape.lineTo(w, -1.4 * scale); shape.quadraticCurveTo(w * 0.95, -4 * scale, 0, -5.2 * scale); shape.quadraticCurveTo(-w * 0.95, -4 * scale, -w, -1.4 * scale); shape.closePath();
    return shape;
  }
  function createBoatModel(hullColor, trim) {
    if (!hullGeometry) {
      hullGeometry = new THREE.ExtrudeGeometry(hullShape(1), { depth: 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2); geometries.add(hullGeometry);
      deckGeometry = new THREE.ShapeGeometry(hullShape(0.9)).rotateX(-Math.PI / 2); geometries.add(deckGeometry);
    }
    const group = new THREE.Group(), hull = new THREE.Group(); group.add(hull); root.add(group);
    const body = new THREE.Mesh(hullGeometry, material(hullColor)); hull.add(body);
    const stripe = new THREE.Mesh(hullGeometry, material(trim)); stripe.scale.set(1.02, 0.18, 1.02); stripe.position.y = 0.25; hull.add(stripe);
    const deck = new THREE.Mesh(deckGeometry, material('#c9a47a')); deck.position.y = 1.52; hull.add(deck);
    kit.box([2.4, 1.1, 1.9], '#eef2f3', [0, 2.05, 0.2], hull); kit.box([2.5, 0.12, 2.3], trim, [0, 2.65, 0.1], hull);
    const screen = kit.box([2.2, 0.75, 0.08], '#35424a', [0, 2.1, 1.18], hull); screen.material = glowMaterial('#35424a', 0.9, '#bfe7ff');
    kit.box([0.7, 1.5, 0.7], '#2f3b45', [0, 1.1, -4.7], hull); kit.box([0.25, 0.9, 0.25], '#2f3b45', [0, 0.3, -4.9], hull);
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f3fbff', transparent: true, opacity: 0, depthWrite: false }));
    geometries.add(wake.geometry); wake.position.set(0, 0.05, -10); group.add(wake);
    return { group, hull, wake };
  }
  function placeBoat(model, boat, time, dt) {
    const speed = Math.abs(boat.speed || 0), bob = Math.sin(time * 1.7 + boat.x * 0.01) * 0.18;
    model.group.position.set(boat.x, -2.1 + bob, boat.z); model.group.rotation.y = boat.heading;
    model.hull.rotation.set(-Math.min(0.12, speed * 0.004) + Math.sin(time * 1.3) * 0.02, 0, -(boat.steer || 0) * Math.min(0.2, speed * 0.008) + Math.sin(time * 1.1) * 0.03);
    model.wake.scale.set(2.5 + speed * 0.25, 1, 4 + speed * 0.7); model.wake.position.z = -5.5 - speed * 0.35; model.wake.material.opacity = Math.min(0.55, speed * 0.03);
  }
  // The player's look comes from the character creator; editing it mid-game rebuilds the avatar in place.
  let avatarLook;
  function buildAvatar(appearance) {
    if (avatar) root.remove(avatar.avatar);
    avatarLook = appearance;
    avatar = createCharacter(root, kit, { shirt: '#e5ded5', ...appearance, scale: session.current.player.look?.scale || 1 }); avatar.avatar.visible = true; avatar.rig = createRagdollRig(avatar.avatar, 'player');
    guns = addGuns(avatar.avatar);
  }
  // Guns in the right hand, each with a hidden muzzle flash (the player's avatar and other players' ghosts).
  function addGuns(body) {
    if (!materials.has('muzzle')) materials.set('muzzle', new THREE.MeshBasicMaterial({ color: '#ffe7a3' }));
    return createGunHolder(body, kit, materials.get('muzzle'));
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
    const guns = addGuns(rig.avatar);
    const hash = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const car = createCar(root, kit, glow, { color: REMOTE_CARS[hash % REMOTE_CARS.length], headlights: false }); car.car.scale.setScalar(1.7); car.car.visible = false;
    const tag = nameTag(profile.name); root.add(tag);
    const boat = createBoatModel('#f3eee5', REMOTE_CARS[hash % REMOTE_CARS.length]); boat.group.visible = false;
    const model = { rig, car, boat, tag, key, guns, punchTime: 0, combo: 0, fired: 0 }; remotes.set(id, model); return model;
  }
  function removeRemote(id) {
    const model = remotes.get(id); if (!model) return;
    root.remove(model.rig.avatar, model.car.car, model.boat.group, model.tag); model.tag.material.map.dispose(); model.tag.material.dispose(); remotes.delete(id);
  }
  function policeCarModel() {
    const model = createCar(root, kit, glow, { color: '#24394e', police: true, headlights: false }); model.car.scale.setScalar(1.7);
    for (const side of [-1, 1]) { kit.box([0.03, 0.4, 1.2], '#e5eaec', [side * 0.69, 0.6, -0.1], model.car); kit.box([0.04, 0.2, 0.18], '#d7b96b', [side * 0.71, 0.6, -0.1], model.car); }
    kit.box([1.1, 0.1, 0.3], '#142937', [0, 1.55, -0.1], model.car);
    model.lights = [-1, 1].map(side => kit.box([0.43, 0.18, 0.28], side < 0 ? '#ff4966' : '#438aff', [side * 0.28, 1.68, -0.1], model.car));
    model.lights.forEach(light => { light.material.emissive.copy(light.material.color); light.material.emissiveIntensity = 2; });
    return model;
  }
  function updateRemotes(s, dt) {
    if (!remote?.current) { s.crew = 0; return; }
    const seen = new Set();
    const now = performance.now();
    remoteShots = remoteShots.filter(shot => (shot.ttl -= dt) > 0);
    let crew = 0; const me = actor(s), seats = [];
    for (const { id, player, profile, pose } of visiblePlayers(remote.current, actor(s), now)) {
      seen.add(id);
      // Wanted players close together are a crew: the police send more units after them (wanted.js).
      if (pose.st > 0 && Math.hypot(pose.x - me.x, pose.z - me.z) < CREW_RANGE) crew++;
      const key = JSON.stringify(profile);
      let model = remotes.get(id);
      if (!model || model.key !== key) { removeRemote(id); model = createRemote(id, profile, key); }
      model.rig.avatar.visible = !pose.d && !pose.b; model.car.car.visible = pose.d; model.boat.group.visible = !!pose.b;
      if (pose.b) placeBoat(model.boat, { x: pose.x, z: pose.z, heading: pose.h, speed: pose.s }, performance.now() / 1000, dt);
      model.punchTime = Math.max(0, model.punchTime - dt); model.fired = Math.max(0, model.fired - dt);
      for (const action of dueActions(player, now)) playRemoteAction(s, model, pose, action);
      if (pose.d) {
        model.car.car.position.set(pose.x, pose.y, pose.z); model.car.car.quaternion.set(...pose.q);
        model.car.wheels.forEach(wheel => { wheel.spin.rotation.x += pose.s * dt / 0.55; });
      } else {
        model.rig.update({ x: pose.x, z: pose.z, heading: pose.h, height: pose.y, speed: pose.s, waveTime: 0, seated: pose.si }, dt);
        model.rig.avatar.position.y = (pose.si ? -0.52 : 0.2) * profile.scale + pose.y;
        if (pose.si) seats.push({ x: pose.x, z: pose.z });
        if (!pose.k) poseArms(model.rig.avatar, pose.w, pose.a, model.punchTime, model.combo, model.fired / 0.12);
      }
      model.guns.set(pose.w); model.guns.flash(!!pose.w && model.fired > 0.07);
      model.tag.position.set(pose.x, pose.y + (pose.d ? 3.6 : pose.b ? 4 : 4.2 * profile.scale), pose.z);
    }
    for (const id of [...remotes.keys()]) if (!seen.has(id)) removeRemote(id);
    s.crew = crew; s.remoteSeats = seats;
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
      wheel.spin.rotation.x = w.rotation; wheel.rotation.y = w.steer; wheel.position.y = (rest - w.suspension) / scale;
    });
    const hood = model.car.children[1]; hood.scale.y = 0.2 * (1 - body.damage * 0.003);
  }
  // Show the world boss's destruction: hide wrecked buildings, trees and lamp posts, pile rubble and dig craters; when the
  // event ends (s.ruins is cleared) everything comes back.
  function showRuins(s) {
    const r = s.ruins, key = r ? `${r.ruined.size}:${r.trees.size}:${r.posts.size}:${r.craters.length}` : '';
    if (key === ruinsShown) return;
    ruinsShown = key;
    const next = new Set(r ? [...[...r.ruined].map(i => `block:${i}`), ...[...r.trees].map(i => `tree:${i}`)] : []), dirty = new Set(), gone = hidden.elements;
    for (const [id, slots] of hiddenOwners) if (!next.has(id)) { for (const slot of slots) { slot.mesh.instanceMatrix.array.set(slot.saved, slot.index * 16); dirty.add(slot.mesh); } hiddenOwners.delete(id); }
    for (const id of next) if (!hiddenOwners.has(id)) {
      const slots = (citySlots.get(id) || []).map(slot => ({ ...slot, saved: slot.mesh.instanceMatrix.array.slice(slot.index * 16, slot.index * 16 + 16) }));
      for (const slot of slots) { slot.mesh.instanceMatrix.array.set(gone, slot.index * 16); dirty.add(slot.mesh); }
      hiddenOwners.set(id, slots);
    }
    dirty.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    const blocks = s.baseBlocks || s.blocks; let n = 0;
    for (const i of r ? r.ruined : []) {
      const b = blocks[i];
      for (let k = 0; k < 5; k++) {
        const a = Math.sin(i * 12.9 + k * 7.1) * 0.5 + 0.5, c = Math.sin(i * 3.7 + k * 5.3) * 0.5 + 0.5;
        bloodDummy.position.set(b.x + (a - 0.5) * b.width * 0.7, 1 + k * 0.6, b.z + (c - 0.5) * b.depth * 0.7); bloodDummy.scale.set(b.width * (0.3 + a * 0.3), 2 + c * 3, b.depth * (0.3 + c * 0.3)); bloodDummy.rotation.set(a * 0.4, a * 3, c * 0.3); bloodDummy.updateMatrix();
        rubble.setMatrixAt(n++, bloodDummy.matrix);
      }
    }
    rubble.count = n; rubble.instanceMatrix.needsUpdate = true;
    const craters = r ? r.craters.slice(-800) : [];
    craters.forEach((c, i) => { bloodDummy.position.set(c.x, 0.22, c.z); bloodDummy.scale.set(c.r, 1, c.r); bloodDummy.rotation.set(0, 0, 0); bloodDummy.updateMatrix(); craterMesh.setMatrixAt(i, bloodDummy.matrix); });
    craterMesh.count = craters.length; craterMesh.instanceMatrix.needsUpdate = true;
    layout.posts.forEach((post, i) => { if (r?.posts.has(post.id)) { postPoles.setMatrixAt(i, hidden); postLamps.setMatrixAt(i, hidden); } else placePost(i, s.props?.[i] || { x: post.x, y: 4, z: post.z, q: [0, 0, 0, 1] }); });
    postPoles.instanceMatrix.needsUpdate = postLamps.instanceMatrix.needsUpdate = true;
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
  function addPool(x, z, radius, delay, grow) { pools[poolCursor % BLOOD_POOLS] = { x, z, y: surfaceY(x, z) + (poolCursor % 7) * 0.003, radius, age: -delay, grow, life: BODY_TIME + 1.5 }; poolCursor++; }
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
      const size = pool.radius * Math.min(1, Math.max(0, pool.age) / pool.grow) * Math.min(1, Math.max(0, (pool.life - pool.age) / 2.5));
      if (size <= 0.001) { bloodPools.setMatrixAt(i, hidden); return; }
      matrix.makeScale(size, 1, size * 0.85).setPosition(pool.x, pool.y, pool.z); bloodPools.setMatrixAt(i, matrix);
    });
    bloodPools.count = pools.length; bloodPools.instanceMatrix.needsUpdate = true;
  }
  // Combat poses layered over the shared character animation: two-handed aim with recoil, boxing guard and punches.
  function posePlayer(s) {
    const shot = s.shots.find(x => !x.police);
    guns.flash(!!shot && shot.ttl > 0.07);
    if (s.driving || s.down) return;
    const gun = GUN_INFO[s.weapon] ? s.weapon : null;
    poseArms(avatar.avatar, gun, s.aimTime > 0 || (!!gun && (input.current.attack || pointer.hold)), s.punchTime, s.combo, shot ? shot.ttl / 0.12 : 0, s.aimTime > 0 ? s.aimPitch : 0);
  }
  function resize() { camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const lost = event => { event.preventDefault(); onError(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
  // Free aim with a mouse: the pointer is the crosshair. A click (without dragging the camera) fires once; holding the
  // right button keeps firing; J fires too. Touch screens keep the automatic lock-on.
  const canvas = renderer.domElement, raycaster = new THREE.Raycaster(), pointer = { ndc: null, press: null, hold: false, pending: false };
  const aimMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 28), aimMaterial), aimDot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), aimMaterial);
  aimRing.add(aimDot); aimRing.renderOrder = 10; aimDot.renderOrder = 10; aimRing.visible = false; scene.add(aimRing);
  const onPointerMove = e => {
    if (e.pointerType === 'touch') { pointer.ndc = null; return; }
    const r = canvas.getBoundingClientRect(); pointer.ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  };
  const onPointerDown = e => { onPointerMove(e); if (e.pointerType === 'touch') return; if (e.button === 0) pointer.press = { x: e.clientX, y: e.clientY, at: performance.now() }; if (e.button === 2) pointer.hold = true; };
  const onPointerUp = e => {
    if (e.button === 2) pointer.hold = false;
    if (e.button === 0 && pointer.press && performance.now() - pointer.press.at < 350 && Math.hypot(e.clientX - pointer.press.x, e.clientY - pointer.press.y) < 7) pointer.pending = true;
    pointer.press = null;
  };
  const onPointerLeave = () => { pointer.ndc = null; pointer.hold = false; };
  const noMenu = e => e.preventDefault();
  canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointerleave', onPointerLeave); canvas.addEventListener('contextmenu', noMenu);
  let cursor = '';
  function aimRayFor(s) {
    if (!pointer.ndc || paused.current || !onFoot(s) || s.down || !WEAPONS[s.weapon]?.gun) return null;
    raycaster.setFromCamera(pointer.ndc, camera); const { origin: o, direction: d } = raycaster.ray;
    return { o: { x: o.x, y: o.y, z: o.z }, d: { x: d.x, y: d.y, z: d.z }, near: camera.position.distanceTo(orbit.target) };
  }
  // The crosshair in the world: red on the kaiju or on someone you can hit, amber on the kaiju out of this gun's reach.
  function showAim(s, ray) {
    const want = ray ? 'crosshair' : ''; if (cursor !== want) { cursor = want; canvas.style.cursor = want; }
    aimRing.visible = !!ray;
    const aim = ray && aimFromRay(s, ray), label = aim ? `${aim.kind}${aim.part ? `:${aim.part}` : ''}` : '';
    // What the crosshair is on, for assistive tools and browser tests.
    if (canvas.dataset.aim !== label) canvas.dataset.aim = label;
    if (!aim) return null;
    const w = WEAPONS[s.weapon], p = s.player, flat = Math.hypot(aim.x - p.x, aim.z - p.z);
    const inReach = aim.kind === 'kaiju' ? Math.hypot(s.boss.x - p.x, s.boss.z - p.z) <= w.reach : aim.kind === 'person' && flat <= w.range;
    aimMaterial.color.set(aim.kind === 'kaiju' ? (inReach ? '#ff4b3e' : '#ffb35c') : aim.kind === 'person' && inReach ? (aim.target.kind === 'civilian' ? '#f3ece1' : '#ff727f') : '#ffffff');
    aimMaterial.opacity = aim.kind === 'sky' || aim.kind === 'ground' || aim.kind === 'building' ? 0.55 : 0.95;
    const back = Math.min(aim.distance, 0.5); aimRing.position.set(aim.x - ray.d.x * back, aim.y - ray.d.y * back, aim.z - ray.d.z * back);
    aimRing.quaternion.copy(camera.quaternion); aimRing.scale.setScalar(Math.max(0.2, camera.position.distanceTo(aimRing.position) * 0.014) * (aim.kind === 'kaiju' && aim.part === 'head' ? 1.5 : 1));
    return aim;
  }
  renderer.setAnimationLoop(time => {
    const s = session.current;
    if (lastCity !== s.city) build(s.cityInfo);
    else if (s.appearance !== avatarLook) buildAvatar(s.appearance);
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0; lastTime = time;
    const yaw = Math.atan2(orbit.target.x - camera.position.x, orbit.target.z - camera.position.z);
    // The metro timetable runs on the shared world clock, so every player sees the same train.
    s.worldTime = (clock?.current?.() ?? Date.now()) / 1000;
    const aimRay = aimRayFor(s), firing = !!aimRay && pointer.hold;
    if (!paused.current && !document.hidden) {
      stepWorld(s, firing ? { ...input.current, attack: true } : input.current, dt, yaw, aimRay);
      if (pointer.pending && aimRay) { if (s.cooldown <= 0 || s.cooldown > 0.2) pointer.pending = false; if (s.cooldown <= 0) attack(s); } else pointer.pending = false;
    }
    const aimed = showAim(s, paused.current ? null : aimRay);
    const p = actor(s), point = guidePoint(s), step = paused.current || document.hidden ? 0 : dt;
    avatar.avatar.visible = onFoot(s); avatar.rig.before(s.player); avatar.update(s.player, paused.current ? 0 : dt); avatar.avatar.position.y = (s.player.seated ? -0.52 : 0.2) * (s.player.look?.scale || 1) + s.player.height; guns.set(s.weapon);
    posePlayer(s); avatar.rig.after(s.player, step);
    for (const hit of s.impacts) {
      if (hit.id <= lastImpact) continue;
      lastImpact = hit.id;
      if (hit.blood && s.blood !== false) spray(hit);
      if (hit.kind === 'blast') { kaiju.blast(hit.x, hit.y, hit.z); if (Math.hypot(hit.x - p.x, hit.z - p.z) < 40) shake = Math.min(0.9, shake + 0.5); }
      if (hit.kind !== 'pool' && Math.hypot(hit.x - p.x, hit.z - p.z) < 7) shake = Math.min(0.6, shake + (hit.kind === 'car' ? 0.35 : hit.kind === 'punch' ? 0.22 * hit.power : 0.12));
    }
    updateBlood(step);
    updateRemotes(s, paused.current ? 0 : dt);
    updateCar(playerCar, s.car); placeBoat(playerBoat, s.boat, s.time, step); metro.update(s.train);
    updateSignals(s.worldTime);
    if (teleporterFx) { teleporterFx.ring.rotation.y += step * 0.9; teleporterFx.beam.material.opacity = 0.14 + Math.sin(time / 280) * 0.06; }
    // The destination island rises over the horizon as a voyage nears its end.
    const course = s.boating && s.course?.openSea ? s.course : null; horizon.visible = !!course;
    if (course) { const far = course.remaining + 1400; horizon.position.set(s.boat.x + Math.sin(course.bearing) * far, -2, s.boat.z + Math.cos(course.bearing) * far); horizon.children[0].material = material(THEMES[course.to]?.ground.grass || '#6f9a5c'); }
    s.props?.forEach((prop, i) => { if (prop.fallen && !s.ruins?.posts.has(prop.id)) placePost(i, prop); });
    showRuins(s);
    const kaijuFx = kaiju.update(s, step, camera, s.baseBlocks || s.blocks); if (kaijuFx.shake) shake = Math.min(0.9, shake + kaijuFx.shake * step * 4);
    marker.visible = !!point; if (point) { marker.position.set(point.x, 6 + Math.sin(s.time * 2), point.z); marker.rotation.y = s.time; }
    for (const e of s.enemies) {
      if (!enemies.has(e.id)) {
        const hash = [...e.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
        // The bounty's gang boss stands out: black suit, gold cap and a gold health bar.
        const model = createStreetNpc(dynamic, kit, { shirt: e.kind === 'police' ? '#4366af' : e.boss ? '#1f2026' : '#b64e6d', armed: true, police: e.kind === 'police', look: e.boss ? { skin: OFFICER_SKIN[hash % 4], hairStyle: 'cap', hair: '#d4a53a' } : { skin: OFFICER_SKIN[hash % 4], hairStyle: hash % 3 ? 'short' : 'cap', hair: '#221a16' } });
        const bar = kit.box([1.6, 0.15, 0.15], e.boss ? '#ffc34d' : '#ff747b', [0, 3.7, 0], model.avatar); bar.name = 'health'; model.rig = createRagdollRig(model.avatar, 'npc'); enemies.set(e.id, model);
      }
      const model = enemies.get(e.id); model.rig.before(e); model.update(e, paused.current ? 0 : dt); model.rig.after(e, step); model.avatar.getObjectByName('health').visible = e.health > 0; model.avatar.visible = !bodyGone(e, s.time); model.avatar.getObjectByName('health').scale.x = Math.max(0.01, e.health / (e.boss ? 300 : 100) * 1.6);
    }
    for (const [id, model] of enemies) if (!s.enemies.some(e => e.id === id)) { dynamic.remove(model.avatar); enemies.delete(id); }
    // The ring marks exactly who an attack would hit now; while driving it marks the nearest threat.
    const lock = !onFoot(s) && !s.driving ? null : s.driving ? s.enemies.filter(e => e.health > 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : aimRay ? (aimed?.kind === 'person' ? aimed.target : null) : targetFor(s);
    targetRing.visible = !!lock;
    if (lock) { targetRing.position.set(lock.x, 0.35, lock.z); targetRing.rotation.z = s.time * 2; targetRing.material.color.set(lock.kind === 'civilian' ? '#f3ece1' : '#ff727f'); }
    shotLines.forEach(line => { root.remove(line); line.geometry.dispose(); line.material.dispose(); });
    shotLines = [...s.shots, ...remoteShots].map(shot => { const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(shot.x, shot.y ?? 2.1, shot.z), new THREE.Vector3(shot.tx, shot.ty ?? 2, shot.tz)]); const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: shot.police ? '#ff7881' : shot.rocket ? '#ff8a2a' : shot.kaiju ? '#ffb86b' : '#fff4b0' })); root.add(line); return line; });
    traffic.forEach((model, i) => updateCar(model, s.traffic[i]));
    // Police cars come and go (reinforcements), so their models are made and removed by id.
    for (const car of s.policeCars) {
      if (!patrols.has(car.id)) patrols.set(car.id, policeCarModel());
      const model = patrols.get(car.id); updateCar(model, car);
      model.lights.forEach((light, side) => { light.visible = ACTIVE_UNIT.includes(car.state) && Math.floor(s.time * 8) % 2 === side; });
    }
    for (const [id, model] of patrols) if (!s.policeCars.some(c => c.id === id)) { root.remove(model.car); patrols.delete(id); }
    // Far-away pedestrians (beyond the fog) are neither drawn nor animated.
    pedestrians.forEach((model, i) => { const person = s.pedestrians[i]; model.avatar.visible = nearCamera(person) && !bodyGone(person, s.time); if (!model.avatar.visible) return; model.rig.before(person); model.update(person, paused.current ? 0 : dt); model.rig.after(person, step); });
    // The camera follows the ground under you (hills, or the car's height) but only a little of each jump.
    const surface = s.driving ? Math.max(0, s.car.y || 0) : s.riding ? s.train.y : s.boating ? -0.5 : islandData.terrainHeight(p.x, p.z), lift = onFoot(s) ? Math.max(0, (s.player.height || 0) - surface) * 0.3 : 0;
    followY = followY === null ? surface : followY + (surface - followY) * (1 - Math.exp(-8 * dt));
    follow.set(p.x, 1.8 + followY + lift, p.z); shift.copy(follow).sub(orbit.target); camera.position.add(shift); orbit.target.copy(follow);
    orbit.enabled = !paused.current; orbit.update();
    // Looking up (at the kaiju's head, say): the camera stops just above the ground and the view tilts up past you.
    const floor = Math.max(followY + 0.9, islandData.terrainHeight(camera.position.x, camera.position.z) + 2.5);
    if (camera.position.y < floor) { orbit.target.y += floor - camera.position.y; camera.position.y = floor; }
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
    // Trees between you and the camera are hidden while they block the view (canopies are vertical cylinders).
    const view = camera.position.clone().sub(orbit.target), span = Math.hypot(view.x, view.z), blocking = new Set();
    if (span > 0.5) for (const t of islandData.treesAround(orbit.target.x + view.x / 2, orbit.target.z + view.z / 2, span / 2 + 8)) {
      const radius = (t.kind === 'pine' ? 3.6 : t.kind === 'broad' ? 4.6 : 5.5) * t.scale + 0.8, top = t.y + t.height + 4.5 * t.scale;
      const u = Math.max(0, Math.min(1, ((t.x - orbit.target.x) * view.x + (t.z - orbit.target.z) * view.z) / (span * span)));
      if (Math.hypot(orbit.target.x + view.x * u - t.x, orbit.target.z + view.z * u - t.z) < radius && orbit.target.y + view.y * u < top) blocking.add(t);
    }
    island?.hideTrees(blocking);
    // ...and above the mountainsides.
    const ground = islandData.terrainHeight(camera.position.x, camera.position.z) + 2.5;
    if (camera.position.y < ground) camera.position.y = ground;
    const conditions = environment?.current?.() ?? worldConditions(Date.now());
    sky.update(conditions, camera, step, glows, wetSurfaces); island?.update(conditions, s.time, camera);
    ambient?.update(orbit.target, conditions.night, step, time / 1000);
    aircraft?.update(s, s.worldTime, step, conditions.night);
    venues?.update(s, time / 1000);
    // Impact shake is applied only for this render so it never accumulates into the orbit camera.
    shake *= Math.exp(-9 * step);
    const shaking = shake > 0.01 && step > 0;
    if (shaking) { shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake); camera.position.add(shakeOffset); }
    renderer.render(scene, camera);
    if (shaking) camera.position.sub(shakeOffset);
    if (time - uiTime > 100) { onUpdate(s); uiTime = time; }
  });
  return () => { renderer.setAnimationLoop(null); observer.disconnect(); orbit.dispose(); disposeCity(); sky.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.domElement.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointerleave', onPointerLeave); canvas.removeEventListener('contextmenu', noMenu); aimRing.geometry.dispose(); aimDot.geometry.dispose(); aimMaterial.dispose(); renderer.dispose(); renderer.domElement.remove(); };
}
