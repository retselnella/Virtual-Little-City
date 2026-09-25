import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { MUSIC_BUCKET, buildPlaylists } from '../models/worldTour/playlist.js';
import { guestClient } from './guestSession.js';

const MAX_FOLDERS = 30, LIST = { limit: 1000, sortBy: { column: 'name', order: 'asc' } };
// The playlists from Supabase: every folder in the public 'music' bucket is a playlist (files at the top form one
// more), with optional titles and order from the music_tracks table. Track URLs are built here from the project's own
// address, never taken from the server's data.
export async function loadPlaylists({ configured = ONLINE_CONFIGURED, client } = {}) {
  if (!configured) return null;
  const db = client || (await guestClient()).client, bucket = db.storage.from(MUSIC_BUCKET);
  const [top, table] = await Promise.all([bucket.list('', LIST), db.from('music_tracks').select('path,title,artist,position,enabled')]);
  // The table is optional (a missing table just means titles come from file names); the bucket is not.
  if (top.error) throw top.error;
  // Storage lists folders as entries without an id; files have one.
  const entries = top.data || [], folders = { '': entries.filter(e => e.id) };
  const names = entries.filter(e => !e.id && e.name && !e.name.startsWith('.')).map(e => e.name).slice(0, MAX_FOLDERS);
  const listed = await Promise.all(names.map(name => bucket.list(name, LIST)));
  names.forEach((name, i) => { if (!listed[i].error) folders[name] = (listed[i].data || []).filter(e => e.id); });
  const base = `${ONLINE.url}/storage/v1/object/public/${MUSIC_BUCKET}/`;
  return buildPlaylists(folders, table.error ? [] : table.data, path => base + path.split('/').map(encodeURIComponent).join('/'));
}
