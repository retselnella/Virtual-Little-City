import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioType } from '../src/models/worldTour/playlist.js';

// Index names only, never read audio into memory. Skip symlinks, hidden files and nested folders.
export function musicManifest(root) {
  const entries = path => {
    try { return readdirSync(path, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const audio = path => entries(path).filter(e => e.isFile() && !e.name.startsWith('.') && audioType(e.name))
    .map(e => ({ name: e.name })).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const folders = Object.create(null);
  folders[''] = audio(root);
  for (const entry of entries(root).filter(e => e.isDirectory() && !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name, 'en'))) folders[entry.name] = audio(join(root, entry.name));
  return { version: 1, folders };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const manifest = musicManifest(join(publicDir, 'music'));
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'music-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Music: indexed ${Object.values(manifest.folders).reduce((n, files) => n + files.length, 0)} songs from public/music.`);
}
