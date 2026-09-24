import { ROADS } from '../../models/worldTour/worldAdventure.js';
import { ACTIVE_UNIT } from '../../models/worldTour/worldPolice.js';
import { CITY_EDGE, LANDMARKS, MOUNTAINS, ROUTES, coastline } from '../../models/worldTour/worldIsland.js';

// The island drawn in world coordinates (x right, z down, north up), shared by the minimap and the full map.
const path = points => points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.z)}`).join('') + 'Z';
const SHALLOWS = path(coastline(160, -60)), SAND = path(coastline(180, 0)), GRASS = path(coastline(180, 55));
const ROUTE_PATHS = ROUTES.map(route => route.points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.z)}`).join(''));
const SUMMIT = MOUNTAINS[0];
export const MAP_LABELS = [
  { text: 'Mount Alon', x: SUMMIT.x, z: SUMMIT.z + SUMMIT.radius + 70 }, { text: 'Lighthouse Cape', x: LANDMARKS.lighthouse.x + 60, z: LANDMARKS.lighthouse.z + 110 },
  { text: 'Northern Woods', x: 120, z: -760 }, { text: 'Southern Farmland', x: 30, z: 690 }, { text: 'South Hills', x: -520, z: 760 }, { text: 'Western Plains', x: -900, z: 330 },
];
export const MAP_VIEW = { x: -1380, z: -1390, width: 1960, height: 2780 };

// `k` scales markers so they keep the same on-screen size at any zoom (1 = the old 920-unit city minimap).
export function IslandLayers({ hud, online, p, point, k = 1, labels = false, district = '' }) {
  return <>
    <rect x="-4000" y="-4000" width="8000" height="8000" fill="#10303c" />
    <path d={SHALLOWS} fill="#1b4b55" /><path d={SAND} fill="#c7b889" /><path d={GRASS} fill="#3c5b45" />
    {MOUNTAINS.map(m => <g key={m.id}>
      <circle cx={m.x} cy={m.z} r={m.radius} fill={m.kind === 'hill' ? '#4d6f4b' : '#56645a'} />
      {m.kind !== 'hill' && <circle cx={m.x - m.radius * 0.12} cy={m.z - m.radius * 0.12} r={m.radius * 0.55} fill="#77817a" />}
      {m.snow && <circle cx={m.x - m.radius * 0.18} cy={m.z - m.radius * 0.18} r={m.radius * 0.22} fill="#e8eef0" />}
    </g>)}
    <rect x={-CITY_EDGE + 15} y={-CITY_EDGE + 15} width={CITY_EDGE * 2 - 30} height={CITY_EDGE * 2 - 30} fill="#233639" />
    {ROUTE_PATHS.map((d, i) => <path key={i} d={d} fill="none" stroke="#8d9a93" strokeWidth={Math.max(9, 12 * k)} strokeLinejoin="round" />)}
    {hud.blocks.map((b, i) => <rect key={i} x={b.x - b.width / 2} y={b.z - b.depth / 2} width={b.width} height={b.depth} fill="#46595a" />)}
    {ROADS.map(n => <g key={n} stroke="#8d9a93" strokeWidth="9"><path d={`M${n} -440V440`} /><path d={`M-440 ${n}H440`} /></g>)}
    <circle cx={LANDMARKS.lighthouse.x} cy={LANDMARKS.lighthouse.z} r={16 * k} fill="#ffa860" />
    {labels && <g className="map-labels" fontSize="46" textAnchor="middle">
      {MAP_LABELS.map(l => <text key={l.text} x={l.x} y={l.z}>{l.text}</text>)}
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
