import { buildPlaylists } from '../models/worldTour/playlist.js';
import { cachedRead } from './requestCache.js';

// Share one static index per page. Failed reads remain retryable; music needs no Supabase client.
export function createMusicLoader(fetcher = (...args) => fetch(...args), base = import.meta.env?.BASE_URL || '/') {
  return cachedRead(async () => {
    const response = await fetcher(`${base}music-manifest.json`);
    if (!response.ok) throw new Error(`Music index could not be loaded (${response.status}). Try reloading the page.`);
    const manifest = await response.json();
    if (manifest?.version !== 1 || !manifest.folders || typeof manifest.folders !== 'object' || Array.isArray(manifest.folders)) throw new Error('The music index is invalid. Rebuild the site to refresh it.');
    return buildPlaylists(manifest.folders, [], path => `${base}music/${path.split('/').map(encodeURIComponent).join('/')}`);
  }, Infinity);
}

export const loadPlaylists = createMusicLoader();
