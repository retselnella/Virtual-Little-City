import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { CINEMA_BUCKET, buildReels } from '../models/worldTour/cinema.js';
import { guestClient } from './guestSession.js';

const LIST = { limit: 500, sortBy: { column: 'name', order: 'asc' } };
// The cinema's shows and movies from the public 'cinema' bucket. URLs are built from the project's own address.
export async function loadReels({ configured = ONLINE_CONFIGURED, client } = {}) {
  if (!configured) return null;
  const bucket = (client || (await guestClient()).client).storage.from(CINEMA_BUCKET);
  const [top, shows, movies] = await Promise.all([bucket.list('', LIST), bucket.list('shows', LIST), bucket.list('movies', LIST)]);
  if (top.error) throw top.error;
  const files = result => (result.error ? [] : result.data || []).filter(e => e.id);
  const base = `${ONLINE.url}/storage/v1/object/public/${CINEMA_BUCKET}/`;
  return buildReels({ '': files(top), shows: files(shows), movies: files(movies) }, path => base + path.split('/').map(encodeURIComponent).join('/'));
}
