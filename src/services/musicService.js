import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { MUSIC_BUCKET, buildPlaylist } from '../models/worldTour/playlist.js';
import { guestClient } from './guestSession.js';

// The playlist from Supabase: the audio files in the public 'music' bucket, with titles and order from the optional
// music_tracks table. Track URLs are built here from the project's own address, never taken from the server's data.
export async function loadPlaylist({ configured = ONLINE_CONFIGURED, client } = {}) {
  if (!configured) return null;
  const db = client || (await guestClient()).client;
  const [listing, table] = await Promise.all([
    db.storage.from(MUSIC_BUCKET).list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
    db.from('music_tracks').select('path,title,artist,position,enabled'),
  ]);
  // The table is optional (a missing table just means titles come from file names); the bucket is not.
  if (listing.error) throw listing.error;
  const base = `${ONLINE.url}/storage/v1/object/public/${MUSIC_BUCKET}/`;
  return buildPlaylist(listing.data, table.error ? [] : table.data, path => base + path.split('/').map(encodeURIComponent).join('/'));
}
