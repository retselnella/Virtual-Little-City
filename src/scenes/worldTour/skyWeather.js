import * as THREE from 'three';

// The sky, light and weather over the island, driven by worldConditions() (Philippine time + the shared world weather):
// a gradient sky dome with the sun and moon, stars, drifting clouds, rain streaks around the camera, lightning, fog,
// and night lighting (windows, street lamps, car lights and neon glow through `glows`).
const RAIN_DROPS = 3600, CLOUDS = 90, SKY_RADIUS = 2800;
const PALETTE = {
  top: { day: '#4f8fd0', golden: '#5a6fa8', night: '#070d24' },
  horizon: { day: '#cfe2ec', golden: '#f3a56f', night: '#16213d' },
  storm: { top: '#4d5863', horizon: '#8b949c', night: '#10151f' },
};
const cache = new Map();
// Cached palette colours (never mutated; copy them into a target).
const c = value => { if (!cache.has(value)) cache.set(value, new THREE.Color(value)); return cache.get(value); };

export function createSky(scene, { hemisphere, sun }) {
  let pools = null;
  const tmp = new THREE.Color(), tmp2 = new THREE.Color(), sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const uniforms = {
    top: { value: new THREE.Color('#4f8fd0') }, horizon: { value: new THREE.Color('#cfe2ec') }, bottom: { value: new THREE.Color('#2d5f70') }, sunColor: { value: new THREE.Color('#fff1d0') },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, sunVis: { value: 1 }, glow: { value: 1 }, moonAlpha: { value: 0 }, flash: { value: 0 },
  };
  const domeGeometry = new THREE.SphereGeometry(SKY_RADIUS, 40, 20);
  const domeMaterial = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, horizon, bottom, sunColor, sunDir, moonDir; uniform float sunVis, glow, moonAlpha, flash; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.55, h), 0.75)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 10.0) * 0.45 * glow + smoothstep(0.9990, 0.9995, s) * 3.0 * sunVis);
        float m = max(dot(d, moonDir), 0.0);
        col += vec3(0.8, 0.86, 1.0) * (smoothstep(0.99955, 0.9998, m) * 1.4 + pow(m, 60.0) * 0.12) * moonAlpha;
        col = mix(col, vec3(0.82, 0.86, 1.0), flash * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(domeGeometry, domeMaterial); dome.renderOrder = -2; dome.frustumCulled = false; scene.add(dome);

  // Stars on the upper sky, fixed to the dome.
  const starPositions = new Float32Array(1400 * 3);
  for (let i = 0, seed = 11; i < 1400; i++) {
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const a = rand() * Math.PI * 2, y = 0.08 + rand() * 0.92, r = Math.sqrt(1 - y * y) * (SKY_RADIUS - 60);
    starPositions.set([Math.cos(a) * r, y * (SKY_RADIUS - 60), Math.sin(a) * r], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: '#e9eeff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeometry, starMaterial); stars.renderOrder = -1; stars.frustumCulled = false; scene.add(stars);

  // Clouds: flattened boxes drifting with the wind; more of them, lower and darker as the weather turns.
  const cloudBox = new THREE.BoxGeometry(1, 1, 1);
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.9, depthWrite: false });
  const cloudMesh = new THREE.InstancedMesh(cloudBox, cloudMaterial, CLOUDS * 2); cloudMesh.frustumCulled = false; scene.add(cloudMesh);
  const clouds = [];
  for (let i = 0, seed = 5; i < CLOUDS; i++) {
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    clouds.push({ x: (rand() - 0.5) * 4400, z: (rand() - 0.5) * 4400, y: 300 + rand() * 140, w: 120 + rand() * 220, d: 70 + rand() * 120, rank: rand() });
  }
  const dummy = new THREE.Object3D();

  // Rain: streaks in a box that follows the camera (drop positions are offsets from the camera).
  const rainPositions = new Float32Array(RAIN_DROPS * 6), rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#b9c9d8', transparent: true, opacity: 0.5, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const drops = Array.from({ length: RAIN_DROPS }, () => ({ x: (Math.random() - 0.5) * 150, y: Math.random() * 80 - 45, z: (Math.random() - 0.5) * 150, v: 55 + Math.random() * 20 }));

  let flash = 0, nextStrike = 4, windPhase = 0;
  function update(conditions, camera, dt, glows = [], wet = []) {
    const { sun: position, night, golden, clouds: cover, rain: wetness, storm } = conditions;
    // Sun direction from Manila's solar azimuth (clockwise from north, north = -z) and elevation.
    const el = position.elevation * Math.PI / 180, az = position.azimuth * Math.PI / 180;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    moonDir.set(-sunDir.x, Math.max(0.35, -sunDir.y), -sunDir.z).normalize();
    const overcast = Math.min(1, cover * 0.75 + wetness * 0.25);
    // Lightning: brief double flashes during thunderstorms.
    nextStrike -= dt;
    if (storm > 0.3 && nextStrike <= 0) { flash = 1; nextStrike = 3 + Math.random() * 9 / storm; }
    flash = Math.max(0, flash - dt * 3.2);
    const strike = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(flash * 40)) : 0;

    const day = 1 - night, warm = golden * (1 - overcast);
    const mixSky = (set, stormColor, stormNight, target) => {
      target.copy(c(set.night)).lerp(c(set.day), day).lerp(c(set.golden), warm * 0.8);
      tmp2.copy(c(stormNight)).lerp(c(stormColor), day);
      return target.lerp(tmp2, overcast * 0.85);
    };
    mixSky(PALETTE.top, PALETTE.storm.top, PALETTE.storm.night, uniforms.top.value);
    mixSky(PALETTE.horizon, PALETTE.storm.horizon, PALETTE.storm.night, uniforms.horizon.value);
    uniforms.bottom.value.copy(uniforms.horizon.value).multiplyScalar(0.55);
    uniforms.sunColor.value.copy(c('#fff1d0')).lerp(c('#ff9352'), golden);
    uniforms.sunDir.value.copy(sunDir); uniforms.moonDir.value.copy(moonDir);
    uniforms.sunVis.value = (1 - overcast) * (sunDir.y > -0.02 ? 1 : 0);
    uniforms.glow.value = (1 - overcast * 0.8) * Math.max(0, Math.min(1, sunDir.y * 6 + 0.6));
    uniforms.moonAlpha.value = night * (1 - overcast);
    uniforms.flash.value = strike;
    dome.position.copy(camera.position); stars.position.copy(camera.position);
    starMaterial.opacity = Math.max(0, night - 0.15) * (1 - overcast) * 0.95;

    // Fog matches the horizon; it thickens in rain.
    scene.fog.color.copy(uniforms.horizon.value);
    scene.fog.near = 220 - wetness * 140; scene.fog.far = Math.max(480, 2000 - wetness * 1050 - storm * 250 - night * 250);
    scene.background = null;

    // Light: sun by day, a cool moon by night; the sky light dims under cloud.
    const sunUp = Math.max(0, Math.min(1, (position.elevation + 2) / 10));
    hemisphere.intensity = (0.95 + day * 1.55) * (1 - overcast * 0.3) + strike * 2.5;
    hemisphere.color.copy(c('#8ea3dc')).lerp(c('#fff2df'), day).lerp(c('#ffd0a3'), warm * 0.6);
    hemisphere.groundColor.copy(c('#1b2236')).lerp(c('#54647f'), day);
    if (sunUp > 0.02) {
      sun.color.copy(c('#ffe2c2')).lerp(c('#ff9c5e'), golden);
      sun.intensity = 3.1 * sunUp * (1 - overcast * 0.72);
      sun.position.copy(sunDir).multiplyScalar(300);
    } else {
      sun.color.set('#a9bcff'); sun.intensity = 0.55 * (1 - overcast * 0.6);
      sun.position.copy(moonDir).multiplyScalar(300);
    }

    // Night lighting: windows, lamps, neon and car lights glow as the sun goes down (and a little in heavy weather).
    const lights = Math.min(1, night + overcast * 0.25);
    for (const g of glows) g.material.emissiveIntensity = g.strength * lights;
    if (pools) { pools.material.opacity = 0.2 * lights; pools.visible = lights > 0.05; }
    // Wet streets turn glossy.
    for (const m of wet) m.roughness = 0.72 - wetness * 0.42;

    // Clouds drift west with the trade winds.
    windPhase += dt * (6 + conditions.wind * 14);
    const shown = Math.round(CLOUDS * Math.min(1, 0.18 + cover * 0.82));
    cloudMaterial.color.copy(c('#2a3246')).lerp(c('#ffffff'), day * 0.9 + 0.1).lerp(c('#5d6670'), overcast * 0.6).lerp(c('#ffc9a0'), warm * 0.35);
    // Thin clouds fade into a clear night sky; storm clouds stay heavy.
    cloudMaterial.opacity = (0.62 + overcast * 0.33) * (1 - night * 0.55 * (1 - overcast));
    let n = 0;
    for (let i = 0; i < CLOUDS; i++) {
      const cl = clouds[i]; if (cl.rank > shown / CLOUDS) continue;
      const x = ((cl.x - windPhase + 2200) % 4400 + 4400) % 4400 - 2200, y = cl.y - overcast * 90;
      for (let k = 0; k < 2; k++) {
        dummy.position.set(x + k * cl.w * 0.3, y + k * 12, cl.z + k * cl.d * 0.25); dummy.scale.set(cl.w * (1 - k * 0.35), 24 + k * 10, cl.d * (1 - k * 0.3)); dummy.updateMatrix();
        cloudMesh.setMatrixAt(n++, dummy.matrix);
      }
    }
    cloudMesh.count = n; cloudMesh.instanceMatrix.needsUpdate = true;

    // Rain streaks, slanted by the wind, in a box around the camera.
    const count = Math.round(RAIN_DROPS * Math.min(1, wetness * 1.1 + storm * 0.3));
    rain.visible = count > 0;
    if (rain.visible) {
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, slant = 0.12 + storm * 0.25, length = 1.4 + storm;
      rainMaterial.opacity = 0.28 + wetness * 0.3 + strike * 0.3;
      rainMaterial.color.copy(c('#6e7f95')).lerp(c('#c9d6e3'), day);
      for (let i = 0; i < count; i++) {
        const d = drops[i];
        d.y -= d.v * dt;
        if (d.y < -45) { d.y += 80; d.x = (Math.random() - 0.5) * 150; d.z = (Math.random() - 0.5) * 150; }
        const x = cx + d.x - d.y * slant, y = cy + d.y, z = cz + d.z;
        rainPositions.set([x, y, z, x + slant * length, y + length, z], i * 6);
      }
      rainGeometry.setDrawRange(0, count * 2); rainGeometry.attributes.position.needsUpdate = true;
    }
    return { flash: strike };
  }
  function dispose() {
    for (const o of [dome, stars, cloudMesh, rain]) scene.remove(o);
    [domeGeometry, starGeometry, cloudBox, rainGeometry].forEach(g => g.dispose()); [domeMaterial, starMaterial, cloudMaterial, rainMaterial].forEach(m => m.dispose());
  }
  // Warm pools of light on the ground under street lamps (flat discs, brightest at night). Rebuilt with each city.
  function setLampPools(root, points) {
    const geometry = new THREE.CircleGeometry(8, 20).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: '#ffc978', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    pools = new THREE.InstancedMesh(geometry, material, points.length); pools.frustumCulled = false; pools.renderOrder = 1;
    points.forEach((p, i) => { dummy.position.set(p.x, 0.2, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix); });
    root.add(pools);
    return () => { root.remove(pools); geometry.dispose(); material.dispose(); pools = null; };
  }
  return { update, dispose, setLampPools };
}
