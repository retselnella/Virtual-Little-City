import { useEffect, useRef, useState } from 'react';
import { connectBoss } from '../services/bossService.js';
import { BOSS_NAME } from '../models/worldTour/bossRules.js';
import { notify } from '../models/worldTour/worldAdventure.js';
import { CITIES } from '../models/worldTour/worldAdventure.js';

// The world boss event for this player: polls the server for the event (schedule, HP, ranking), reports the player's
// hits and deaths, keeps the session's clock in step with the server's, and announces the event to everyone.
// `clockOffset` (a ref, ms) is added to the local clock for previews (?clock=) in local mode only. `test` (?bosstest)
// asks the server for its test event, which it only gives while the owner has test mode on.
export function useWorldBoss(session, playerName, clockOffset, test = false) {
  const server = useRef(null), skew = useRef(0), lastPhase = useRef(null), reported = useRef({ deaths: 0 });
  const [status, setStatus] = useState('connecting'), [event, setEvent] = useState(null), [weekly, setWeekly] = useState(null), [hits, setHits] = useState([]);
  const clock = useRef(() => Date.now() + skew.current);
  useEffect(() => {
    let alive = true, busy = false;
    const local = () => Date.now() + (clockOffset.current || 0);
    connectBoss({ clock: local, test }).then(api => {
      if (!alive) return;
      server.current = api; setStatus(api.mode);
      if (api.mode === 'local') clock.current = local;
      refresh();
    }).catch(error => { console.warn('World boss unavailable', error); if (alive) setStatus('error'); });
    async function refresh() {
      const api = server.current; if (!api || busy) return;
      busy = true;
      try {
        const state = await api.state();
        if (!alive || !state) return;
        if (api.mode === 'online') skew.current = state.serverNow - Date.now();
        const next = normalize(state);
        session.current.bossEvent = next; setEvent(next); setStatus(api.mode); announce(next);
        await flush(next);
      } catch (error) { console.warn('World boss state', error); if (alive && !session.current.bossEvent) setStatus('error'); }
      finally { busy = false; }
    }
    // Report hits and deaths since the last report; the server answers with the damage it granted.
    async function flush(ev) {
      const s = session.current, api = server.current;
      if (ev.phase === 'active' && ev.city === s.city && (s.bossHits.shot || s.bossHits.punch)) {
        const shots = s.bossHits.shot, punches = s.bossHits.punch, at = s.player;
        s.bossHits.shot -= shots; s.bossHits.punch -= punches;
        const result = await api.hit({ event: ev.id, shots, punches, x: at.x, z: at.z, city: s.city, name: playerName.current });
        if (result?.ok && result.damage > 0) setHits(list => [...list.slice(-5), { id: Date.now() + Math.random(), damage: Number(result.damage) }]);
      } else if (ev.phase !== 'active' || ev.city !== s.city) { s.bossHits.shot = 0; s.bossHits.punch = 0; }
      if (s.bossDeaths > reported.current.deaths) { reported.current.deaths = s.bossDeaths; await api.death(ev.id); }
    }
    function announce(ev) {
      const before = lastPhase.current; lastPhase.current = `${ev.id}:${ev.phase}`;
      if (!before || before === lastPhase.current) return;
      const where = CITIES.find(c => c.id === ev.city)?.name || ev.city;
      const text = { countdown: `${BOSS_NAME} warning: it will rise from the sea off ${where} at 12:00 PH time.`, active: `${BOSS_NAME} has appeared in ${where}! Every player can join the fight.`,
        defeated: `${BOSS_NAME} has been defeated in ${where}!`, ended: `${BOSS_NAME} has retreated from ${where}. The city is rebuilt.` }[ev.phase];
      if (text) notify(session.current, text);
    }
    const poll = setInterval(refresh, 2000);
    return () => { alive = false; clearInterval(poll); };
  }, []);
  async function loadWeekly() { const api = server.current; if (!api) return; try { setWeekly(normalizeWeekly(await api.weekly())); } catch (error) { console.warn('Weekly board', error); } }
  async function claim() { const api = server.current; if (!api) return 0; const cash = Number(await api.claim()) || 0; if (cash) session.current.cash += cash; await loadWeekly(); return cash; }
  return { status, event, weekly, hits, clock, loadWeekly, claim, playerId: server.current?.playerId };
}
const num = v => Number(v) || 0;
function normalize(s) {
  return { ...s, hp: num(s.hp), maxHp: num(s.maxHp), startsAt: num(s.startsAt), endsAt: num(s.endsAt), defeatedAt: s.defeatedAt === null || s.defeatedAt === undefined ? null : num(s.defeatedAt), totalDamage: num(s.totalDamage),
    top: (s.top || []).map(r => ({ ...r, damage: num(r.damage), share: num(r.share) })), me: { ...s.me, damage: num(s.me?.damage) } };
}
function normalizeWeekly(w) {
  return { ...w, rows: (w.rows || []).map(r => ({ ...r, damage: num(r.damage) })), unclaimed: (w.unclaimed || []).map(r => r.reward ? { week: r.week, rank: r.rank, tier: r.reward.tier, cash: r.reward.cash, title: r.reward.title } : r) };
}
