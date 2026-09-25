// Uploads a folder of music to your Supabase project for the in-game playlist (see README, "Music playlist").
//
//   node scripts/upload-music.mjs "path/to/your/music folder" [--sync]
//
// Needs two environment variables, set in the terminal for this run only (never in .env files or Vercel):
//   SUPABASE_URL          your project URL, e.g. https://abcd.supabase.co
//   SUPABASE_SECRET_KEY   the secret key (sb_secret_…) or the legacy service_role key, from Project Settings -> API Keys
// The secret key can upload and edit everything, so it stays on your computer: the game never sees it.
//
// Every audio file in the folder (mp3, m4a, aac, ogg, opus, wav, webm, flac) is uploaded to the 'music' bucket, in
// file-name order, titled from its name ("01 - Artist - Title.mp3"). Each subfolder becomes a playlist named after it:
//   Music/Classic Rock/*.mp3, Music/Worship Song/*.mp3  ->  playlists "Classic Rock" and "Worship Song".
// Your plan's upload limit applies (50 MB per file on the Free plan). Running it again updates existing tracks
// instead of duplicating them. --sync also hides tracks that are no longer in the folder.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { MUSIC_BUCKET, audioType, storagePath, trackFromFile } from '../src/models/worldTour/playlist.js';

const args = process.argv.slice(2), sync = args.includes('--sync'), folder = args.find(a => !a.startsWith('--'));
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim(), key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const fail = message => { console.error(`\n${message}\n`); process.exit(1); };
if (!folder) fail('Usage: node scripts/upload-music.mjs "path/to/music folder" [--sync]');
if (!/^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(url.replace(/\/$/, ''))) fail('Set SUPABASE_URL to your project URL, e.g. https://abcd.supabase.co');
if (!key) fail('Set SUPABASE_SECRET_KEY to your project\'s secret key (Project Settings -> API Keys). It is only used on this computer.');

const dir = resolve(folder), byName = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const audioIn = path => readdirSync(path).filter(name => audioType(name) && statSync(join(path, name)).isFile()).sort(byName);
// Playlist folders keep their names, reduced to what Storage accepts (plain ASCII letters, digits, spaces and - _ & ( )).
const folderName = name => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[–—]/g, '-').replace(/[^A-Za-z0-9 _&()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const groups = [['', audioIn(dir)], ...readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory()).sort(byName).map(name => [name, audioIn(join(dir, name))])].filter(([, list]) => list.length);
if (!groups.length) fail(`No audio files found in ${dir} or its subfolders`);
const files = groups.flatMap(([sub, list]) => list.map((name, position) => ({ name, source: join(dir, sub, name), path: `${sub ? `${folderName(sub) || 'Playlist'}/` : ''}${storagePath(name)}`, position, playlist: sub ? folderName(sub) || 'Playlist' : 'Music' })));
const supabase = createClient(url.replace(/\/$/, ''), key, { auth: { persistSession: false } });

console.log(`Uploading ${files.length} track(s) in ${groups.length} playlist(s) from ${dir}`);
const rows = [];
for (const { name, source, path, position, playlist } of files) {
  const { artist, title } = trackFromFile(name), mb = (statSync(source).size / 1048576).toFixed(1);
  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, readFileSync(source), { contentType: audioType(name), upsert: true, cacheControl: '31536000' });
  if (error) { console.warn(`  FAIL  [${playlist}] ${name} (${mb} MB): ${error.message}${/size|large|exceed/i.test(error.message) ? ' - over your plan\'s upload limit (50 MB per file on Free)' : ''}`); continue; }
  rows.push({ path, title, artist, position, enabled: true });
  console.log(`  ok    [${playlist}] ${artist ? `${artist} - ` : ''}${title} (${mb} MB)`);
}
if (!rows.length) fail('Nothing was uploaded. Did you run supabase/music.sql first?');
const { error } = await supabase.from('music_tracks').upsert(rows, { onConflict: 'path' });
if (error) fail(`The files uploaded, but the playlist could not be saved: ${error.message}. Did you run supabase/music.sql?`);
if (sync) {
  const { error: hide } = await supabase.from('music_tracks').update({ enabled: false }).not('path', 'in', `(${rows.map(r => `"${r.path}"`).join(',')})`);
  if (hide) console.warn(`Could not hide old tracks: ${hide.message}`);
}
console.log(`\nDone: ${rows.length} track(s) in the playlist. Reload the game and press the ♫ Music button.`);
