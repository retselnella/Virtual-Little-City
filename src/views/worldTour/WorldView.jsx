import { useState } from 'react';
import { CITIES, CONTRACTS, reachableNear } from '../../models/worldTour/worldAdventure.js';
import { formatClock } from '../../models/worldTour/worldClock.js';
import { ExperienceDialog } from '../shared/ExperienceDialog.jsx';
import { IslandLayers, PlayerArrow, mapView } from './islandMap.jsx';
import { THEMES, AIRPORT, MARINA } from '../../models/worldTour/worldIsland.js';
import { STATIONS, nearestStation } from '../../models/worldTour/metro.js';
import { voyage } from '../../models/worldTour/worldBoat.js';
import { BOSS_NAME } from '../../models/worldTour/bossRules.js';
import { BossBanner, BossHits, BossPanel, WorldAtlas } from './bossViews.jsx';
import { ShopPanel, WeaponBar } from './weaponViews.jsx';
import { GUN_SHOP, WEAPONS } from '../../models/worldTour/weapons.js';
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

// A compass bearing in words, for sailing directions.
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compass = bearing => POINTS[Math.round(((Math.PI - bearing) / (Math.PI * 2)) * 8 + 8) % 8];

export default function WorldView({ controller, onEditCharacter }) {
  const { boss, claimRewards, online, playerName, sky, weather, region, island, prompt, canFly, sail, stopSailing, guide, hud, panel, ready, error, storage, host, city, current, p, point, open, action, toggleBlood, touchControl, travel, buy, equipWeapon, dispatchTitle, dispatchHint, task, blood, acceptContract, abandonContract, recoverToSafehouse } = controller;
  const [mapTab, setMapTab] = useState('world'), [picked, setPicked] = useState(null);
  const now = boss.clock.current(), bossEvent = boss.event;
  const clock = formatClock(sky.clock), [onlineState, onlineText] = onlineLabel(online);
  const course = hud.course, sailing = hud.boating && course;
  // The minimap follows you, zooming out with speed (and further at sea).
  const speed = Math.abs((hud.driving ? hud.car : hud.boating ? hud.boat : hud.player).speed || 0);
  const radius = hud.boating ? 420 + Math.min(300, speed * 10) : hud.driving ? 300 + Math.min(260, speed * 8) : 260, k = radius / 460;
  // The edge arrow points to an off-map objective, or along the sailing bearing when you are at sea.
  const target = sailing ? { x: p.x + Math.sin(course.bearing) * 5000, z: p.z + Math.cos(course.bearing) * 5000 } : point;
  const away = point ? Math.hypot(point.x - p.x, point.z - p.z) : 0, edge = target && Math.hypot(target.x - p.x, target.z - p.z) > radius * 0.86 ? Math.atan2(target.z - p.z, target.x - p.x) : null;
  const openMap = tab => { setMapTab(tab); open('world'); };
  const canTravel = !hud.mission && !(hud.heat > 0) && !(hud.down > 0) && ready && !error;
  const view = mapView(island), mapK = view.width / 780;
  const places = [
    { label: 'City Hub', x: 8, z: 12 }, ...(city.id === GUN_SHOP.city ? [{ label: 'Gun shop', ...GUN_SHOP.door }] : []), { label: 'Marina pier', x: MARINA.x0 + 40, z: MARINA.z }, { label: 'Airport', x: AIRPORT.x + 20, z: AIRPORT.z },
    { label: `${STATIONS[nearestStation(p.x, p.z)].name} metro station`, ...STATIONS[nearestStation(p.x, p.z)].exit },
    { label: 'Lighthouse', x: island.landmarks.lighthouse.x + 22, z: island.landmarks.lighthouse.z },
    ...(island.landmarks.feature ? [{ label: island.landmarks.feature.name, ...reachableNear(island, { x: island.landmarks.feature.x, z: island.landmarks.feature.z + island.landmarks.feature.radius + 8 }) }] : []),
    ...island.suburbs.slice(0, 1).map(sb => ({ label: sb.name, x: sb.x, z: sb.z })),
    ...island.lakes.slice(0, 1).map(l => ({ label: l.name, x: l.x, z: l.z + l.rz + 20 })),
  ];
  const vehicle = hud.driving ? ['SPORT COUPE', `${Math.round(speed * 3.6)} km/h`] : hud.boating ? ['SPEEDBOAT', `${Math.round(speed * 3.6)} km/h`] : hud.riding ? ['METRO', STATIONS[hud.train.station ?? hud.train.next].name.toUpperCase()] : [WEAPONS[hud.weapon]?.gun ? WEAPONS[hud.weapon].name.toUpperCase() : 'UNARMED', hud.reload > 0 ? 'RELOADING' : WEAPONS[hud.weapon]?.gun ? `${hud.mags[hud.weapon]} / ∞` : 'FISTS'];
  // The left card: the contract, else the voyage, else the metro ride, else a nudge to explore.
  const card = current ? null : course ? {
    kicker: `SEA VOYAGE / ${course.name.toUpperCase()}`,
    title: !hud.boating ? 'Take your boat from the marina' : !course.openSea ? 'Head out to open sea' : course.onCourse ? `On course for ${course.name}` : `Turn ${compass(course.bearing)}`,
    text: !hud.boating ? 'Your speedboat is moored at the marina pier on the east waterfront. Follow the gold marker.' : `${(course.remaining / 1000).toFixed(1)} km of open sea to ${course.name}. Keep the arrow ahead; hold Shift for full power.`,
    arrow: hud.boating ? course.bearing - hud.boat.heading : null,
  } : hud.riding ? { kicker: 'CITY METRO', title: hud.train.station !== null ? `Stopped at ${STATIONS[hud.train.station].name}` : `Next stop: ${STATIONS[hud.train.next].name}`, text: 'Press E while the train is stopped to get off.' } : null;
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
        <button onClick={() => open('boss')} className={bossEvent?.phase === 'active' ? 'boss-live' : ''}>✸ <span>{BOSS_NAME}</span><kbd>B</kbd></button>
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
      <div className="weapon-status"><span>{vehicle[0]}</span><b>{vehicle[1]}</b></div>
    </section>
    <section className="adventure-objective">
      {card ? <>
        <div className="adventure-kicker">{card.kicker}</div>
        <h2>{card.arrow !== null && card.arrow !== undefined && <span className="bearing" style={{ transform: `rotate(${-card.arrow}rad)` }} aria-hidden="true">↑</span>}{card.title}</h2>
        <p>{card.text}</p>
        {course ? <button onClick={stopSailing}>Cancel course <span>×</span></button> : <button onClick={() => openMap('island')}>Open the map <span>↗</span></button>}
      </> : <>
        <div className="adventure-kicker">{current ? current.type + ' / ACTIVE CONTRACT' : 'YOUR NEXT MOVE'}</div>
        <h2>{current || !hud.waypoint ? task : `Head to ${hud.waypoint.label}`}</h2>
        <p>{current ? `${current.title} · $${current.reward.toLocaleString()}` : island.summary + '.'}</p>
        {point && <span className="objective-distance">◇ {Math.round(away)} m <small>{current ? 'Follow the gold marker · E to interact' : 'Follow the gold marker'}</small></span>}
        <button onClick={() => open('contracts')}>{current ? 'Contract details' : 'Find a contract'} <span>↗</span></button>
      </>}
    </section>
    {hud.heat > 0 && <div className="adventure-dispatch" aria-label="Police response"><span>POLICE RESPONSE</span><strong>{dispatchTitle}</strong><small>{dispatchHint}</small></div>}
    <BossBanner boss={boss} city={city} now={now} onOpen={() => open('boss')} onMap={() => openMap('world')} />
    <BossHits hits={boss.hits} />
    {hud.messageTime > 0 && <div className="adventure-toast" role="status">{hud.message}</div>}
    {prompt && ready && !error && <button className={'adventure-prompt' + (prompt.key ? '' : ' passive')} disabled={!prompt.action} onClick={() => prompt.action && action(prompt.action)}>{prompt.key && <kbd>{prompt.key}</kbd>}<span>{prompt.text}</span></button>}
    {hud.down > 0 && <div className={'adventure-wasted' + (hud.downReason === 'busted' ? ' busted' : '')}><h2>{hud.downReason === 'busted' ? 'BUSTED' : 'WASTED'}</h2><p>{hud.downReason === 'busted' ? 'Released at the City Hub…' : 'Returning to the City Hub…'}</p></div>}
    {!ready && !error && <div className="adventure-loading"><span className="loading-ring" />Building {city.name}…</div>}
    {error && <div className="adventure-loading"><strong>The city needs WebGL.</strong><p>Enable hardware acceleration and reload to play.</p><button onClick={() => location.reload()}>Reload</button></div>}
    {!hud.driving && !hud.boating && !hud.riding && <WeaponBar hud={hud} onEquip={equipWeapon} />}
    <div className="adventure-bottom">
      <section className="adventure-radar" aria-label="Island minimap">
        <div className="radar-dial">
          <svg viewBox={`${p.x - radius} ${p.z - radius} ${radius * 2} ${radius * 2}`} role="img" aria-label="Minimap: the island around you, your car and your destination">
            <IslandLayers island={island} hud={hud} online={online} p={p} point={point} k={k} />
            {edge !== null && <g className="objective-edge" transform={`translate(${p.x + Math.cos(edge) * radius * 0.84} ${p.z + Math.sin(edge) * radius * 0.84}) rotate(${edge * 180 / Math.PI + 90}) scale(${k})`}><polygon points="0,-26 20,14 -20,14" fill={sailing ? '#9fd6ff' : '#f8d47a'} stroke="#152b32" strokeWidth="5" /></g>}
            <PlayerArrow p={p} k={k * 1.5} />
          </svg>
          <span className="radar-north" aria-hidden="true">N</span>
        </div>
        <footer><span><i /> {hud.driving ? 'IN VEHICLE' : hud.boating ? 'AT SEA' : hud.riding ? 'ON THE METRO' : 'ON FOOT'} · {region}</span><button onClick={() => openMap('island')}>Map ↗</button></footer>
      </section>
      <div className="adventure-hints"><span><kbd>W A S D</kbd> {hud.driving || hud.boating ? 'Drive' : 'Move'}</span><span><kbd>F</kbd> {hud.driving ? 'Exit car' : hud.boating ? 'Go ashore' : 'Car / boat'}</span><span><kbd>J</kbd> Attack</span><span><kbd>E</kbd> Interact · metro</span><span><kbd>M</kbd> Map</span><small>Drag to look · Scroll to zoom</small></div>
      <div className="adventure-actions"><button disabled={!ready || error} onClick={() => action('vehicle')}>{hud.driving ? 'Exit car' : hud.boating ? 'Go ashore' : 'Car / boat'} <kbd>F</kbd></button><button disabled={!ready || error || hud.driving || hud.boating || hud.riding} {...touchControl('attack')}>Attack <kbd>J</kbd></button><button disabled={!ready || error} onClick={() => action('interact')}>Interact <kbd>E</kbd></button><button onClick={() => action('weapon')}>Switch weapon <kbd>Q</kbd></button><button onClick={() => action('reload')}>Reload <kbd>R</kbd></button></div>
    </div>
    <div className="adventure-touch" aria-label="Touch movement controls">{[['forward', '↑'], ['left', '←'], ['backward', '↓'], ['right', '→'], ['run', 'Run'], ['brake', hud.driving ? 'Brake' : 'Jump']].map(([key, title]) => <button key={key} className={'control-' + key} aria-label={key} {...touchControl(key)}>{title}</button>)}</div>
    {panel === 'shop' && <ExperienceDialog title={`${GUN_SHOP.name}.`} className="adventure-dialog shop-dialog" onClose={() => open(null)}><ShopPanel hud={hud} onBuy={buy} onEquip={equipWeapon} /></ExperienceDialog>}
    {panel === 'boss' && <ExperienceDialog title={`${BOSS_NAME}: the world boss.`} className="adventure-dialog boss-dialog" onClose={() => open(null)}><BossPanel boss={boss} city={city} now={now} onClaim={claimRewards} /></ExperienceDialog>}
    {panel === 'world' && <ExperienceDialog title={mapTab === 'island' ? `${city.name}.` : 'The world.'} className="adventure-dialog world-dialog" onClose={() => open(null)}>
      <div className="map-tabs" role="tablist" aria-label="Map views">
        <button role="tab" aria-selected={mapTab !== 'island'} onClick={() => setMapTab('world')}>World map</button>
        <button role="tab" aria-selected={mapTab === 'island'} onClick={() => setMapTab('island')}>{city.name} map</button>
      </div>
      {mapTab === 'island' ? <div className="island-map" role="tabpanel">
        <svg viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`} role="img" aria-label={`Map of ${city.name}. You are in ${region}.`}>
          <IslandLayers island={island} hud={hud} online={online} p={p} point={point} k={mapK} labels district={city.district} />
          <PlayerArrow p={p} k={mapK} />
        </svg>
        <aside>
          <p className="island-where"><small>YOU ARE IN</small><strong>{region}</strong><span>{island.summary}</span></p>
          <div className="gps"><small>GPS · SET A DESTINATION</small><div>{places.map(place => <button key={place.label} onClick={() => guide(place)} disabled={!ready || error}>{place.label}</button>)}{hud.waypoint && <button className="clear" onClick={() => guide(null)}>Clear</button>}</div></div>
          <div className="island-sky"><SkyIcon sky={sky} /><div><strong>{clock} <small>Philippine time</small></strong><span>{weather}. The whole world shares this sky: when it rains here, it rains on every island.</span></div></div>
          <ul className="map-legend">
            <li><i style={{ background: '#fff' }} />You</li><li><i style={{ background: '#87c7a1' }} />City Hub (spawn)</li><li><i style={{ background: '#64ddd1' }} />Your car</li><li><i style={{ background: '#9fd6ff' }} />Your boat</li>
            <li><i style={{ background: '#2f6fb0' }} />Metro station</li><li><i style={{ background: '#f8d47a' }} />Objective / GPS</li><li><i style={{ background: '#b88a5c', borderRadius: 2 }} />Houses</li><li><i style={{ background: '#ffa860' }} />Lighthouse</li>
          </ul>
        </aside>
      </div> : <div role="tabpanel" className="travel">
        <WorldAtlas city={city} event={bossEvent} online={online} selected={picked} onSelect={id => { setPicked(id); document.getElementById(`trip-${id}`)?.scrollIntoView({ block: 'nearest' }); }} />
        <p>You are in <b>{city.name}</b>, {city.country}. Sail your own speedboat across the sea (set a course, then take the boat from the marina), or catch a flight from the airport terminal.</p>
        {!canTravel && ready && !error && <p className="travel-notice">Finish or abandon your contract and lose the police before you travel.</p>}
        {course && <p className="travel-course">Course set for <b>{course.name}</b> · {(course.remaining / 1000).toFixed(1)} km by sea <button onClick={stopSailing}>Cancel</button></p>}
        <div className="destination-grid">{CITIES.map(c => {
          const here = city.id === c.id, trip = voyage(city, c), theme = THEMES[c.id];
          const bossHere = bossEvent && (bossEvent.phase === 'active' || bossEvent.phase === 'countdown') && bossEvent.city === c.id;
          return <article key={c.id} id={`trip-${c.id}`} className={(here ? 'selected' : '') + (picked === c.id ? ' picked' : '')} style={{ '--destination-color': c.color }} aria-label={`${c.country} ${c.name}`}>
            <small>{c.country}</small><strong>{c.name}<span>{here ? '● You are here' : ''}</span></strong>{bossHere && <span className="boss-tag">{BOSS_NAME} {bossEvent.phase === 'active' ? 'attacking now' : 'at 12:00'}</span>}
            <em>{c.district}</em><p>{theme.summary}</p>
            <span className="progress">{hud.completed.filter(key => key.startsWith(c.id + ':')).length}/{CONTRACTS.length} contracts{online.counts[c.id] ? ` · ${online.counts[c.id]} online` : ''}</span>
            {!here && <div className="trip">
              <button disabled={!canTravel || course?.to === c.id} onClick={() => sail(c.id)}>{course?.to === c.id ? 'Course set' : `Sail · ${(trip.total / 1000).toFixed(1)} km`}</button>
              <button disabled={!canTravel || !canFly} title={canFly ? '' : 'Flights leave from the airport terminal (west side of the city)'} onClick={() => travel(c.id, 'flight')}>Fly</button>
            </div>}
          </article>;
        })}</div>
        <small className="travel-note">{canFly ? 'You are at the airport: flights leave now.' : 'Flights leave from the airport terminal on the west side of the city. Use GPS on the Island map to get there.'}</small>
      </div>}
    </ExperienceDialog>}
    {panel === 'contracts' && <ExperienceDialog title="Good work. Better pay." className="adventure-dialog" onClose={() => open(null)}><p>Available in {city.name}. Follow the gold marker: stop and press E at pick-ups and drop-offs; races and tours count as soon as you pass each checkpoint. Combat locks onto the nearest visible enemy in range.</p><div className="world-contracts">{CONTRACTS.map(m => { const done = hud.completed.includes(`${city.id}:${m.id}`); return <article key={m.id}><div><small>{m.type}</small><b>${m.reward.toLocaleString()}</b></div><h3>{m.title}</h3><p>{m.description}</p><button disabled={done || !!hud.mission || !ready || error || hud.down > 0} onClick={() => acceptContract(m.id)}>{done ? '✓ Completed' : hud.mission?.id === m.id ? 'In progress' : 'Accept contract ↗'}</button></article>; })}</div>{hud.mission && <button className="adventure-secondary" onClick={abandonContract}>Abandon current contract</button>}<p className="adventure-save">{storage ? 'Cash and completed contracts save automatically on this browser. Unfinished contracts restart after reloading.' : 'Browser storage is unavailable. Progress lasts for this session.'} {hud.completed.length}/{CITIES.length * CONTRACTS.length} completed.</p></ExperienceDialog>}
    {panel === 'help' && <ExperienceDialog title="Make yourself at home." className="adventure-dialog" onClose={() => open(null)}><p>The game is paused. Explore the island on foot or take your cyan coupe. Pick up contracts, ride the metro, and sail or fly to another island.</p><div className="adventure-help">{[['WASD / arrows', 'Move or drive'], ['Shift / Space', 'Sprint / jump; Space is the handbrake while driving'], ['F', 'Enter or exit your car (stop first)'], ['J / Attack', 'Shoot or punch; the ring shows who you will hit. Hold to keep firing'], ['Q / R', 'Switch fists / pistol; reload (automatic when empty)'], ['E', 'Collect, deliver, or heal at the City Hub forecourt'], ['M / L', 'Map, GPS and travel / contracts'], ['Drag / scroll', 'Look around / zoom']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div><p>Your speedboat is moored at the marina pier on the east waterfront: set a course on the map, sail out to open sea and follow the arrow to reach another island. Flights leave from the airport. The metro loops over the city with four stations; press E on the pavement below one to wait for the train, and again to get off. Day and night follow the time in the Philippines, and the weather is shared by the whole world: when it rains in one city, it rains in all of them, for every player. Shots and attacks attract police. Patrol cars respond by road and chase you while they can see you; out of sight, they search your last known location. At one star, officers try to arrest you on foot: stand still and you are busted and fined. Hurting bystanders or officers raises your stars, and at two or more officers open fire. Stop attacking for 12 seconds and stay out of police sight for 8 seconds to begin losing heat. Aim with the camera: the pistol locks onto threats first and only onto bystanders in front of you. Punches chain into a three-hit combo whose last hook knocks people down. Children are never targets. At zero health you respawn and can restart your contract. Return to the City Hub forecourt (where you arrived) and press E on foot to heal. Other players in your city appear with their own look and name tag (and in their car while driving) and on the minimap. Traffic, pedestrians, police and contracts are your own; you cannot collide with or fight other players.</p><div className="adventure-menu-actions"><button onClick={() => open(null)}>Resume game ↗</button><button aria-pressed={blood} onClick={toggleBlood}>Blood effects: {blood ? 'On' : 'Off'}</button><button onClick={recoverToSafehouse}>Return to City Hub</button><button onClick={() => { open(null); onEditCharacter?.(); }}>Edit character</button></div></ExperienceDialog>}
  </div>;
}
