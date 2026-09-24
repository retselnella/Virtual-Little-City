import { useState } from 'react';
import { CITIES, CONTRACTS } from '../../models/worldTour/worldAdventure.js';
import { formatClock } from '../../models/worldTour/worldClock.js';
import { ExperienceDialog } from '../shared/ExperienceDialog.jsx';
import { IslandLayers, MAP_VIEW, PlayerArrow } from './islandMap.jsx';
// Connection chip: who else is here, and whether this is the shared online world or the same-browser fallback.
function onlineLabel({ status, peers }) {
  const others = peers.length, players = `${others} other player${others === 1 ? '' : 's'} here`;
  if (status.state === 'error') return ['offline', 'Offline · playing solo'];
  if (status.mode === 'local') return ['local', `Local · ${others} other tab${others === 1 ? '' : 's'}`];
  if (status.state !== 'online') return ['connecting', 'Connecting to the shared world…'];
  return ['online', `Online · ${players}`];
}
// Sun, moon, cloud, rain and storm glyphs for the sky chip.
function SkyIcon({ sky }) {
  const night = sky.phase === 'night', body = night
    ? <path d="M15 4a8 8 0 1 0 7 11A6.5 6.5 0 0 1 15 4Z" fill="#dfe6ff" />
    : <g fill="#ffd27a"><circle cx="12" cy="12" r="5" />{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <rect key={a} x="11.2" y="1.5" width="1.6" height="3.4" rx=".8" transform={`rotate(${a} 12 12)`} />)}</g>;
  if (sky.kind === 'clear') return <svg className="sky-icon" viewBox="0 0 24 24" aria-hidden="true">{body}</svg>;
  const cloud = <path d="M7 19h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.4A4.8 4.8 0 0 0 7 19Z" fill={sky.kind === 'cloudy' ? '#e9eef2' : '#b9c3cd'} />;
  return <svg className="sky-icon" viewBox="0 0 24 24" aria-hidden="true">
    {sky.kind === 'cloudy' && <g transform="translate(-4 -4) scale(.8)">{body}</g>}{cloud}
    {sky.kind !== 'cloudy' && <g stroke="#8fc3ff" strokeWidth="1.6" strokeLinecap="round"><path d="M9 21l-1 2.4" /><path d="M13 21l-1 2.4" /><path d="M17 21l-1 2.4" /></g>}
    {sky.kind === 'storm' && <path d="M13 12l-3 5h3l-1.5 4.5L16 15h-3l1.5-3Z" fill="#ffd166" />}
  </svg>;
}

export default function WorldView({ controller, onEditCharacter }) {
  const { online, playerName, sky, weather, region, hud, panel, ready, error, storage, host, city, current, p, point, open, action, toggleBlood, touchControl, travel, dispatchTitle, dispatchHint, task, blood, acceptContract, abandonContract, recoverToSafehouse } = controller;
  const [mapTab, setMapTab] = useState('island');
  const clock = formatClock(sky.clock), [onlineState, onlineText] = onlineLabel(online);
  // The minimap follows you, zooming out with speed.
  const radius = hud.driving ? 300 + Math.min(260, Math.abs(hud.car.speed) * 8) : 260, k = radius / 460;
  const away = point ? Math.hypot(point.x - p.x, point.z - p.z) : 0, edge = point && away > radius * 0.86 ? Math.atan2(point.z - p.z, point.x - p.x) : null;
  const openMap = tab => { setMapTab(tab); open('world'); };
  const canTravel = !hud.mission && !(hud.heat > 0) && !(hud.down > 0) && ready && !error;
  return <div className={`adventure sky-${sky.kind} phase-${sky.phase}`} style={{ '--city-accent': city.color, '--night': sky.night.toFixed(2), '--wet': sky.rain.toFixed(2) }}>
    <div className="adventure-canvas" ref={host} />
    <header className="adventure-header">
      <a href="#world" onClick={e => { e.preventDefault(); openMap('island'); }} className="adventure-brand">lc<span>WORLD TOUR</span><i>✦</i></a>
      <div className="adventure-sky" title="Time follows the Philippines (PHT). Weather is shared by every city and every player.">
        <SkyIcon sky={sky} /><b>{clock}</b><small>PH TIME</small><span>{weather}</span>
      </div>
      <nav aria-label="World navigation">
        <button onClick={() => openMap('island')}>◎ <span>Map</span><kbd>M</kbd></button>
        <button onClick={() => open('contracts')}>◇ <span>Contracts</span><kbd>L</kbd></button>
        <button onClick={() => open('help')} aria-label="Controls and pause menu">Ⅱ</button>
      </nav>
    </header>
    <section className="adventure-location">
      <span className="adventure-kicker">{city.country} / {city.region}</span>
      <h1>{city.name}<span>.</span></h1>
      <div><i />{region}<span>FREE ROAM</span></div>
      <p className={'adventure-online ' + onlineState} role="status" aria-live="polite">{onlineText}</p>
    </section>
    <section className="adventure-stats" aria-label="Player status">
      <span className="adventure-player">{playerName.toUpperCase()}</span>
      <div className="wanted" aria-label={`Wanted level ${Math.ceil(hud.heat)}`}><span className={hud.heat >= 0.01 ? 'lit' : ''}>★</span><span className={hud.heat > 1 ? 'lit' : ''}>★</span><span className={hud.heat > 2 ? 'lit' : ''}>★</span></div>
      <strong>${hud.cash.toLocaleString()}</strong>
      <label className={hud.health < 35 ? 'low' : ''}><span>HEALTH</span><b>{Math.ceil(hud.health)}</b><progress max="100" value={hud.health} /></label>
      <div className="weapon-status"><span>{hud.driving ? 'SPORT COUPE' : hud.weapon === 'pistol' ? 'PISTOL' : 'UNARMED'}</span><b>{hud.driving ? `${Math.round(Math.abs(hud.car.speed) * 3.6)} km/h` : hud.reload > 0 ? 'RELOADING' : hud.weapon === 'pistol' ? `${hud.ammo} / ∞` : 'FISTS'}</b></div>
    </section>
    <section className="adventure-objective">
      <div className="adventure-kicker">{current ? current.type + ' / ACTIVE CONTRACT' : 'YOUR NEXT MOVE'}</div>
      <h2>{task}</h2>
      <p>{current ? `${current.title} · $${current.reward.toLocaleString()}` : 'Explore the whole island: beaches, the ring road, the lighthouse and the mountains.'}</p>
      {point && <span className="objective-distance">◇ {Math.round(away)} m <small>Follow the gold marker · E to interact</small></span>}
      <button onClick={() => open('contracts')}>{current ? 'Contract details' : 'Find a contract'} <span>↗</span></button>
    </section>
    {hud.heat > 0 && <div className="adventure-dispatch" aria-label="Police response"><span>POLICE RESPONSE</span><strong>{dispatchTitle}</strong><small>{dispatchHint}</small></div>}
    {hud.messageTime > 0 && <div className="adventure-toast" role="status">{hud.message}</div>}
    {hud.down > 0 && <div className={'adventure-wasted' + (hud.downReason === 'busted' ? ' busted' : '')}><h2>{hud.downReason === 'busted' ? 'BUSTED' : 'WASTED'}</h2><p>{hud.downReason === 'busted' ? 'Released at your safehouse…' : 'Returning to your safehouse…'}</p></div>}
    {!ready && !error && <div className="adventure-loading"><span className="loading-ring" />Building your island…</div>}
    {error && <div className="adventure-loading"><strong>The city needs WebGL.</strong><p>Enable hardware acceleration and reload to play.</p><button onClick={() => location.reload()}>Reload</button></div>}
    <div className="adventure-bottom">
      <section className="adventure-radar" aria-label="Island minimap">
        <div className="radar-dial">
          <svg viewBox={`${p.x - radius} ${p.z - radius} ${radius * 2} ${radius * 2}`} role="img" aria-label="Minimap: the island around you, your car and your destination">
            <IslandLayers hud={hud} online={online} p={p} point={point} k={k} />
            {edge !== null && <g className="objective-edge" transform={`translate(${p.x + Math.cos(edge) * radius * 0.84} ${p.z + Math.sin(edge) * radius * 0.84}) rotate(${edge * 180 / Math.PI + 90}) scale(${k})`}><polygon points="0,-26 20,14 -20,14" fill="#f8d47a" stroke="#152b32" strokeWidth="5" /></g>}
            <PlayerArrow p={p} k={k * 1.5} />
          </svg>
          <span className="radar-north" aria-hidden="true">N</span>
        </div>
        <footer><span><i /> {hud.driving ? 'IN VEHICLE' : 'ON FOOT'} · {region}</span><button onClick={() => openMap('island')}>Map ↗</button></footer>
      </section>
      <div className="adventure-hints"><span><kbd>W A S D</kbd> {hud.driving ? 'Drive' : 'Move'}</span><span><kbd>F</kbd> {hud.driving ? 'Exit car' : 'Enter car'}</span><span><kbd>J</kbd> Attack</span><span><kbd>E</kbd> Interact</span><span><kbd>M</kbd> Map</span><small>Drag to look · Scroll to zoom</small></div>
      <div className="adventure-actions"><button disabled={!ready || error} onClick={() => action('vehicle')}>{hud.driving ? 'Exit car' : 'Enter car'} <kbd>F</kbd></button><button disabled={!ready || error || hud.driving} {...touchControl('attack')}>Attack <kbd>J</kbd></button><button disabled={!ready || error} onClick={() => action('interact')}>Interact <kbd>E</kbd></button><button onClick={() => action('weapon')}>{hud.weapon === 'pistol' ? 'Use fists' : 'Use pistol'} <kbd>Q</kbd></button><button onClick={() => action('reload')}>Reload <kbd>R</kbd></button></div>
    </div>
    <div className="adventure-touch" aria-label="Touch movement controls">{[['forward', '↑'], ['left', '←'], ['backward', '↓'], ['right', '→'], ['run', 'Run'], ['brake', hud.driving ? 'Brake' : 'Jump']].map(([key, title]) => <button key={key} className={'control-' + key} aria-label={key} {...touchControl(key)}>{title}</button>)}</div>
    {panel === 'world' && <ExperienceDialog title={mapTab === 'island' ? `${city.name} island.` : 'One world. Your next chapter.'} className="adventure-dialog world-dialog" onClose={() => open(null)}>
      <div className="map-tabs" role="tablist" aria-label="Map views">
        <button role="tab" aria-selected={mapTab === 'island'} onClick={() => setMapTab('island')}>Island map</button>
        <button role="tab" aria-selected={mapTab === 'travel'} onClick={() => setMapTab('travel')}>Fly to a city</button>
      </div>
      {mapTab === 'island' ? <div className="island-map" role="tabpanel">
        <svg viewBox={`${MAP_VIEW.x} ${MAP_VIEW.z} ${MAP_VIEW.width} ${MAP_VIEW.height}`} role="img" aria-label={`Map of the island. You are in ${region}.`}>
          <IslandLayers hud={hud} online={online} p={p} point={point} k={2.6} labels district={city.district} />
          <PlayerArrow p={p} k={2.6} />
        </svg>
        <aside>
          <p className="island-where"><small>YOU ARE IN</small><strong>{region}</strong></p>
          <div className="island-sky"><SkyIcon sky={sky} /><div><strong>{clock} <small>Philippine time</small></strong><span>{weather}. The whole world shares this sky: when it rains here, it rains in every city.</span></div></div>
          <ul className="map-legend">
            <li><i style={{ background: '#fff' }} />You</li><li><i style={{ background: '#64ddd1' }} />Your car</li><li><i style={{ background: '#87c7a1' }} />Safehouse</li>
            <li><i style={{ background: '#f8d47a' }} />Objective</li><li><i style={{ background: '#ffa860' }} />Lighthouse</li><li><i style={{ background: '#f8f1a8' }} />Other players</li><li><i style={{ background: '#ff6d82' }} />Gang · <i style={{ background: '#88aaff' }} />police</li>
          </ul>
          <p className="island-tip">Take the Ring Road out of the city to reach the beaches, the farmland, the Lighthouse Cape and the foot of Mount Alon. The south hills are gentle enough to climb.</p>
        </aside>
      </div> : <div role="tabpanel">
        <p>Travel between seven island cities. Every city has its own skyline, streets, and three contracts.</p>
        <div className="atlas"><svg viewBox="0 0 1000 440" aria-label="World travel map"><defs><pattern id="atlas-grid" width="50" height="44" patternUnits="userSpaceOnUse"><path d="M50 0H0V44" fill="none" stroke="#ffffff0b" /></pattern></defs><rect width="1000" height="440" fill="url(#atlas-grid)" /><g fill="#354b52" stroke="#6c8184" strokeWidth="1"><path d="M75 75L150 35 275 65 300 105 255 145 245 195 215 220 185 170 135 140Z" /><path d="M270 210L350 225 385 270 350 325 305 400 295 310 265 260Z" /><path d="M435 83L485 58 535 73 555 130 495 149 445 127Z" /><path d="M450 152L532 143 587 210 551 280 510 367 477 302 451 230 425 189Z" /><path d="M543 64L677 40 800 60 930 110 862 171 821 222 765 210 723 155 674 192 629 145 565 140Z" /><path d="M786 307L866 285 927 335 887 371 804 365Z" /><path d="M329 40L379 32 395 75 356 100Z" /></g>{CITIES.map(c => <g key={c.id} transform={`translate(${c.map[0] * 10} ${c.map[1] * 4.4})`}><circle r={c.id === city.id ? 12 : 7} fill={c.color} opacity=".3" /><circle r="4" fill={c.color} /><text x="10" y="-10" fill="#f3ece1" fontSize="13">{c.name}</text></g>)}</svg></div>
        {!canTravel && ready && !error && <p className="travel-notice">Finish or abandon your contract and lose the police before flying.</p>}
        <div className="destination-grid">{CITIES.map(c => <button key={c.id} className={city.id === c.id ? 'selected' : ''} disabled={city.id === c.id || !canTravel} onClick={() => travel(c.id)} style={{ '--destination-color': c.color }}><small>{c.country}</small><strong>{c.name}<span>{city.id === c.id ? '●' : '↗'}</span></strong><span>{c.district} · {hud.completed.filter(k => k.startsWith(c.id + ':')).length}/3 contracts{online.counts[c.id] ? ` · ${online.counts[c.id]} online` : ''}</span></button>)}</div>
        <small className="travel-note">Stylized island cities connected by instant flights, not a real-scale Earth simulation.</small>
      </div>}
    </ExperienceDialog>}
    {panel === 'contracts' && <ExperienceDialog title="Good work. Better pay." className="adventure-dialog" onClose={() => open(null)}><p>Available in {city.name}. Follow the gold marker, stop, then press E at the objective. Combat locks onto the nearest visible enemy in range.</p><div className="world-contracts">{CONTRACTS.map(m => { const done = hud.completed.includes(`${city.id}:${m.id}`); return <article key={m.id}><div><small>{m.type}</small><b>${m.reward.toLocaleString()}</b></div><h3>{m.title}</h3><p>{m.description}</p><button disabled={done || !!hud.mission || !ready || error || hud.down > 0} onClick={() => acceptContract(m.id)}>{done ? '✓ Completed' : hud.mission?.id === m.id ? 'In progress' : 'Accept contract ↗'}</button></article>; })}</div>{hud.mission && <button className="adventure-secondary" onClick={abandonContract}>Abandon current contract</button>}<p className="adventure-save">{storage ? 'Cash and completed contracts save automatically on this browser. Unfinished contracts restart after reloading.' : 'Browser storage is unavailable. Progress lasts for this session.'} {hud.completed.length}/21 completed.</p></ExperienceDialog>}
    {panel === 'help' && <ExperienceDialog title="Make yourself at home." className="adventure-dialog" onClose={() => open(null)}><p>The game is paused. Explore the island on foot or take your cyan coupe. Pick up contracts and fly to another country from the map.</p><div className="adventure-help">{[['WASD / arrows', 'Move or drive'], ['Shift / Space', 'Sprint / jump; Space is the handbrake while driving'], ['F', 'Enter or exit your car (stop first)'], ['J / Attack', 'Shoot or punch; the ring shows who you will hit. Hold to keep firing'], ['Q / R', 'Switch fists / pistol; reload (automatic when empty)'], ['E', 'Collect, deliver, or heal at the green safehouse'], ['M / L', 'Island map and flights / contracts'], ['Drag / scroll', 'Look around / zoom']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div><p>Day and night follow the time in the Philippines, and the weather is shared by the whole world: when it rains in one city, it rains in all of them, for every player. Shots and attacks attract police. Patrol cars respond by road and chase you while they can see you; out of sight, they search your last known location. At one star, officers try to arrest you on foot: stand still and you are busted and fined. Hurting bystanders or officers raises your stars, and at two or more officers open fire. Stop attacking for 12 seconds and stay out of police sight for 8 seconds to begin losing heat. Aim with the camera: the pistol locks onto threats first and only onto bystanders in front of you. Punches chain into a three-hit combo whose last hook knocks people down. Children are never targets. At zero health you respawn and can restart your contract. Return to the green safehouse and press E on foot to heal. Other players in your city appear with their own look and name tag (and in their car while driving) and on the minimap. Traffic, pedestrians, police and contracts are your own; you cannot collide with or fight other players.</p><div className="adventure-menu-actions"><button onClick={() => open(null)}>Resume game ↗</button><button aria-pressed={blood} onClick={toggleBlood}>Blood effects: {blood ? 'On' : 'Off'}</button><button onClick={recoverToSafehouse}>Recover to safehouse</button><button onClick={() => { open(null); onEditCharacter?.(); }}>Edit character</button></div></ExperienceDialog>}
  </div>;
}
