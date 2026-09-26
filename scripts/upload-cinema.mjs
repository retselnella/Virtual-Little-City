// Uploads your shows and movies to your Supabase project for the Open-Air Cinema (see README, "Cinema").
//
//   node scripts/upload-cinema.mjs "path/to/your/videos folder"
//
// The folder should have a "shows" and/or a "movies" subfolder (videos at the top count as movies):
//   Videos/shows/01 - Pilot.mp4, Videos/movies/The Big Race.mp4
// Needs two environment variables, set in the terminal for this run only (never in .env files or Vercel):
//   SUPABASE_URL          your project URL, e.g. https://abcd.supabase.co
//   SUPABASE_SECRET_KEY   the secret key (sb_secret_…) or the legacy service_role key, from Project Settings -> API Keys
// Run supabase/cinema.sql first. Your plan's upload limit applies (50 MB per file on the Free plan). Uploading a file
// with the same name again replaces it.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CINEMA_BUCKET, titleFromFile, videoType } from '../src/models/worldTour/cinema.js';

const folder = process.argv.slice(2).find(a => !a.startsWith('--'));
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim(), key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const fail = message => { console.error(`\n${message}\n`); process.exit(1); };
if (!folder) fail('Usage: node scripts/upload-cinema.mjs "path/to/videos folder"');
if (!/^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(url.replace(/\/$/, ''))) fail('Set SUPABASE_URL to your project URL, e.g. https://abcd.supabase.co');
if (!key) fail('Set SUPABASE_SECRET_KEY to your project\'s secret key (Project Settings -> API Keys). It is only used on this computer.');

// Storage-safe names that keep the title readable (plain ASCII letters, digits, spaces and . _ - ( ) &).
const safeName = name => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[–—]/g, '-').replace(/[^A-Za-z0-9 ._()&-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const dir = resolve(folder), byName = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const videosIn = path => existsSync(path) ? readdirSync(path).filter(name => videoType(name) && statSync(join(path, name)).isFile()).sort(byName) : [];
const files = [['movies', videosIn(dir)], ['shows', videosIn(join(dir, 'shows'))], ['movies', videosIn(join(dir, 'movies'))]]
  .flatMap(([kind, list], i) => list.map(name => ({ name, kind, source: join(dir, i === 0 ? '' : kind, name), path: `${kind}/${safeName(name)}` })));
if (!files.length) fail(`No videos (mp4, m4v, webm, ogv, mov) found in ${dir}, ${join(dir, 'shows')} or ${join(dir, 'movies')}`);
const supabase = createClient(url.replace(/\/$/, ''), key, { auth: { persistSession: false } });
console.log(`Uploading ${files.length} video(s) from ${dir}`);
let done = 0;
for (const { name, kind, source, path } of files) {
  const mb = (statSync(source).size / 1048576).toFixed(1);
  const { error } = await supabase.storage.from(CINEMA_BUCKET).upload(path, readFileSync(source), { contentType: videoType(name), upsert: true, cacheControl: '31536000' });
  if (error) { console.warn(`  FAIL  [${kind}] ${name} (${mb} MB): ${error.message}${/size|large|exceed/i.test(error.message) ? ' - over your plan\'s upload limit (50 MB per file on Free)' : ''}`); continue; }
  done++; console.log(`  ok    [${kind}] ${titleFromFile(name)} (${mb} MB)`);
}
if (!done) fail('Nothing was uploaded. Did you run supabase/cinema.sql first?');
console.log(`\nDone: ${done} video(s). Reload the game and walk to the Open-Air Cinema (GPS: Cinema).`);
