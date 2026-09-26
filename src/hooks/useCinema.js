import { useEffect, useRef, useState } from 'react';
import { loadReels } from '../services/cinemaService.js';
import { SCREEN, cinemaVolume, nowShowing, programmeOf } from '../models/worldTour/venues.js';
import { actor } from '../models/worldTour/worldAdventure.js';

const STREAM_RANGE = 260, DRIFT = 1.5, MAX_REELS = 40;
// Film lengths, read from each file's metadata (the same for every player, so everyone's timetable agrees).
function durationOf(url) {
  return new Promise(resolve => {
    const v = document.createElement('video'), done = value => { clearTimeout(timer); v.removeAttribute('src'); v.load(); resolve(value); };
    const timer = setTimeout(() => done(null), 20000);
    v.preload = 'metadata'; v.muted = true; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null); v.onerror = () => done(null);
    v.src = url;
  });
}
// The open-air cinema: loads the programme (shows and movies from the site's Storage), and plays whatever is on now by
// the shared world clock into one <video> element that the scene paints onto the screen. It only streams while you
// are within STREAM_RANGE of the screen, keeps within DRIFT seconds of the timetable, and gets louder as you walk up to
// it (sound starts after your first tap or key press, as browsers require). The scene reads session.cinema.
export function useCinema(session) {
  const [status, setStatus] = useState('loading'), [showing, setShowing] = useState(null), [count, setCount] = useState(0);
  const video = useRef(null), programme = useRef([]), unlocked = useRef(false), state = useRef('loading');
  useEffect(() => {
    let alive = true;
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous'; el.playsInline = true; el.setAttribute('playsinline', ''); el.muted = true; el.preload = 'auto'; video.current = el;
    const setState = next => { state.current = next; if (alive) setStatus(next); };
    loadReels().then(async reels => {
      if (!alive) return;
      if (reels === null) { setState('offline'); return; }
      const all = [...reels.shows.map(r => ({ ...r, kind: 'show' })), ...reels.movies.map(r => ({ ...r, kind: 'movie' }))].slice(0, MAX_REELS);
      if (!all.length) { setState('empty'); return; }
      const measured = [];
      for (const reel of all) { const duration = await durationOf(reel.url); if (!alive) return; if (duration) measured.push({ ...reel, duration }); }
      programme.current = programmeOf(measured.filter(r => r.kind === 'show'), measured.filter(r => r.kind === 'movie'));
      setCount(programme.current.length); setState(programme.current.length ? 'ready' : 'error');
    }).catch(error => { console.warn('Cinema unavailable', error); setState('error'); });
    const unlock = () => { unlocked.current = true; };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    function sync() {
      const s = session.current; if (!s) return;
      const t = s.worldTime ?? Date.now() / 1000, show = nowShowing(programme.current, t), at = actor(s);
      const near = Math.hypot(at.x - SCREEN.x, at.z - SCREEN.z) < STREAM_RANGE, rolling = !!show && !show.intermission && near;
      if (rolling) {
        if (el.dataset.src !== show.item.url) {
          el.src = show.item.url; el.dataset.src = show.item.url;
          el.onloadedmetadata = () => { const current = nowShowing(programme.current, session.current.worldTime ?? Date.now() / 1000); if (current && !current.intermission) el.currentTime = current.offset; };
        } else if (el.readyState >= 1 && Math.abs(el.currentTime - show.offset) > DRIFT) el.currentTime = show.offset;
        if (el.paused) el.play().catch(() => {});
      } else {
        if (!el.paused) el.pause();
        if (!near && el.dataset.src) { el.removeAttribute('src'); delete el.dataset.src; el.load(); }
      }
      const volume = cinemaVolume(at); el.volume = volume; el.muted = !unlocked.current || volume === 0;
      s.cinema = { video: el, live: rolling && el.readyState >= 2 && !el.paused, show, status: state.current };
      if (alive) setShowing(show && { title: show.item.title, kind: show.item.kind, intermission: show.intermission, left: show.intermission ? show.startsIn : show.left, next: show.next?.title, nextKind: show.next?.kind, live: s.cinema.live });
    }
    const tick = setInterval(sync, 500);
    return () => {
      alive = false; clearInterval(tick); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock);
      el.pause(); el.removeAttribute('src'); el.load();
    };
  }, []);
  return { status, showing, count };
}
