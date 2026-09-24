import { ROADS } from '../../models/worldTour/worldAdventure.js';
import { ACTIVE_UNIT } from '../../models/worldTour/worldPolice.js';
import { CITY_EDGE, MARINA, lakeShore } from '../../models/worldTour/worldIsland.js';
import { METRO, STATIONS } from '../../models/worldTour/metro.js';

// An island drawn in world coordinates (x right, z down, north up), shared by the minimap and the full map. The static
// layers are built once per island and cached.
const path = (points, close = true) => points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.z)}`).join('') + (close ? 'Z' : '');
const FORM_FILL = { volcano: '#5d5a54', basalt: '#4f4944', terrace: '#6f9f47', dune: '#c9a86e', sand: '#bfae80', mesa: '#9a5f45', granite: '#77746f', downs: '#5f8750', rock: '#6f6a62', forest: '#3f6440' };
const layers = new WeakMap();
function staticLayers(island) {
  if (layers.has(island)) return layers.get(island);
  const ellipse = (f, scale = 1) => { const c = Math.cos(f.turn), s = Math.sin(f.turn); return path(Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2, u = Math.cos(a) * f.rx * scale, v = Math.sin(a) * f.rz * scale; return { x: f.x + u * c - v * s, z: f.z + u * s + v * c }; })); };
  let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
  for (const p of island.coastline(120, -40)) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const value = {
    view: { x: Math.round(minX - 40), z: Math.round(minZ - 40), width: Math.round(maxX - minX + 80), height: Math.round(maxZ - minZ + 80) },
    shallows: path(island.coastline(160, -60)), sand: path(island.coastline(180, 0)), grass: path(island.coastline(180, 55)),
    forest: island.forestCells.map(c => `M${c.x - 28} ${c.z}a28 28 0 1 0 56 0a28 28 0 1 0 -56 0`).join(''),
    routes: island.routes.map(route => ({ street: route.id.startsWith('suburb'), d: path(route.points, false) })),
    lakes: island.lakes.map(l => path(lakeShore(l, 32))),
    forms: island.forms.map(f => ({ id: f.id, d: ellipse(f), fill: FORM_FILL[f.colors] || FORM_FILL.forest, top: f.snow ? ellipse(f, 1 - f.snow) : f.kind === 'frustum' ? ellipse(f, f.top) : f.kind === 'volcano' ? ellipse(f, 0.35) : null, topFill: f.snow ? '#e8eef0' : f.kind === 'volcano' ? '#3f3a36' : '#b98a6a' })),
    houses: island.structures.filter(s => s.house || s.favela).map(s => `M${Math.round(s.x - s.w / 2)} ${Math.round(s.z - s.d / 2)}h${Math.round(s.w)}v${Math.round(s.d)}h${-Math.round(s.w)}Z`).join(''),
  };
  layers.set(island, value);
  return value;
}
export const mapView = island => staticLayers(island).view;

// `k` scales markers so they keep the same on-screen size at any zoom (1 = the old 920-unit city minimap).
export function IslandLayers({ island, hud, online, p, point, k = 1, labels = false, district = '' }) {
  const L = staticLayers(island), h = METRO.half;
  return <>
    <rect x="-8000" y="-8000" width="16000" height="16000" fill="#10303c" />
    <path d={L.shallows} fill="#1b4b55" /><path d={L.sand} fill={island.theme.ground.sand} opacity=".85" /><path d={L.grass} fill={island.theme.desert ? '#8a7650' : '#3c5b45'} /><path d={L.forest} fill="#2f4b37" />
    {island.fields.map(f => <rect key={f.id} x={f.x - f.width / 2} y={f.z - f.depth / 2} width={f.width} height={f.depth} fill={f.kind === 'paddy' ? '#4f8f8a' : '#8a8a55'} />)}
    {L.lakes.map((d, i) => <path key={i} d={d} fill="#2f7486" stroke="#8d8a63" strokeWidth="6" />)}
    {L.forms.map(f => <g key={f.id}><path d={f.d} fill={f.fill} />{f.top && <path d={f.top} fill={f.topFill} />}</g>)}
    <rect x={-CITY_EDGE + 15} y={-CITY_EDGE + 15} width={CITY_EDGE * 2 - 30} height={CITY_EDGE * 2 - 30} fill="#233639" />
    {L.routes.map((r, i) => <path key={i} d={r.d} fill="none" stroke="#8d9a93" strokeWidth={r.street ? Math.max(6, 8 * k) : Math.max(9, 12 * k)} strokeLinejoin="round" />)}
    <path d={L.houses} fill="#b88a5c" />
    {hud.blocks.map((b, i) => <rect key={i} x={b.x - b.width / 2} y={b.z - b.depth / 2} width={b.width} height={b.depth} fill={b.hub ? '#7fc7b0' : '#46595a'} />)}
    {ROADS.map(n => <g key={n} stroke="#8d9a93" strokeWidth="9"><path d={`M${n} -440V440`} /><path d={`M-440 ${n}H440`} /></g>)}
    <rect x={-h} y={-h} width={h * 2} height={h * 2} fill="none" stroke="#6fb2e6" strokeWidth={Math.max(4, 5 * k)} strokeDasharray={`${16 * k} ${8 * k}`} />
    {STATIONS.map(st => <circle key={st.id} cx={st.x} cy={st.z} r={13 * k} fill="#2f6fb0" stroke="#dff1ff" strokeWidth={4 * k}><title>{st.name} station</title></circle>)}
    <rect x={MARINA.x0} y={MARINA.z - 5} width={MARINA.x1 - MARINA.x0} height="10" fill="#b99468" />
    <circle cx={hud.boat.x} cy={hud.boat.z} r={14 * k} fill="#9fd6ff" stroke="#10303c" strokeWidth={4 * k} />
    <circle cx={island.landmarks.lighthouse.x} cy={island.landmarks.lighthouse.z} r={16 * k} fill="#ffa860" />
    {labels && <g className="map-labels" fontSize="46" textAnchor="middle">
      {island.labels.map(l => <text key={l.text} x={l.x} y={l.z}>{l.text}</text>)}
      <text x="0" y="-480" className="map-city">{district}</text>
    </g>}
    <circle cx="8" cy="12" r={18 * k} fill="#87c7a1" />
    <circle cx={hud.car.x} cy={hud.car.z} r={15 * k} fill="#64ddd1" />
    {hud.heat > 0 && hud.unseen > 4 && hud.lastSeen && <circle cx={hud.lastSeen.x} cy={hud.lastSeen.z} r="70" fill="#88aaff1c" stroke="#88aaff70" strokeWidth={4 * k} strokeDasharray="10 8" />}
    {hud.policeCars.map(c => <rect key={c.id} x={c.x - 12 * k} y={c.z - 12 * k} width={24 * k} height={24 * k} rx={5 * k} fill={ACTIVE_UNIT.includes(c.state) ? (Math.floor(hud.time * 4) % 2 ? '#ff6d82' : '#6d9dff') : '#5d7597'} />)}
    {online.peers.map(peer => <circle key={peer.id} className="remote-player" cx={peer.x} cy={peer.z} r={15 * k} fill="#f8f1a8" stroke="#152b32" strokeWidth={5 * k}><title>{peer.name}</title></circle>)}
    {hud.enemies.filter(e => e.health > 0).map(e => <circle key={e.id} cx={e.x} cy={e.z} r={13 * k} fill={e.kind === 'police' ? '#88aaff' : '#ff6d82'} />)}
    {point && <g><path d={`M${p.x} ${p.z}L${point.x} ${point.z}`} stroke="#f8d47a" strokeWidth={4 * k} strokeDasharray={`${12 * k} ${10 * k}`} /><circle cx={point.x} cy={point.z} r={23 * k} fill="#f8d47a" /></g>}
  </>;
}
export function PlayerArrow({ p, k = 1 }) {
  return <path d="M0 -24L17 18L0 11L-17 18Z" fill="white" stroke="#152b32" strokeWidth="5" transform={`translate(${p.x} ${p.z}) rotate(${180 - p.heading * 180 / Math.PI}) scale(${k})`} />;
}
