// The music player: what is playing, play/pause, previous/next, shuffle, volume, and the playlist to pick from.
export function MusicPanel({ music }) {
  const { status, problem, tracks, current, playing, track, volume, shuffle } = music;
  if (status === 'offline') return <p>Music plays from the site's Supabase project. Once the site owner sets it up and uploads a playlist (README: "Music playlist"), it appears here for everyone.</p>;
  if (status === 'loading') return <p>Loading the playlist…</p>;
  if (status === 'error') return <><p>The playlist could not be loaded right now.</p>{problem && <p className="boss-problem">{problem}</p>}</>;
  if (status === 'empty') return <p>The playlist is empty. The site owner can upload a folder of music with <code>scripts/upload-music.mjs</code>.</p>;
  return <div className="music-panel">
    <section className="music-now" aria-live="polite">
      <small>{playing ? 'NOW PLAYING' : track ? 'PAUSED' : `${tracks.length} TRACKS`}</small>
      <strong>{track ? track.title : 'Press play to start the radio'}</strong>
      <span>{track?.artist || (track ? 'Little City radio' : 'Plays in every city, on foot, in the car and at sea.')}</span>
    </section>
    <div className="music-controls">
      <button onClick={music.previous} aria-label="Previous track">⏮</button>
      <button className="music-play" onClick={music.toggle} aria-label={playing ? 'Pause music' : 'Play music'}>{playing ? '❚❚' : '▶'}</button>
      <button onClick={music.next} aria-label="Next track">⏭</button>
      <button onClick={music.toggleShuffle} aria-pressed={shuffle} className="music-shuffle">Shuffle</button>
      <label className="music-volume"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => music.setVolume(e.target.value)} aria-label="Music volume" /></label>
    </div>
    {problem && <p className="boss-problem">{problem}</p>}
    <ol className="music-list" aria-label="Playlist">{tracks.map((t, i) => <li key={t.id}><button aria-current={i === current ? 'true' : undefined} onClick={() => music.pick(i)}><b>{i === current && playing ? '♫' : i + 1}</b><span>{t.title}</span><small>{t.artist}</small></button></li>)}</ol>
  </div>;
}
