// Uploads a folder of music to your Supabase project for the in-game playlist (see README, "Music playlist").
//
//   node scripts/upload-music.mjs "path/to/your/music folder" [--sync]
//
// Needs two environment variables, set in the terminal for this run only (never in .env files or Vercel):
//   SUPABASE_URL          your project URL, e.g. https://abcd.supabase.co
//   SUPABASE_SECRET_KEY   the secret key (sb_secret_…) or the legacy service_role key, from Project Settings -> API Keys
// The secret key can upload and edit everything, so it stays on your computer: the game never sees it.
//
// Every audio file in the folder (mp3, m4a, aac, ogg, opus, wav, webm, flac; up to 50 MB each) is uploaded to the
// 'music' bucket and added to the playlist in file-name order. Titles come from the file names: "01 - Artist - Title.mp3".
// Running it again updates existing tracks instead of duplicating them. --sync also hides tracks that are no longer in
// the folder (their files stay in Storage; delete them in the dashboard if you like).
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

const dir = resolve(folder);
const files = readdirSync(dir).filter(name => audioType(name) && statSync(join(dir, name)).isFile()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) fail(`No audio files found in ${dir}`);
const supabase = createClient(url.replace(/\/$/, ''), key, { auth: { persistSession: false } });

console.log(`Uploading ${files.length} track(s) from ${dir}`);
const rows = [];
for (const [i, name] of files.entries()) {
  const size = statSync(join(dir, name)).size, path = storagePath(name), { artist, title } = trackFromFile(name);
  if (size > 50 * 1024 * 1024) { console.warn(`  skip  ${name}: larger than 50 MB`); continue; }
  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, readFileSync(join(dir, name)), { contentType: audioType(name), upsert: true, cacheControl: '31536000' });
  if (error) { console.warn(`  FAIL  ${name}: ${error.message}`); continue; }
  rows.push({ path, title, artist, position: i, enabled: true });
  console.log(`  ok    ${String(i + 1).padStart(3)}. ${artist ? `${artist} - ` : ''}${title}`);
}
if (!rows.length) fail('Nothing was uploaded. Did you run supabase/music.sql first?');
const { error } = await supabase.from('music_tracks').upsert(rows, { onConflict: 'path' });
if (error) fail(`The files uploaded, but the playlist could not be saved: ${error.message}. Did you run supabase/music.sql?`);
if (sync) {
  const { error: hide } = await supabase.from('music_tracks').update({ enabled: false }).not('path', 'in', `(${rows.map(r => `"${r.path}"`).join(',')})`);
  if (hide) console.warn(`Could not hide old tracks: ${hide.message}`);
}
console.log(`\nDone: ${rows.length} track(s) in the playlist. Reload the game and press the ♫ Music button.`);
