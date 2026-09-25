import { useEffect, useRef, useState } from 'react';
import { loadPlaylist } from '../services/musicService.js';
import { readMusicPreference, writeMusicPreference } from '../services/preferences.js';
import { playOrder, stepTrack } from '../models/worldTour/playlist.js';

// The in-game music player: loads the playlist from Supabase and plays it with one <audio> element. Browsers only
// allow sound after the player interacts with the page, so music that was on last time resumes on the first click
// or key press. Volume and shuffle are remembered in this browser. A track that fails to load is skipped.
export function useMusicPlayer() {
  const [tracks, setTracks] = useState([]), [status, setStatus] = useState('loading'), [problem, setProblem] = useState('');
  const [current, setCurrent] = useState(-1), [playing, setPlaying] = useState(false), [prefs, setPrefs] = useState(readMusicPreference);
  const audio = useRef(null), order = useRef([]), list = useRef([]), failures = useRef(0), live = useRef({});
  live.current = { current, prefs };
  function remember(next) { setPrefs(next); writeMusicPreference(next); }
  function start(index) {
    const el = audio.current, track = list.current[index]; if (!el || !track) return;
    if (el.dataset.track !== track.id) { el.src = track.url; el.dataset.track = track.id; }
    setCurrent(index); el.play().catch(() => setPlaying(false));
    if (typeof navigator !== 'undefined' && navigator.mediaSession && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist || 'Little City radio', album: 'Little City: World Tour' });
  }
  const step = dir => start(stepTrack(order.current, live.current.current, dir));
  useEffect(() => {
    const el = new Audio(); el.preload = 'none'; el.volume = readMusicPreference().volume; audio.current = el;
    const onPlay = () => { setPlaying(true); failures.current = 0; }, onPause = () => setPlaying(false), onEnded = () => step(1);
    const onError = () => {
      setPlaying(false);
      if (++failures.current < list.current.length) step(1);
      else { setProblem('None of the tracks could be played. Check that the music bucket is public and the files are uploaded.'); failures.current = 0; }
    };
    el.addEventListener('play', onPlay); el.addEventListener('pause', onPause); el.addEventListener('ended', onEnded); el.addEventListener('error', onError);
    let alive = true;
    loadPlaylist().then(result => {
      if (!alive) return;
      if (result === null) { setStatus('offline'); return; }
      list.current = result; setTracks(result); order.current = playOrder(result.length, readMusicPreference().shuffle);
      setStatus(result.length ? 'ready' : 'empty');
    }).catch(error => { if (alive) { setStatus('error'); setProblem(error?.message || String(error)); } });
    // Music that was playing last visit resumes with the first interaction (autoplay rules).
    const resume = () => { removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); if (live.current.prefs.on && list.current.length && el.paused) start(order.current[0] ?? 0); };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    session?.setActionHandler?.('nexttrack', () => step(1)); session?.setActionHandler?.('previoustrack', () => step(-1));
    return () => {
      alive = false; el.pause(); el.removeAttribute('src');
      el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); el.removeEventListener('ended', onEnded); el.removeEventListener('error', onError);
      removeEventListener('pointerdown', resume); removeEventListener('keydown', resume);
      session?.setActionHandler?.('nexttrack', null); session?.setActionHandler?.('previoustrack', null);
    };
  }, []);
  return {
    status, problem, tracks, current, playing, volume: prefs.volume, shuffle: prefs.shuffle, track: tracks[current] || null,
    toggle() {
      const el = audio.current; if (!el || !tracks.length) return;
      if (playing) { el.pause(); remember({ ...prefs, on: false }); } else { start(current >= 0 ? current : order.current[0] ?? 0); remember({ ...prefs, on: true }); }
    },
    next() { if (tracks.length) { step(1); remember({ ...prefs, on: true }); } },
    previous() { if (tracks.length) { step(-1); remember({ ...prefs, on: true }); } },
    pick(index) { start(index); remember({ ...prefs, on: true }); },
    setVolume(value) { const volume = Math.max(0, Math.min(1, Number(value) || 0)); if (audio.current) audio.current.volume = volume; remember({ ...prefs, volume }); },
    toggleShuffle() { order.current = playOrder(tracks.length, !prefs.shuffle); remember({ ...prefs, shuffle: !prefs.shuffle }); },
  };
}
