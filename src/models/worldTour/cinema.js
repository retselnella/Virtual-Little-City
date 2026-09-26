// The cinema's films: the video files in the public `cinema` Storage bucket (supabase/cinema.sql). Files in the
// shows/ folder are shows (episodes, clips), files in movies/ (or at the top) are movies; each plays in file-name
// order and is titled from its name ("01 - The Big Race.mp4" shows as "The Big Race"). Only upload what you have the
// right to show publicly.
export const CINEMA_BUCKET = 'cinema';
export const VIDEO_TYPES = Object.freeze({ mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' });
export const videoType = name => VIDEO_TYPES[String(name).split('.').pop().toLowerCase()] || null;
const validPath = path => typeof path === 'string' && path.length <= 200 && !/[\u0000-\u001f\u007f\\]/.test(path) && !path.startsWith('/') && !path.split('/').some(part => part === '..' || part === '.' || !part);
// A title from a file name: no extension, no leading track number, underscores and dots as spaces.
export function titleFromFile(name) {
  const base = String(name).split('/').pop().replace(/\.[^.]+$/, '');
  return base.replace(/^\s*\d+\s*[-._)]\s*/, '').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
}
// Reels from the listed files: `folders` maps 'shows', 'movies' and '' (the top) to their files.
export function buildReels(folders, urlFor) {
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const list = folder => (folders?.[folder] || []).map(f => f?.name).filter(name => validPath(name) && videoType(name)).sort(byName)
    .map(name => { const path = folder ? `${folder}/${name}` : name; return { id: path, title: titleFromFile(name), url: urlFor(path) }; });
  return { shows: list('shows'), movies: [...list('movies'), ...list('')] };
}
