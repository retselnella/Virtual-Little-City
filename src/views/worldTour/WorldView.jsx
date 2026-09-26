import { useState } from 'react';
import { CITIES, CONTRACTS, reachableNear } from '../../models/worldTour/worldAdventure.js';
import { formatClock } from '../../models/worldTour/worldClock.js';
import { ExperienceDialog } from '../shared/ExperienceDialog.jsx';
import { IslandLayers, PlayerArrow, SeaChart, mapView } from './islandMap.jsx';
import { THEMES, MARINA } from '../../models/worldTour/worldIsland.js';
import { STATIONS, nearestStation } from '../../models/worldTour/metro.js';
import { voyage } from '../../models/worldTour/worldBoat.js';
import { BOSS_NAME } from '../../models/worldTour/bossRules.js';
import { BossBanner, BossHits, BossPanel, WorldAtlas } from './bossViews.jsx';
import { ShopPanel, WeaponBar } from './weaponViews.jsx';
import { MusicPanel } from './musicViews.jsx';
import { TouchActions, TouchStick } from './touchControls.jsx';
import { GUN_SHOP, WEAPONS } from '../../models/worldTour/weapons.js';
import { MAX_STARS, escapeTime, starsOf } from '../../models/worldTour/wanted.js';
// A reason that will not go away by retrying: the site's Supabase setup needs a step (README, "Turn on online play").
function setupProblem(reason = '') {
  if (/anonymous sign-ins are disabled/i.test(reason)) return 'Offline: turn on anonymous sign-ins in Supabase';
  if (/unauthori[sz]ed|permission|not allowed|forbidden|row-level|policy/i.test(reason)) return 'Offline: run supabase/realtime-policies.sql';
  if (/invalid api key|jwt|apikey/i.test(reason)) return 'Offline: check the Supabase URL and anon key';
  return '';
}
// Connection chip: who else is here, and whether this is the shared online world or the same-browser fallback.
function onlineLabel({ status, peers }) {
  const others = peers.length, players = `${others} other player${others === 1 ? '' : 's'} here`;
  if (status.mode === 'local') return ['local', `Local · ${others} other tab${others === 1 ? '' : 's'}`];
  if (status.state === 'reconnecting' || status.state === 'error') return ['connecting', globalThis.navigator?.onLine === false ? 'No internet · reconnecting…' : setupProblem(status.reason) || 'Reconnecting to the shared world…'];
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

// The pause menu: controls, and the few things worth knowing.
const CONTROLS = [['W A S D', 'Move, drive or steer the boat'], ['Shift / Space', 'Sprint / jump (Space: handbrake)'], ['F', 'Get in or out of your car or boat'], ['Mouse · J', 'Point to aim; click, hold right button or J to fire'],
  ['Q · 1–9 · R', 'Switch weapon · pick one · reload'], ['E', 'Pick up, deliver, metro, gun shop, heal'], ['M · L · B · N', 'Map · contracts · Kaiju · music'], ['Drag · scroll', 'Look around · zoom']];
const TIPS = [
  ['Other islands.', 'Open the map (M), pick an island and press Sail. Your speedboat waits at the marina on the east waterfront; follow the gold marker to it.'],
  ['Police.', 'Attacks bring wanted stars. At one star officers try to arrest you; at two they shoot. Stop attacking and stay out of sight to lose them.'],
  ['Health.', 'Press E on the City Hub forecourt to heal and restock every gun (not while wanted).'],
  ['Guns.', 'Buy more at Ocean Drive Arms in Miami. Aim with the camera: threats are targeted first, children never.'],
  ['Metro.', 'Press E under a station to wait for the train, and again to get off.'],
  ['One world.', 'Day and night follow Philippine time and every city shares the weather. Other players in your city are with you, but cannot be hurt.'],
];
// A compass bearing in words, for sailing directions.
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compass = bearing => POINTS[Math.round(((Math.PI - bearing) / (Math.PI * 2)) * 8 + 8) % 8];

export default function WorldView({ controller, onEditCharacter }) {
  const { music, boss, claimRewards, online, playerName, sky, weather, region, island, prompt, bigMap, setBigMap, teleport, teleported, sail, stopSailing, guide, hud, panel, ready, error, storage, host, city, current, p, point, open, action, toggleBlood, touchControl, setStick, touch, travel, buy, equipWeapon, dispatchTitle, dispatchHint, task, blood, acceptContract, abandonContract, recoverToSafehouse } = controller;
  const [picked, setPicked] = useState(null);
  // Touch screens: the cards fold away so the game stays visible (tap to open them).
  const [infoOpen, setInfoOpen] = useState(false), [policeOpen, setPoliceOpen] = useState(false), [mapHidden, setMapHidden] = useState(false);
  const now = boss.clock.current(), bossEvent = boss.event;
  const clock = formatClock(sky.clock), [onlineState, onlineText] = onlineLabel(online);
  const course = hud.course, sailing = hud.boating && course;
  // The minimap follows you, zooming out with speed (and further at sea).
  const speed = Math.abs((hud.driving ? hud.car : hud.boating ? hud.boat : hud.player).speed || 0);
  const radius = sailing && course.openSea ? 900 : hud.boating ? 420 + Math.min(300, speed * 10) : hud.driving ? 300 + Math.min(260, speed * 8) : 260, k = radius / 460;
  const destination = course && CITIES.find(c => c.id === course.to);
  // The expanded minimap shows the whole island (and you, even out at sea), with place names.
  const coast = mapView(island), whole = { x: Math.min(coast.x, p.x - 150), z: Math.min(coast.z, p.z - 150) };
  whole.width = Math.max(coast.x + coast.width, p.x + 150) - whole.x; whole.height = Math.max(coast.z + coast.height, p.z + 150) - whole.z;
  const bigK = whole.width / 700;
  // The edge arrow points to an off-map objective, or along the sailing bearing when you are at sea.
  const target = sailing ? { x: p.x + Math.sin(course.bearing) * 5000, z: p.z + Math.cos(course.bearing) * 5000 } : point;
  const away = point ? Math.hypot(point.x - p.x, point.z - p.z) : 0, edge = target && Math.hypot(target.x - p.x, target.z - p.z) > radius * 0.86 ? Math.atan2(target.z - p.z, target.x - p.x) : null;
  const openMap = () => open('world');
  const canTravel = !hud.mission && !(hud.heat > 0) && !(hud.down > 0) && ready && !error;
  const places = [
    { label: 'City Hub', x: 8, z: 12 }, { label: 'Teleporter', ...hud.teleporter }, ...(city.id === GUN_SHOP.city ? [{ label: 'Gun shop', ...GUN_SHOP.door }] : []), { label: 'Marina pier', x: MARINA.x0 + 40, z: MARINA.z },
    { label: `${STATIONS[nearestStation(p.x, p.z)].name} metro station`, ...STATIONS[nearestStation(p.x, p.z)].exit },
    { label: 'Lighthouse', x: island.landmarks.lighthouse.x + 22, z: island.landmarks.lighthouse.z },
    ...(island.landmarks.feature ? [{ label: island.landmarks.feature.name, ...reachableNear(island, { x: island.landmarks.feature.x, z: island.landmarks.feature.z + island.landmarks.feature.radius + 8 }) }] : []),
    ...island.suburbs.slice(0, 1).map(sb => ({ label: sb.name, x: sb.x, z: sb.z })),
    ...island.lakes.slice(0, 1).map(l => ({ label: l.name, x: l.x, z: l.z + l.rz + 20 })),
  ];
  // Where your boat is: every city's marina pier is on its east waterfront.
  const marinaAt = { x: MARINA.x0 + 40, z: MARINA.z }, marina = { distance: Math.round(Math.hypot(marinaAt.x - p.x, marinaAt.z - p.z) / 10) * 10, direction: compass(Math.atan2(marinaAt.x - p.x, marinaAt.z - p.z)) };
  const vehicle = hud.driving ? ['SPORT COUPE', `${Math.round(speed * 3.6)} km/h`] : hud.boating ? ['SPEEDBOAT', `${Math.round(speed * 3.6)} km/h`] : hud.riding ? ['METRO', STATIONS[hud.train.station ?? hud.train.next].name.toUpperCase()] : [WEAPONS[hud.weapon]?.gun ? WEAPONS[hud.weapon].name.toUpperCase() : 'UNARMED', hud.reload > 0 ? 'RELOADING' : WEAPONS[hud.weapon]?.gun ? `${hud.mags[hud.weapon]} / ∞` : 'FISTS'];
  // The left card: the contract, else the voyage, else the metro ride, else a nudge to explore.
  const card = current ? null : course ? {
    kicker: `SEA VOYAGE / ${course.name.toUpperCase()}`,
    title: !hud.boating ? 'Take your boat from the marina' : !course.openSea ? 'Head out to open sea' : course.onCourse ? `On course for ${course.name}` : `Turn ${compass(course.bearing)}`,
    text: !hud.boating ? `Your speedboat is moored at the marina pier on the east waterfront, ${marina.distance} m ${marina.direction}. Follow the gold marker, then press F beside the boat.` : `${(course.remaining / 1000).toFixed(1)} km of open sea to ${course.name}. Keep the arrow ahead; hold Shift for full power.`,
    arrow: hud.boating ? course.bearing - hud.boat.heading : null,
  } : hud.riding ? { kicker: 'CITY METRO', title: hud.train.station !== null ? `Stopped at ${STATIONS[hud.train.station].name}` : `Next stop: ${STATIONS[hud.train.next].name}`, text: 'Press E while the train is stopped to get off.' } : null;
  const location = <section className="adventure-location">
      <span className="adventure-kicker">{city.country} / {city.region}</span>
      <h1>{city.name}<span>.</span></h1>
      <div><i />{region}<span>FREE ROAM</span></div>
      <p className={'adventure-online ' + onlineState} role="status" aria-live="polite" title={online.status.reason || undefined}>{onlineText}</p>
    </section>;
  const objective = <section className="adventure-objective">
      {card ? <>
        <div className="adventure-kicker">{card.kicker}</div>
        <h2>{card.arrow !== null && card.arrow !== undefined && <span className="bearing" style={{ transform: `rotate(${-card.arrow}rad)` }} aria-hidden="true">↑</span>}{card.title}</h2>
        <p>{card.text}</p>
        {course ? <button onClick={stopSailing}>Cancel course <span>×</span></button> : <button onClick={() => openMap()}>Open the map <span>↗</span></button>}
      </> : <>
        <div className="adventure-kicker">{current ? current.type + ' / ACTIVE CONTRACT' : 'YOUR NEXT MOVE'}</div>
        <h2>{current || !hud.waypoint ? task : `Head to ${hud.waypoint.label}`}</h2>
        <p>{current ? `${current.title} · $${current.reward.toLocaleString()}` : island.summary + '.'}</p>
        {point && <span className="objective-distance">◇ {Math.round(away)} m <small>{current ? 'Follow the gold marker · E to interact' : 'Follow the gold marker'}</small></span>}
        <button onClick={() => open('contracts')}>{current ? 'Contract details' : 'Find a contract'} <span>↗</span></button>
      </>}
    </section>;
  return <div className={`adventure sky-${sky.kind} phase-${sky.phase}${touch ? ' touch' : ''}`} style={{ '--city-accent': city.color, '--night': sky.night.toFixed(2), '--wet': sky.rain.toFixed(2) }}>
    <div className="adventure-canvas" ref={host} />
    <header className="adventure-header">
      <a href="#world" onClick={e => { e.preventDefault(); openMap(); }} className="adventure-brand">lc<span>WORLD TOUR</span><i>✦</i></a>
      <div className="adventure-sky" title="Time follows the Philippines (PHT). Weather is shared by every city and every player.">
        <SkyIcon sky={sky} /><b>{clock}</b><small>PH TIME</small><span>{weather}</span>
      </div>
      <nav aria-label="World navigation">
        <button onClick={() => openMap()}>◎ <span>Map</span><kbd>M</kbd></button>
        <button onClick={() => open('contracts')}>◇ <span>Contracts</span><kbd>L</kbd></button>
        <button onClick={() => open('boss')} className={bossEvent?.phase === 'active' ? 'boss-live' : ''}>✸ <span>{BOSS_NAME}</span><kbd>B</kbd></button>
        <button onClick={() => open('music')} className={music.playing ? 'music-live' : ''} title={music.track ? `${music.track.title}${music.track.artist ? ` · ${music.track.artist}` : ''}` : 'Music'}>♫ <span>Music</span><kbd>N</kbd></button>
        <button onClick={() => open('help')} aria-label="Controls and pause menu">Ⅱ</button>
      </nav>
    </header>
    <section className="adventure-stats" aria-label="Player status">
      <span className="adventure-player">{playerName.toUpperCase()}</span>
      <div className={`wanted${hud.heat > 0 && hud.lostFor > escapeTime(hud.heat) ? ' fading' : ''}`} aria-label={`Wanted level ${starsOf(hud.heat)} of ${MAX_STARS}`}>{Array.from({ length: MAX_STARS }, (_, i) => <span key={i} className={starsOf(hud.heat) > i ? 'lit' : ''}>★</span>)}</div>
      <strong>${hud.cash.toLocaleString()}</strong>
      <label className={hud.health < 35 ? 'low' : ''}><span>HEALTH</span><b>{Math.ceil(hud.health)}</b><progress max="100" value={hud.health} /></label>
      <div className="weapon-status"><span>{vehicle[0]}</span><b>{vehicle[1]}</b></div>
    </section>
    {touch ? <div className={'touch-info' + (infoOpen ? ' open' : '')}>
      <button className="touch-info-toggle" aria-expanded={infoOpen} onClick={() => setInfoOpen(!infoOpen)}><i className={'dot ' + onlineState} aria-hidden="true" /><b>{city.name}</b><span>{current || !hud.waypoint ? task : `Head to ${hud.waypoint.label}`}</span><em aria-hidden="true">{infoOpen ? '▴' : '▾'}</em></button>
      {infoOpen && <>{location}{objective}</>}
    </div> : <>{location}{objective}</>}
    {hud.heat > 0 && (touch && !policeOpen
      ? <button className="adventure-dispatch folded" aria-expanded="false" aria-label={`Police response: ${dispatchTitle}`} onClick={() => setPoliceOpen(true)}><span>POLICE</span><strong>{dispatchTitle}</strong></button>
      : <div className="adventure-dispatch" aria-label="Police response" onClick={() => touch && setPoliceOpen(false)}><span>POLICE RESPONSE</span><strong>{dispatchTitle}</strong><small>{dispatchHint}</small></div>)}
    <BossBanner boss={boss} city={city} now={now} onOpen={() => open('boss')} onMap={() => openMap()} />
    <BossHits hits={boss.hits} />
    {hud.messageTime > 0 && <div className="adventure-toast" role="status">{hud.message}</div>}
    {teleported > 0 && <div key={teleported} className="teleport-flash" aria-hidden="true" />}
    {prompt && ready && !error && <button className={'adventure-prompt' + (prompt.key ? '' : ' passive')} disabled={!prompt.action} onClick={() => prompt.action && action(prompt.action)}>{prompt.key && <kbd>{prompt.key}</kbd>}<span>{prompt.text}</span></button>}
    {hud.down > 0 && <div className={'adventure-wasted' + (hud.downReason === 'busted' ? ' busted' : '')}><h2>{hud.downReason === 'busted' ? 'BUSTED' : 'WASTED'}</h2><p>{hud.downReason === 'busted' ? 'Released at the City Hub…' : 'Returning to the City Hub…'}</p></div>}
    {!ready && !error && <div className="adventure-loading"><span className="loading-ring" />Building {city.name}…</div>}
    {error && <div className="adventure-loading"><strong>The city needs WebGL.</strong><p>Enable hardware acceleration and reload to play.</p><button onClick={() => location.reload()}>Reload</button></div>}
    {!hud.driving && !hud.boating && !hud.riding && <WeaponBar hud={hud} onEquip={equipWeapon} />}
    <div className="adventure-bottom">
      {touch && mapHidden && !bigMap ? <button className="touch-map-show" aria-label="Show the minimap" onClick={() => setMapHidden(false)}>◎</button> : <section className={'adventure-radar' + (bigMap ? ' expanded' : '')} aria-label="Island minimap">
        {touch && !bigMap && <button className="touch-map-hide" aria-label="Hide the minimap" onClick={() => setMapHidden(true)}>×</button>}
        {bigMap ? <div className="radar-dial whole" role="button" tabIndex="0" aria-label="Shrink the island map" onClick={() => setBigMap(false)} onKeyDown={e => { if (e.key === 'Enter') setBigMap(false); }}>
          <svg viewBox={`${whole.x} ${whole.z} ${whole.width} ${whole.height}`} role="img" aria-label={`Map of ${city.name} island. You are in ${region}.`}>
            <IslandLayers island={island} hud={hud} online={online} p={p} point={point} k={bigK} labels district={city.district} />
            {sailing && <SeaChart p={p} course={course} radius={Math.max(whole.width, whole.height) / 2} k={bigK} color={destination.color} name={destination.name} />}
            <PlayerArrow p={p} k={bigK * 1.6} />
            <text x={p.x} y={p.z - 60 * bigK} fontSize={34 * bigK} textAnchor="middle" fill="#fff" stroke="#10303c" strokeWidth={7 * bigK} paintOrder="stroke" fontWeight="700">YOU</text>
          </svg>
          <span className="radar-north" aria-hidden="true">N</span>
        </div> : <div className="radar-dial" role="button" tabIndex="0" aria-label="Expand the minimap to the whole island" title="Click to see the whole island" onClick={() => setBigMap(true)} onKeyDown={e => { if (e.key === 'Enter') setBigMap(true); }}>
          <svg viewBox={`${p.x - radius} ${p.z - radius} ${radius * 2} ${radius * 2}`} role="img" aria-label="Minimap: the island around you, your car and your destination">
            <IslandLayers island={island} hud={hud} online={online} p={p} point={point} k={k} />
            {sailing && <SeaChart p={p} course={course} radius={radius} k={k} color={destination.color} name={destination.name} />}
            {edge !== null && <g className="objective-edge" transform={`translate(${p.x + Math.cos(edge) * radius * 0.84} ${p.z + Math.sin(edge) * radius * 0.84}) rotate(${edge * 180 / Math.PI + 90}) scale(${k})`}><polygon points="0,-26 20,14 -20,14" fill={sailing ? '#9fd6ff' : '#f8d47a'} stroke="#152b32" strokeWidth="5" /></g>}
            {sailing && edge !== null && <text className="radar-course" x={p.x + Math.cos(edge) * radius * 0.62} y={p.z + Math.sin(edge) * radius * 0.62} fontSize={40 * k} textAnchor="middle" fill="#cfe9ff" stroke="#10303c" strokeWidth={8 * k} paintOrder="stroke" fontWeight="700">{destination.name} {(course.remaining / 1000).toFixed(1)} km</text>}
            <PlayerArrow p={p} k={k * 1.5} />
          </svg>
          <span className="radar-north" aria-hidden="true">N</span>
          <span className="radar-expand" aria-hidden="true">⤢</span>
        </div>}
        <footer><span><i /> {hud.driving ? 'IN VEHICLE' : hud.boating ? 'AT SEA' : hud.riding ? 'ON THE METRO' : 'ON FOOT'} · {region}</span><button onClick={() => setBigMap(!bigMap)} aria-pressed={bigMap}>{bigMap ? 'Shrink' : 'Island'} <kbd>V</kbd></button><button onClick={() => openMap()}>World ↗</button></footer>
      </section>}
      <div className="adventure-hints"><span><kbd>W A S D</kbd> {hud.driving || hud.boating ? 'Drive' : 'Move'}</span><span><kbd>F</kbd> {hud.driving ? 'Exit car' : hud.boating ? 'Go ashore' : 'Car / boat'}</span><span><kbd>J</kbd> Attack</span><span><kbd>E</kbd> Interact · metro</span><span><kbd>M</kbd> Map</span><small>{hud.weapon !== 'fists' && !hud.driving && !hud.boating ? 'Point to aim · click or hold right button to fire · drag to look' : 'Drag to look · Scroll to zoom'}</small></div>
      <div className="adventure-actions"><button disabled={!ready || error} onClick={() => action('vehicle')}>{hud.driving ? 'Exit car' : hud.boating ? 'Go ashore' : 'Car / boat'} <kbd>F</kbd></button><button disabled={!ready || error || hud.driving || hud.boating || hud.riding} {...touchControl('attack')}>Attack <kbd>J</kbd></button><button disabled={!ready || error} onClick={() => action('interact')}>Interact <kbd>E</kbd></button><button onClick={() => action('weapon')}>Switch weapon <kbd>Q</kbd></button><button onClick={() => action('reload')}>Reload <kbd>R</kbd></button></div>
    </div>
    {touch && ready && !error && !(hud.down > 0) && <><TouchStick onMove={setStick} /><TouchActions hud={hud} disabled={!ready || !!error} touchControl={touchControl} action={action} /></>}
    {!touch && <div className="adventure-touch" aria-label="Touch movement controls">{[['forward', '↑'], ['left', '←'], ['backward', '↓'], ['right', '→'], ['run', 'Run'], ['brake', hud.driving ? 'Brake' : 'Jump']].map(([key, title]) => <button key={key} className={'control-' + key} aria-label={key} {...touchControl(key)}>{title}</button>)}</div>}
    {panel === 'shop' && <ExperienceDialog title={`${GUN_SHOP.name}.`} className="adventure-dialog shop-dialog" onClose={() => open(null)}><ShopPanel hud={hud} onBuy={buy} onEquip={equipWeapon} /></ExperienceDialog>}
    {panel === 'music' && <ExperienceDialog title="Music." className="adventure-dialog music-dialog" onClose={() => open(null)}><MusicPanel music={music} /></ExperienceDialog>}
    {panel === 'boss' && <ExperienceDialog title={`${BOSS_NAME}: the world boss.`} className="adventure-dialog boss-dialog" onClose={() => open(null)}><BossPanel boss={boss} city={city} now={now} onClaim={claimRewards} /></ExperienceDialog>}
    {panel === 'world' && <ExperienceDialog title="The world." className="adventure-dialog world-dialog" onClose={() => open(null)}>
      <p className="world-here"><i aria-hidden="true" /><span>You are on <b>{city.name}</b> island · {city.country} · {region}</span></p>
      <WorldAtlas city={city} event={bossEvent} online={online} selected={picked} course={course} onSelect={setPicked} />
      {course ? <p className="travel-course" role="status">Sailing to <b>{course.name}</b>: {hud.boating ? `${(course.remaining / 1000).toFixed(1)} km of open sea left. Keep the arrow ahead.` : `your boat is at the marina on the east waterfront, ${marina.distance} m ${marina.direction}. Follow the gold marker.`}<button onClick={stopSailing}>Cancel</button></p>
        : !canTravel && ready && !error ? <p className="travel-notice">Finish or abandon your contract and lose the police before you travel.</p>
        : <p className="world-tip"><b>Teleport</b> to arrive instantly at that island's City Hub, or <b>Sail</b> there in your speedboat: it waits at the marina on the <b>east</b> side ({marina.distance} m {marina.direction}).</p>}
      <div className="destination-grid">{CITIES.map(c => {
        const here = city.id === c.id, trip = voyage(city, c);
        const bossHere = bossEvent && (bossEvent.phase === 'active' || bossEvent.phase === 'countdown') && bossEvent.city === c.id;
        return <article key={c.id} className={(here ? 'selected' : '') + (picked === c.id ? ' picked' : '')} style={{ '--destination-color': c.color }} aria-label={`${c.country} ${c.name}`} title={THEMES[c.id].summary} onMouseEnter={() => setPicked(c.id)}>
          <small>{c.country}</small><strong>{c.name}</strong>
          <span className="progress">{hud.completed.filter(key => key.startsWith(c.id + ':')).length}/{CONTRACTS.length} contracts{online.counts[c.id] ? ` · ${online.counts[c.id]} online` : ''}</span>
          {bossHere && <span className="boss-tag">{BOSS_NAME} {bossEvent.phase === 'active' ? 'attacking now' : 'at 12:00'}</span>}
          {here ? <span className="here-tag">● You are here</span> : <div className="trip-buttons">
            <button className="teleport" disabled={!canTravel} onClick={() => teleport(c.id)}>Teleport</button>
            <button disabled={!canTravel || course?.to === c.id} onClick={() => sail(c.id)}>{course?.to === c.id ? 'Course set' : `Sail · ${(trip.total / 1000).toFixed(1)} km`}</button>
          </div>}
        </article>;
      })}</div>
      <div className="gps" role="group" aria-label="GPS: set a destination on this island"><small>GPS</small>{places.map(place => <button key={place.label} onClick={() => guide(place)} disabled={!ready || error}>{place.label}</button>)}{hud.waypoint && <button className="clear" onClick={() => guide(null)}>Clear</button>}</div>
    </ExperienceDialog>}
    {panel === 'contracts' && <ExperienceDialog title="Good work. Better pay." className="adventure-dialog contracts-dialog" onClose={() => open(null)}>
      <p>Available in {city.name} · {hud.completed.filter(key => key.startsWith(city.id + ':')).length}/{CONTRACTS.length} done here, {hud.completed.length}/{CITIES.length * CONTRACTS.length} in the world. Stop and press E at pick-ups and drop-offs; race checkpoints and tour sights count as you pass them.</p>
      <div className="world-contracts">{CONTRACTS.map(m => { const done = hud.completed.includes(`${city.id}:${m.id}`); return <article key={m.id} className={done ? 'done' : ''}><div><small>{m.type}</small><b>${m.reward.toLocaleString()}</b></div><h3>{m.title}</h3><p>{m.description}</p><button disabled={done || !!hud.mission || !ready || error || hud.down > 0} onClick={() => acceptContract(m.id)}>{done ? '✓ Completed' : hud.mission?.id === m.id ? 'In progress' : 'Accept ↗'}</button></article>; })}</div>
      <footer className="contracts-footer">{hud.mission && <button className="adventure-secondary" onClick={abandonContract}>Abandon current contract</button>}<small>{storage ? 'Progress saves on this browser; an unfinished contract restarts after reloading.' : 'Browser storage is unavailable: progress lasts for this session.'}</small></footer>
    </ExperienceDialog>}
    {panel === 'help' && <ExperienceDialog title="Paused." className="adventure-dialog help-dialog" onClose={() => open(null)}>
      <div className="help-layout">
        <section aria-label="Controls"><h3>Controls</h3><div className="adventure-help">{CONTROLS.map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div></section>
        <section aria-label="Good to know"><h3>Good to know</h3><ul className="help-tips">{TIPS.map(([title, text]) => <li key={title}><b>{title}</b> {text}</li>)}</ul></section>
      </div>
      <div className="adventure-menu-actions"><button onClick={() => open(null)}>Resume game ↗</button><button aria-pressed={blood} onClick={toggleBlood}>Blood effects: {blood ? 'On' : 'Off'}</button><button onClick={recoverToSafehouse}>Return to City Hub</button><button onClick={() => { open(null); onEditCharacter?.(); }}>Edit character</button></div>
    </ExperienceDialog>}
  </div>;
}
