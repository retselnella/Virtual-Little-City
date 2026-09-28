import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { MUSIC_BUCKET, buildPlaylists } from '../models/worldTour/playlist.js';
import { guestClient } from './guestSession.js';
import { cachedRead } from './requestCache.js';

const MAX_FOLDERS = 30, LIST = { limit: 1000, sortBy: { column: 'name', order: 'asc' } };
const cache = new WeakMap();
// The playlists from Supabase: every folder in the public 'music' bucket is a playlist (files at the top form one
// more), with optional titles and order from the music_tracks table. Track URLs are built here from the project's own
// address, never taken from the server's data.
export async function loadPlaylists({ configured = ONLINE_CONFIGURED, client } = {}) {
  if (!configured) return null;
  const db = client || (await guestClient()).client;
  if (!cache.has(db)) cache.set(db, cachedRead(() => fetchPlaylists(db), 300000));
  return cache.get(db)();
}
async function fetchPlaylists(db) {
  const base = `${ONLINE.url}/storage/v1/object/public/${MUSIC_BUCKET}/`;
  const urlFor = path => base + path.split('/').map(encodeURIComponent).join('/');
  if (db.rpc) {
    const { data, error } = await db.rpc('music_manifest');
    if (!error) {
      const folders = Object.create(null), metadata = [];
      for (const row of Array.isArray(data) ? data : []) {
        if (typeof row?.path !== 'string') continue;
        const parts = row.path.split('/');
        if (parts.length > 2) continue;
        const folder = parts.length === 2 ? parts[0] : '', name = parts.at(-1);
        if (folder.startsWith('.')) continue;
        if (!folders[folder]) {
          if (folder && Object.keys(folders).filter(Boolean).length >= MAX_FOLDERS) continue;
          folders[folder] = [];
        }
        if (folders[folder].length >= LIST.limit) continue;
        folders[folder].push({ name });
        if (row.title || row.enabled === false) metadata.push(row);
      }
      return buildPlaylists(folders, metadata, urlFor);
    }
    // Older installations still work until music.sql is reapplied. Other errors must not multiply requests.
    if (error.code !== 'PGRST202') throw error;
  }
  const bucket = db.storage.from(MUSIC_BUCKET);
  const [top, table] = await Promise.all([bucket.list('', LIST), db.from('music_tracks').select('path,title,artist,position,enabled')]);
  // The table is optional (a missing table just means titles come from file names); the bucket is not.
  if (top.error) throw top.error;
  // Storage lists folders as entries without an id; files have one.
  const entries = top.data || [], folders = { '': entries.filter(e => e.id) };
  const names = entries.filter(e => !e.id && e.name && !e.name.startsWith('.')).map(e => e.name).slice(0, MAX_FOLDERS);
  // Bound concurrent requests during the migration fallback as well.
  for (let i = 0; i < names.length; i += 4) {
    const batch = names.slice(i, i + 4), listed = await Promise.all(batch.map(name => bucket.list(name, LIST)));
    batch.forEach((name, k) => { if (!listed[k].error) folders[name] = (listed[k].data || []).filter(e => e.id); });
  }
  return buildPlaylists(folders, table.error ? [] : table.data, urlFor);
}
