// The in-game music playlist: the audio files in the public `music` Storage bucket (supabase/music.sql), uploaded from
// the dashboard or with scripts/upload-music.mjs, with optional titles and order from the `music_tracks` table.
export const MUSIC_BUCKET = 'music';
export const AUDIO_TYPES = Object.freeze({ mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac' });
// A file in the bucket: any name up to 200 characters without control characters, backslashes or '..' parts (names
// uploaded from the dashboard can have spaces, accents and punctuation; URLs encode them).
const validPath = path => typeof path === 'string' && path.length <= 200 && !/[\u0000-\u001f\u007f\\]/.test(path) && !path.startsWith('/') && !path.split('/').some(part => part === '..' || part === '.' || !part);
const text = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

// The playlist from the bucket's files and the optional music_tracks table: tracks listed in the table come first, in
// their position order and with their titles; every other audio file follows in file-name order, titled from its name.
// Hidden rows (enabled = false) drop their file. Everything from the server is untrusted and cleaned.
export function buildPlaylist(files, rows, urlFor) {
  const listed = (Array.isArray(rows) ? rows : []).filter(r => validPath(r?.path)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const hidden = new Set(listed.filter(r => r.enabled === false).map(r => r.path)), known = new Set(listed.map(r => r.path));
  const names = (Array.isArray(files) ? files : []).map(f => f?.name).filter(name => validPath(name) && audioType(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const inBucket = new Set(names);
  return cleanTracks([
    ...listed.filter(r => r.enabled !== false && (!files || inBucket.has(r.path))),
    ...names.filter(name => !known.has(name) && !hidden.has(name)).map(name => ({ path: name, ...trackFromFile(name) })),
  ], urlFor);
}
// Rows from the server are untrusted: keep only well-formed tracks, with a playable URL built by `urlFor`.
export function cleanTracks(rows, urlFor) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.flatMap(row => {
    const path = validPath(row?.path) ? row.path : null, title = text(row?.title, 120);
    if (!path || !title || seen.has(path)) return [];
    seen.add(path);
    return [{ id: path, title, artist: text(row?.artist, 120), url: urlFor(path) }];
  });
}

// Play order: the playlist order, or a shuffle that plays every track once before repeating.
export function playOrder(count, shuffle = false, random = Math.random) {
  const order = Array.from({ length: count }, (_, i) => i);
  if (shuffle) for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
// The track `step` places after (or before, with -1) `current` in `order`, wrapping round.
export function stepTrack(order, current, step = 1) {
  if (!order.length) return -1;
  const at = order.indexOf(current);
  return order[((at < 0 ? (step > 0 ? -1 : 0) : at) + step + order.length) % order.length];
}

// ---- For the upload script: turning a folder of files into tracks.
// "03 - Artist Name - Song Title.mp3" -> { artist: 'Artist Name', title: 'Song Title' }; "Song.mp3" -> { title: 'Song' }.
export function trackFromFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\s*\d{1,3}\s*[-.)]?\s+/, '').trim();
  const parts = base.split(/\s+[-–]\s+/);
  const artist = parts.length > 1 ? parts[0] : '', title = parts.length > 1 ? parts.slice(1).join(' - ') : base;
  return { artist: text(artist, 120), title: text(title, 120) || 'Untitled' };
}
export const audioType = fileName => AUDIO_TYPES[(/\.([^.]+)$/.exec(fileName)?.[1] || '').toLowerCase()] || null;
// A Storage-safe file name: letters, digits, dots and dashes, keeping the extension, plus a short hash of the original
// name so two songs that differ only in accents or punctuation do not collide.
export function storagePath(fileName) {
  const ext = (/\.([^.]+)$/.exec(fileName)?.[1] || 'mp3').toLowerCase();
  const stem = fileName.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80) || 'track';
  let hash = 2166136261; for (const c of fileName) hash = Math.imul(hash ^ c.codePointAt(0), 16777619) >>> 0;
  return `${stem}-${hash.toString(36).slice(0, 6)}.${ext}`;
}
