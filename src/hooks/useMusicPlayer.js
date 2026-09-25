import { useEffect, useRef, useState } from 'react';
import { loadPlaylists } from '../services/musicService.js';
import { readMusicPreference, writeMusicPreference } from '../services/preferences.js';
import { playOrder, stepTrack } from '../models/worldTour/playlist.js';

// The in-game music player: loads the playlists (one per folder in the Supabase music bucket) and plays them with one
// <audio> element. You browse any playlist; next/previous and the end of a song move through the playlist that is
// playing. Browsers only allow sound after the player interacts with the page, so music that was on last time resumes
// on the first click or key press. Music pauses while the game's tab is hidden. Volume, shuffle and the chosen
// playlist are remembered in this browser. A track that fails to load is skipped.
export function useMusicPlayer() {
  const [playlists, setPlaylists] = useState([]), [status, setStatus] = useState('loading'), [problem, setProblem] = useState('');
  const [view, setView] = useState(0), [playing, setPlaying] = useState(false), [now, setNow] = useState({ list: -1, index: -1 }), [prefs, setPrefs] = useState(readMusicPreference);
  const audio = useRef(null), order = useRef([]), lists = useRef([]), failures = useRef(0), live = useRef({});
  live.current = { now, prefs };
  function remember(next) { setPrefs(next); writeMusicPreference(next); }
  function start(list, index) {
    const el = audio.current, track = lists.current[list]?.tracks[index]; if (!el || !track) return;
    if (list !== live.current.now.list) order.current = playOrder(lists.current[list].tracks.length, live.current.prefs.shuffle);
    if (el.dataset.track !== track.url) { el.src = track.url; el.dataset.track = track.url; }
    setNow({ list, index }); live.current.now = { list, index }; el.play().catch(() => setPlaying(false));
    if (typeof navigator !== 'undefined' && navigator.mediaSession && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist || lists.current[list].name, album: `Little City radio · ${lists.current[list].name}` });
  }
  const step = dir => { const { list, index } = live.current.now; if (list >= 0) start(list, stepTrack(order.current, index, dir)); };
  useEffect(() => {
    const el = new Audio(); el.preload = 'none'; el.volume = readMusicPreference().volume; audio.current = el;
    const onPlay = () => { setPlaying(true); failures.current = 0; }, onPause = () => setPlaying(false), onEnded = () => step(1);
    const onError = () => {
      setPlaying(false);
      const count = lists.current[live.current.now.list]?.tracks.length || 0;
      if (++failures.current < count) step(1);
      else { setProblem('None of the songs in this playlist could be played. Check that the files are uploaded and are audio the browser supports (mp3 is safest).'); failures.current = 0; }
    };
    el.addEventListener('play', onPlay); el.addEventListener('pause', onPause); el.addEventListener('ended', onEnded); el.addEventListener('error', onError);
    let alive = true;
    loadPlaylists().then(result => {
      if (!alive) return;
      if (result === null) { setStatus('offline'); return; }
      lists.current = result; setPlaylists(result);
      const saved = result.findIndex(p => p.id === readMusicPreference().playlist); setView(Math.max(0, saved));
      setStatus(result.length ? 'ready' : 'empty');
    }).catch(error => { if (alive) { setStatus('error'); setProblem(error?.message || String(error)); } });
    // Music that was playing last visit resumes with the first interaction (autoplay rules).
    const resume = () => {
      removeEventListener('pointerdown', resume); removeEventListener('keydown', resume);
      const { prefs: p } = live.current, list = Math.max(0, lists.current.findIndex(l => l.id === p.playlist));
      if (p.on && lists.current.length && el.paused) { order.current = playOrder(lists.current[list].tracks.length, p.shuffle); start(list, order.current[0]); }
    };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
    // Music plays only while you are in the game: switching tab or minimising pauses it (so the browser tab stops
    // showing sound), and coming back picks up where it left off.
    let away = false;
    const visibility = () => {
      if (document.hidden) { if (!el.paused) { away = true; el.pause(); } }
      else if (away) { away = false; el.play().catch(() => {}); }
    };
    document.addEventListener('visibilitychange', visibility);
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    session?.setActionHandler?.('nexttrack', () => step(1)); session?.setActionHandler?.('previoustrack', () => step(-1));
    return () => {
      alive = false; el.pause(); el.removeAttribute('src');
      el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); el.removeEventListener('ended', onEnded); el.removeEventListener('error', onError);
      removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); document.removeEventListener('visibilitychange', visibility);
      session?.setActionHandler?.('nexttrack', null); session?.setActionHandler?.('previoustrack', null);
    };
  }, []);
  const playingList = playlists[now.list];
  return {
    status, problem, playlists, view, viewed: playlists[view] || null, playing, volume: prefs.volume, shuffle: prefs.shuffle,
    track: playingList?.tracks[now.index] || null, playingList: playingList || null, current: now.list === view ? now.index : -1,
    browse(index) { if (playlists[index]) setView(index); },
    toggle() {
      const el = audio.current; if (!el || !playlists.length) return;
      if (playing) { el.pause(); remember({ ...prefs, on: false }); return; }
      if (now.list >= 0) start(now.list, now.index);
      else { order.current = playOrder(playlists[view].tracks.length, prefs.shuffle); start(view, order.current[0]); }
      remember({ ...prefs, on: true, playlist: playlists[now.list >= 0 ? now.list : view].id });
    },
    next() { if (now.list >= 0) { step(1); remember({ ...prefs, on: true }); } },
    previous() { if (now.list >= 0) { step(-1); remember({ ...prefs, on: true }); } },
    pick(index) { start(view, index); remember({ ...prefs, on: true, playlist: playlists[view].id }); },
    setVolume(value) { const volume = Math.max(0, Math.min(1, Number(value) || 0)); if (audio.current) audio.current.volume = volume; remember({ ...prefs, volume }); },
    toggleShuffle() { if (now.list >= 0) order.current = playOrder(playlists[now.list].tracks.length, !prefs.shuffle); remember({ ...prefs, shuffle: !prefs.shuffle }); },
  };
}
