// The music player: what is playing, play/pause, previous/next, shuffle, volume, and the playlists (one per folder in
// the site's music storage) with their songs to pick from.
export function MusicPanel({ music }) {
  const { status, problem, playlists, view, viewed, current, playing, track, playingList, volume, shuffle } = music;
  if (status === 'offline') return <p>Music plays from the site's Supabase project. Once the site owner sets it up and uploads songs (README: "Music playlist"), the playlists appear here for everyone.</p>;
  if (status === 'loading') return <p>Loading the playlists…</p>;
  if (status === 'error') return <><p>The playlists could not be loaded right now.</p>{problem && <p className="boss-problem">{problem}</p>}</>;
  if (status === 'empty') return <p>No music yet. The site owner can upload songs to the <b>music</b> bucket in Supabase Storage; each folder there becomes a playlist.</p>;
  return <div className="music-panel">
    <section className="music-now" aria-live="polite">
      <small>{playing ? `NOW PLAYING · ${playingList.name.toUpperCase()}` : track ? 'PAUSED' : `${playlists.length} PLAYLIST${playlists.length > 1 ? 'S' : ''}`}</small>
      <strong>{track ? track.title : 'Pick a playlist and press play'}</strong>
      <span>{track?.artist || (track ? playingList.name : 'Plays in every city, on foot, in the car and at sea.')}</span>
    </section>
    <div className="music-controls">
      <button onClick={music.previous} aria-label="Previous track">⏮</button>
      <button className="music-play" onClick={music.toggle} aria-label={playing ? 'Pause music' : 'Play music'}>{playing ? '❚❚' : '▶'}</button>
      <button onClick={music.next} aria-label="Next track">⏭</button>
      <button onClick={music.toggleShuffle} aria-pressed={shuffle} className="music-shuffle">Shuffle</button>
      <label className="music-volume"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => music.setVolume(e.target.value)} aria-label="Music volume" /></label>
    </div>
    {problem && <p className="boss-problem">{problem}</p>}
    {playlists.length > 1 && <div className="music-playlists" role="tablist" aria-label="Playlists">{playlists.map((p, i) =>
      <button key={p.id} role="tab" aria-selected={i === view} onClick={() => music.browse(i)}>{playingList === p && playing ? '♫ ' : ''}{p.name} <small>{p.tracks.length}</small></button>)}</div>}
    <ol className="music-list" aria-label={`${viewed.name} songs`}>{viewed.tracks.map((t, i) => <li key={t.id}><button aria-current={i === current ? 'true' : undefined} onClick={() => music.pick(i)}><b>{i === current && playing ? '♫' : i + 1}</b><span>{t.title}</span><small>{t.artist}</small></button></li>)}</ol>
  </div>;
}
