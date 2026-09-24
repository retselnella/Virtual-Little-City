import { useEffect } from 'react';
import { CITIES } from '../../models/worldTour/worldAdventure.js';
import { BOSS_NAME, REWARDS } from '../../models/worldTour/bossRules.js';

// The game's world map (the same continents and city names as always), showing the whole world at once: where you are,
// every city, and where the world boss is.
const CONTINENTS = ['M75 75L150 35 275 65 300 105 255 145 245 195 215 220 185 170 135 140Z', 'M270 210L350 225 385 270 350 325 305 400 295 310 265 260Z', 'M435 83L485 58 535 73 555 130 495 149 445 127Z',
  'M450 152L532 143 587 210 551 280 510 367 477 302 451 230 425 189Z', 'M543 64L677 40 800 60 930 110 862 171 821 222 765 210 723 155 674 192 629 145 565 140Z', 'M786 307L866 285 927 335 887 371 804 365Z', 'M329 40L379 32 395 75 356 100Z'];
const spot = c => ({ x: c.map[0] * 10, y: c.map[1] * 4.4 });
export const cityName = id => CITIES.find(c => c.id === id)?.name || id;
export function clockText(ms) { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(sec).padStart(2, '0')}`; }
const fighting = ev => ev && (ev.phase === 'active' || ev.phase === 'countdown');

export function WorldAtlas({ city, event, online, selected, onSelect }) {
  const here = CITIES.find(c => c.id === city.id), bossCity = fighting(event) ? CITIES.find(c => c.id === event.city) : null;
  return <div className="atlas world-atlas">
    <svg viewBox="0 0 1000 440" role="img" aria-label={`World map. You are in ${here.name}.${bossCity ? ` ${BOSS_NAME} ${event.phase === 'active' ? 'is attacking' : 'will appear in'} ${bossCity.name}.` : ''}`}>
      <defs><pattern id="atlas-grid" width="50" height="44" patternUnits="userSpaceOnUse"><path d="M50 0H0V44" fill="none" stroke="#ffffff0b" /></pattern></defs>
      <rect width="1000" height="440" fill="url(#atlas-grid)" />
      <g fill="#354b52" stroke="#6c8184" strokeWidth="1">{CONTINENTS.map(d => <path key={d} d={d} />)}</g>
      {bossCity && bossCity !== here && <path className="atlas-route" d={`M${spot(here).x} ${spot(here).y}L${spot(bossCity).x} ${spot(bossCity).y}`} />}
      {CITIES.map(c => {
        const p = spot(c), mine = c.id === city.id, boss = bossCity?.id === c.id;
        return <g key={c.id} transform={`translate(${p.x} ${p.y})`} className={'atlas-city' + (mine ? ' here' : '') + (selected === c.id ? ' selected' : '')} onClick={() => onSelect?.(c.id)} role="button" tabIndex="0" aria-label={`${c.name}${mine ? ', you are here' : ''}${boss ? `, ${BOSS_NAME}` : ''}`} onKeyDown={e => { if (e.key === 'Enter') onSelect?.(c.id); }}>
          {mine && <circle className="atlas-pulse" r="14" fill="none" stroke="#fff" strokeWidth="2" />}
          <circle r={mine ? 11 : 7} fill={c.color} opacity=".3" /><circle r={mine ? 5 : 4} fill={mine ? '#fff' : c.color} />
          <text x="10" y="-10" fill="#f3ece1" fontSize="13" fontWeight={mine ? 700 : 400}>{c.name}</text>
          {mine && <text x="10" y="8" className="atlas-here" fontSize="10">YOU ARE HERE{online.counts[c.id] ? ` · ${online.counts[c.id]} online` : ''}</text>}
          {!mine && online.counts[c.id] ? <text x="10" y="8" fill="#9fb6ba" fontSize="10">{online.counts[c.id]} online</text> : null}
          {boss && <g transform="translate(0 26)" className="atlas-boss"><circle r="11" fill="#ff5a4e" /><path d="M-6 3l3-9 3 5 3-5 3 9z" fill="#2a1512" /><text x="15" y="4" fill="#ffb3a8" fontSize="11" fontWeight="700">{BOSS_NAME} · {event.phase === 'active' ? `${(event.hp / event.maxHp * 100).toFixed(1)}% HP` : '12:00 PH time'}</text></g>}
        </g>;
      })}
    </svg>
  </div>;
}

// The event banner under the clock: the countdown, then the fight (HP, time left, your damage and rank).
export function BossBanner({ boss, city, now, onOpen, onMap }) {
  const ev = boss.event;
  if (!ev || !(ev.phase === 'countdown' || ev.phase === 'active' || ((ev.phase === 'defeated' || ev.phase === 'ended') && now < ev.endsAt + 600_000))) return null;
  const where = cityName(ev.city), here = ev.city === city.id, pct = ev.hp / ev.maxHp * 100;
  return <section className={`boss-banner ${ev.phase}`} aria-label={`${BOSS_NAME} event`}>
    <header><b>{BOSS_NAME}</b><span>{where}</span>
      {ev.phase === 'countdown' && <em>rises in {clockText(ev.startsAt - now)}</em>}
      {ev.phase === 'active' && <em>{clockText(ev.endsAt - now)} left</em>}
      {ev.phase === 'defeated' && <em>Defeated</em>}{ev.phase === 'ended' && <em>Retreated</em>}
    </header>
    {ev.phase !== 'countdown' && <div className="boss-hp" role="progressbar" aria-valuemin="0" aria-valuemax={ev.maxHp} aria-valuenow={ev.hp} aria-label="Boss health"><i style={{ width: `${pct}%` }} /><span>{ev.hp.toLocaleString()} / {ev.maxHp.toLocaleString()} · {pct.toFixed(2)}%</span></div>}
    <footer>
      {ev.phase === 'active' && !here ? <span>Attacking {where}: sail or fly there to fight.</span> : ev.phase === 'countdown' ? <span>{here ? 'It will rise from the sea east of this city.' : `Travel to ${where} before 12:00 to join the fight.`}</span> : <span>You: <b>{ev.me.damage.toLocaleString()}</b>{ev.me.rank ? ` · rank #${ev.me.rank}` : ''}</span>}
      <button onClick={onOpen}>Ranking <kbd>B</kbd></button>{!here && <button onClick={onMap}>World map</button>}
    </footer>
  </section>;
}
export function BossHits({ hits }) {
  return <div className="boss-hits" aria-hidden="true">{hits.map(h => <span key={h.id}>+{h.damage.toLocaleString()}</span>)}</div>;
}

// The event and weekly leaderboards, the player's stats and rewards.
export function BossPanel({ boss, city, now, onClaim }) {
  const ev = boss.event, weekly = boss.weekly, me = boss.playerId;
  useEffect(() => { boss.loadWeekly(); const timer = setInterval(boss.loadWeekly, 15000); return () => clearInterval(timer); }, []);
  if (!ev) return <p>{boss.status === 'error' ? `The event server cannot be reached right now. ${BOSS_NAME}'s schedule and rankings will appear here once it can.` : 'Connecting to the event server…'}</p>;
  const status = { scheduled: `Next appearance: ${cityName(ev.city)}, 12:00 PH time (in ${clockText(ev.startsAt - now)}).`, countdown: `Rises off ${cityName(ev.city)} in ${clockText(ev.startsAt - now)}.`,
    active: `Attacking ${cityName(ev.city)} · ${clockText(ev.endsAt - now)} left.`, defeated: `Defeated in ${cityName(ev.city)}.`, ended: `Retreated from ${cityName(ev.city)} when time ran out.` }[ev.phase];
  return <div className="boss-panel">
    <p className="boss-status"><b>{status}</b> HP {ev.hp.toLocaleString()} / {ev.maxHp.toLocaleString()} ({(ev.hp / ev.maxHp * 100).toFixed(2)}%). Every day at 12:00 Philippine time {BOSS_NAME} rises off a different city for one hour. The server counts every hit.{city.id === ev.city ? ' It is on your island.' : ''}</p>
    <div className="boss-me"><div><small>YOUR DAMAGE</small><b>{ev.me.damage.toLocaleString()}</b></div><div><small>RANK</small><b>{ev.me.rank ? `#${ev.me.rank}` : '—'}</b></div><div><small>HITS</small><b>{ev.me.hits || 0}</b></div><div><small>DEATHS</small><b>{ev.me.deaths || 0}</b></div></div>
    <h3>Live ranking</h3>
    <table className="boss-table"><thead><tr><th>Rank</th><th>Player</th><th>Damage</th><th>Share</th></tr></thead>
      <tbody>{ev.top.length ? ev.top.map(r => <tr key={r.id} className={r.id === me ? 'mine' : ''}><td>{r.rank}</td><td>{r.name}</td><td>{r.damage.toLocaleString()}</td><td>{(r.share * 100).toFixed(1)}%</td></tr>) : <tr><td colSpan="4">No damage dealt yet.</td></tr>}</tbody></table>
    <h3>This week</h3>
    {weekly ? <>
      <p className="boss-week">Resets {new Date(weekly.endsAt).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })} (Monday 00:00 PH time). {weekly.myRank ? `You are #${weekly.myRank}.` : 'Deal damage to get ranked.'}</p>
      <div className="boss-weekly"><table className="boss-table"><thead><tr><th>Rank</th><th>Player</th><th>Damage</th></tr></thead>
        <tbody>{weekly.rows.length ? weekly.rows.map(r => <tr key={r.id} className={r.id === me ? 'mine' : ''}><td>{r.rank}</td><td>{r.name}</td><td>{r.damage.toLocaleString()}</td></tr>) : <tr><td colSpan="3">No damage this week yet.</td></tr>}</tbody></table></div>
      <ul className="boss-rewards">{REWARDS.map(t => <li key={t.tier}><b>{t.from === t.to ? `#${t.from}` : `#${t.from}–${t.to}`}</b> {t.tier}: ${t.cash.toLocaleString()} and the “{t.title}” title</li>)}</ul>
      {weekly.unclaimed.length > 0 && <button className="boss-claim" onClick={onClaim}>Claim {weekly.unclaimed.length} weekly reward{weekly.unclaimed.length > 1 ? 's' : ''} (${weekly.unclaimed.reduce((sum, r) => sum + r.cash, 0).toLocaleString()})</button>}
    </> : <p>Loading the weekly board…</p>}
  </div>;
}
