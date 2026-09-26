import * as THREE from 'three';
import { CINEMA, LOUNGE, SCREEN, SCREEN_WALL, SEATS } from '../../models/worldTour/venues.js';

// The Lounge and the Open-Air Cinema (venues.js). Static parts go through the city's batched `box`; the dance floor's
// changing colours and the cinema screen (a video texture while a film plays, a painted programme board otherwise)
// are live meshes updated every frame.
const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function buildVenues(root, { box, label, glowMaterial, geometries, color }) {
  const disposables = [];
  // ---- Lounge: a wooden deck with a lit dance floor, a DJ booth, a bar and sofas round the floor.
  const L = (x, z) => [LOUNGE.x + x, LOUNGE.z + z];
  box([84, 0.16, 84], '#6b5646', [LOUNGE.x, 0.08, LOUNGE.z]);
  for (let i = -40; i <= 40; i += 4) box([0.08, 0.02, 84], '#584638', [LOUNGE.x + i, 0.17, LOUNGE.z]);
  const djGlow = glowMaterial('#2a2f45', 1.2, color), barGlow = glowMaterial('#3a2a22', 0.9, '#ffb86b');
  box([10, 1.3, 2.4], '#1d2130', [...L(0, -14).slice(0, 1), 0.8, LOUNGE.z - 14], 0, djGlow); // DJ booth
  box([3, 0.12, 1.2], '#101216', [LOUNGE.x - 1.5, 1.52, LOUNGE.z - 14]); box([3, 0.12, 1.2], '#101216', [LOUNGE.x + 1.5, 1.52, LOUNGE.z - 14]);
  for (const side of [-1, 1]) { box([1.8, 3.4, 1.6], '#15171c', [LOUNGE.x + side * 7.5, 1.8, LOUNGE.z - 14]); for (const y of [1.2, 2.6]) box([1.2, 0.9, 0.1], '#2b2f38', [LOUNGE.x + side * 7.5, y, LOUNGE.z - 13.15]); }
  box([12, 0.3, 0.3], '#20242c', [LOUNGE.x, 5.2, LOUNGE.z - 15.5]); for (const x of [-4.5, -1.5, 1.5, 4.5]) box([0.5, 0.5, 0.5], '#f8d47a', [LOUNGE.x + x, 4.8, LOUNGE.z - 15.3], 0, glowMaterial('#f8d47a', 1.6));
  box([2.4, 1.2, 22], '#4a3326', [LOUNGE.x - 22, 0.7, LOUNGE.z], 0, barGlow); box([3, 0.12, 22.6], '#d9c7a8', [LOUNGE.x - 22, 1.36, LOUNGE.z]); // bar
  box([0.6, 3.2, 20], '#2a1f19', [LOUNGE.x - 25, 1.8, LOUNGE.z]); for (let z = -8; z <= 8; z += 2) box([0.3, 0.6, 0.3], ['#9fd6ff', '#ffb86b', '#86edcb', '#ff8a9e'][Math.abs(z / 2) % 4], [LOUNGE.x - 24.6, 2.6, LOUNGE.z + z]);
  for (let z = -9; z <= 9; z += 3) { box([0.5, 0.8, 0.5], '#b8b0a4', [LOUNGE.x - 19.8, 0.4, LOUNGE.z + z]); box([0.8, 0.12, 0.8], '#2b2f38', [LOUNGE.x - 19.8, 0.86, LOUNGE.z + z]); }
  // Sofas (two seats each) with a low table in front, facing the dance floor.
  const lounge = SEATS.lounge;
  for (let i = 0; i < lounge.length; i += 2) {
    const a = lounge[i], b = lounge[i + 1], cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, h = a.heading, fx = Math.sin(h), fz = Math.cos(h);
    box([3.6, 0.5, 1.2], '#3b5f6b', [cx, 0.3, cz], h); box([3.6, 1, 0.35], '#324f59', [cx - fx * 0.6, 0.8, cz - fz * 0.6], h);
    for (const side of [-1, 1]) box([0.3, 0.8, 1.2], '#324f59', [cx + fz * side * 1.95, 0.5, cz - fx * side * 1.95], h);
    box([2.2, 0.45, 1], '#2b2521', [cx + fx * 2.2, 0.25, cz + fz * 2.2], h);
  }
  // String lights round the deck and planters at the corners.
  const bulbs = glowMaterial('#fff1c9', 1.8, '#ffd98a');
  for (let i = -38; i <= 38; i += 4) for (const [x, z] of [[i, -40], [i, 40], [-40, i], [40, i]]) box([0.35, 0.35, 0.35], '#fff1c9', [LOUNGE.x + x, 5 + Math.sin(i * 0.4) * 0.3, LOUNGE.z + z], 0, bulbs);
  for (const [x, z] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) { box([0.3, 5.6, 0.3], '#3a3f47', [LOUNGE.x + x, 2.8, LOUNGE.z + z]); box([2.2, 1, 2.2], '#8a6a4b', [LOUNGE.x + x * 0.9, 0.5, LOUNGE.z + z * 0.9]); box([1.8, 1.6, 1.8], '#4f7b58', [LOUNGE.x + x * 0.9, 1.6, LOUNGE.z + z * 0.9]); }
  label(LOUNGE.name.toUpperCase(), LOUNGE.x, LOUNGE.z + 40, color, 8.5, 1.2);
  // The dance floor: 16 tiles that cycle through colours.
  const tile = new THREE.BoxGeometry(3.9, 0.1, 3.9); disposables.push(tile);
  const tiles = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ff5c8a' }); disposables.push(mat);
    const m = new THREE.Mesh(tile, mat); m.position.set(LOUNGE.x - 6 + i * 4, 0.22, LOUNGE.z - 6 + j * 4); root.add(m); tiles.push({ m, i, j });
  }

  // ---- Cinema: a paved yard, the screen on its wall, rows of seats facing it and a projection booth at the back.
  box([84, 0.14, 84], '#4d5359', [CINEMA.x, 0.07, CINEMA.z]);
  box([SCREEN_WALL.width, SCREEN_WALL.height, SCREEN_WALL.depth], '#1c2530', [SCREEN_WALL.x, SCREEN_WALL.height / 2, SCREEN_WALL.z]);
  box([SCREEN.width + 2, SCREEN.height + 2, 0.3], '#0b0f14', [SCREEN.x, SCREEN.y, SCREEN.z - 0.3]);
  const marquee = glowMaterial('#2a2f45', 1.4, '#ffd98a');
  box([SCREEN_WALL.width, 1.6, 0.6], '#2a2f45', [SCREEN_WALL.x, SCREEN_WALL.height - 0.8, SCREEN_WALL.z + 1.4], 0, marquee);
  const rows = [...new Set(SEATS.cinema.map(s => s.z))];
  for (const z of rows) {
    box([33.5, 0.5, 1], '#7a2e36', [CINEMA.x, 0.3, z]); box([33.5, 1, 0.3], '#6a2830', [CINEMA.x, 0.9, z + 0.6]);
    for (const x of [-16.9, 16.9]) box([0.3, 0.9, 1.2], '#3a3f47', [CINEMA.x + x, 0.5, z]);
  }
  box([8, 5, 5], '#2a2f38', [CINEMA.x, 2.5, CINEMA.z + 32]); box([1.2, 1.2, 0.3], '#fff1c9', [CINEMA.x, 3.6, CINEMA.z + 29.4], 0, glowMaterial('#fff1c9', 2));
  for (let i = -38; i <= 38; i += 6) for (const x of [-40, 40]) box([0.35, 0.35, 0.35], '#fff1c9', [CINEMA.x + x, 4.2, CINEMA.z + i], 0, bulbs);
  for (let i = -38; i <= 38; i += 6) for (const x of [-40, 40]) box([0.15, 4.2, 0.15], '#3a3f47', [CINEMA.x + x, 2.1, CINEMA.z + i]);
  label(CINEMA.name.toUpperCase(), CINEMA.x, CINEMA.z + 40, '#ffd98a', 8.5, 1.2);
  // The screen: the film's frames while one is playing; otherwise the programme board.
  const board = document.createElement('canvas'); board.width = 1024; board.height = 576;
  const boardTexture = new THREE.CanvasTexture(board); boardTexture.colorSpace = THREE.SRGBColorSpace; disposables.push(boardTexture);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: boardTexture, toneMapped: false }); disposables.push(screenMaterial);
  const plane = new THREE.PlaneGeometry(SCREEN.width, SCREEN.height); geometries.add(plane);
  const screen = new THREE.Mesh(plane, screenMaterial); screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z); root.add(screen);
  let videoTexture = null, boardKey = '';
  function paint(cinema) {
    const show = cinema?.show, status = cinema?.status || 'loading';
    const lines = show ? (show.intermission ? [`Next ${show.item.kind === 'show' ? 'show' : 'movie'}`, show.item.title, `Starts in ${fmt(show.startsIn)}`] : ['Now showing', show.item.title, 'Loading the film…'])
      : status === 'loading' ? ['Tonight', 'Loading the programme…', ''] : status === 'empty' || status === 'offline' ? ['Coming soon', 'No films yet', 'The site owner adds them in Supabase Storage (cinema)'] : ['Sorry', 'The films could not be loaded', ''];
    const key = lines.join('|'); if (key === boardKey) return; boardKey = key;
    const ctx = board.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 576);
    g.addColorStop(0, '#141b2e'); g.addColorStop(1, '#2b1a2e'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 576);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 34px Arial, sans-serif'; ctx.fillText('OPEN-AIR CINEMA', 512, 90);
    ctx.fillStyle = '#c9d2e0'; ctx.font = '32px Arial, sans-serif'; ctx.fillText(lines[0].toUpperCase(), 512, 220);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px Arial, sans-serif'; ctx.fillText(lines[1], 512, 310, 940);
    ctx.fillStyle = '#9fb0c8'; ctx.font = '30px Arial, sans-serif'; ctx.fillText(lines[2], 512, 390, 940);
    boardTexture.needsUpdate = true;
  }
  return {
    update(s, time) {
      // Dance floor: a slow wave of colour across the tiles, brighter at night.
      for (const { m, i, j } of tiles) m.material.color.setHSL(((time * 0.08 + (i + j) * 0.09) % 1 + 1) % 1, 0.75, 0.45 + Math.sin(time * 3 + i * 1.7 + j) * 0.12);
      const cinema = s.cinema;
      if (cinema?.live) {
        if (!videoTexture || videoTexture.image !== cinema.video) { videoTexture?.dispose(); videoTexture = new THREE.VideoTexture(cinema.video); videoTexture.colorSpace = THREE.SRGBColorSpace; }
        if (screenMaterial.map !== videoTexture) { screenMaterial.map = videoTexture; screenMaterial.needsUpdate = true; }
      } else {
        paint(cinema);
        if (screenMaterial.map !== boardTexture) { screenMaterial.map = boardTexture; screenMaterial.needsUpdate = true; }
      }
    },
    dispose() { root.remove(screen, ...tiles.map(t => t.m)); videoTexture?.dispose(); disposables.forEach(d => d.dispose()); },
  };
}
