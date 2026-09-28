import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { audioType, buildPlaylist, buildPlaylists, cleanTracks, playOrder, stepTrack, storagePath, trackFromFile } from '../../src/models/worldTour/playlist.js';
import { createMusicLoader } from '../../src/services/musicService.js';
import { readMusicPreference, writeMusicPreference } from '../../src/services/preferences.js';

test('file names become tracks with Storage-safe paths', () => {
  assert.deepEqual(trackFromFile('03 - Daft Crew - One More Time.mp3'), { artist: 'Daft Crew', title: 'One More Time' });
  assert.deepEqual(trackFromFile('Sunset_Drive.m4a'), { artist: '', title: 'Sunset Drive' });
  assert.deepEqual(trackFromFile('12. Band – Song - Live.flac'), { artist: 'Band', title: 'Song - Live' });
  assert.equal(audioType('a.MP3'), 'audio/mpeg'); assert.equal(audioType('cover.jpg'), null); assert.equal(audioType('notes'), null);
  const path = storagePath('Café del Mar – Ibiza #1 (Remix).mp3');
  assert.match(path, /^[a-z0-9-]+-[a-z0-9]{1,6}\.mp3$/); assert.equal(path, storagePath('Café del Mar – Ibiza #1 (Remix).mp3'), 'stable across runs');
  assert.notEqual(storagePath('Song!.mp3'), storagePath('Song?.mp3'), 'names that clean up the same still get different paths');
});

test('server rows are cleaned before they reach the player', () => {
  const url = path => `https://abc.supabase.co/storage/v1/object/public/music/${path}`;
  const tracks = cleanTracks([
    { path: 'song-1.mp3', title: '  First\u0007 song ', artist: 'Band' }, { path: '../secret.mp3', title: 'x' }, { path: '/root.mp3', title: 'x' }, { path: 'a\\b.mp3', title: 'x' },
    { path: 'song-2.mp3', title: '' }, { path: 'song-1.mp3', title: 'Duplicate' }, { path: 'song-3.ogg', title: 'Third', artist: null }, null,
  ], url);
  assert.deepEqual(tracks, [{ id: 'song-1.mp3', title: 'First song', artist: 'Band', url: url('song-1.mp3') }, { id: 'song-3.ogg', title: 'Third', artist: '', url: url('song-3.ogg') }]);
  assert.deepEqual(cleanTracks('nope', url), []);
});

test('files uploaded from the dashboard play in name order; the optional table sets titles, order, or hides a file', () => {
  const url = path => `https://abc.supabase.co/storage/v1/object/public/music/${path}`;
  const files = [{ name: '02 - Band - Second Song.mp3' }, { name: '01 - Band - First Song.mp3' }, { name: 'cover.jpg' }, { name: '.emptyFolderPlaceholder' }, { name: 'Bonus.m4a' }, { name: 'Old.mp3' }, { name: '10 - Band - Tenth.mp3' }];
  assert.deepEqual(buildPlaylist(files, [], url).map(t => [t.title, t.artist]), [['First Song', 'Band'], ['Second Song', 'Band'], ['Tenth', 'Band'], ['Bonus', ''], ['Old', '']], 'numbers sort naturally; only audio');
  assert.equal(buildPlaylist(files, [], url)[0].id, '01 - Band - First Song.mp3');
  const rows = [{ path: 'Bonus.m4a', title: 'Opening Theme', artist: 'Me', position: 0 }, { path: 'Old.mp3', title: 'Old', enabled: false }, { path: 'deleted.mp3', title: 'Gone', position: 1 }];
  assert.deepEqual(buildPlaylist(files, rows, url).map(t => t.title), ['Opening Theme', 'First Song', 'Second Song', 'Tenth'], 'table first, hidden and deleted files skipped');
  assert.deepEqual(buildPlaylist(null, null, url), []);
});

test('play order: in order, or shuffled with every track once; next and previous wrap round', () => {
  assert.deepEqual(playOrder(4), [0, 1, 2, 3]);
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const shuffled = playOrder(20, true, random);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), playOrder(20)); assert.notDeepEqual(shuffled, playOrder(20));
  assert.equal(stepTrack([2, 0, 1], 0, 1), 1); assert.equal(stepTrack([2, 0, 1], 1, 1), 2, 'wraps to the start');
  assert.equal(stepTrack([2, 0, 1], 2, -1), 1, 'previous wraps to the end'); assert.equal(stepTrack([2, 0, 1], -1, 1), 2, 'nothing playing: first in order');
  assert.equal(stepTrack([], 0, 1), -1);
});

test('local genre folders load without Supabase and encode song URLs', async () => {
  const load = createMusicLoader(async url => {
    assert.equal(url, '/music-manifest.json');
    return { ok: true, json: async () => ({ version: 1, folders: {
      'Classic Rock': [{ name: 'Queen - Bohemian Rhapsody.mp3' }],
      'Worship Song': [{ name: 'Cebuano Worship Song.mp3' }],
      '': [{ name: 'Loose Song.mp3' }],
    } }) };
  });
  const lists = await load();
  assert.deepEqual(lists.map(p => p.name), ['Classic Rock', 'Worship Song', 'Music']);
  assert.equal(lists[0].tracks[0].artist, 'Queen');
  assert.equal(lists[0].tracks[0].url, '/music/Classic%20Rock/Queen%20-%20Bohemian%20Rhapsody.mp3');
});

test('folder playlists take titles and order from the table, and skip empty folders', () => {
  const url = path => `https://x/${path}`;
  const lists = buildPlaylists({ Rock: [{ name: 'b.mp3' }, { name: 'a.mp3' }], Empty: [{ name: 'cover.jpg' }], '': [] }, [{ path: 'Rock/b.mp3', title: 'Opener', position: 0 }, { path: 'Rock/a.mp3', title: 'A', enabled: false }], url);
  assert.deepEqual(lists.map(l => [l.name, l.tracks.map(t => t.title)]), [['Rock', ['Opener']]]);
  assert.equal(lists[0].tracks[0].url, 'https://x/Rock/b.mp3');
});

test('music settings are remembered per browser and cleaned on read', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
  assert.deepEqual(readMusicPreference(storage), { volume: 0.6, shuffle: false, on: false, playlist: '' });
  writeMusicPreference({ volume: 0.3, shuffle: true, on: true, playlist: 'Classic Rock' }, storage);
  assert.deepEqual(readMusicPreference(storage), { volume: 0.3, shuffle: true, on: true, playlist: 'Classic Rock' });
  data.set('little-city-music-v1', JSON.stringify({ volume: 9, shuffle: 'yes' }));
  assert.deepEqual(readMusicPreference(storage), { volume: 1, shuffle: false, on: false, playlist: '' });
});

test('music.sql: players can list the music bucket and read the playlist, and cannot add, change or delete anything', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text); alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated; grant select on storage.objects to anon, authenticated;
    insert into storage.objects (bucket_id, name) values ('music', 'song.mp3'), ('avatars', 'private.png');
    grant usage on schema public to anon, authenticated;`);
  const sql = readFileSync(new URL('../../supabase/music.sql', import.meta.url), 'utf8');
  await db.exec(sql); await db.exec(sql);
  assert.equal((await db.query(`select public from storage.buckets where id = 'music'`)).rows[0].public, true);
  await db.exec(`insert into public.music_tracks (path, title, position) values ('one.mp3', 'One', 1), ('Two by Two.mp3', 'Two', 2); insert into public.music_tracks (path, title, enabled) values ('hidden.mp3', 'Hidden', false);`);
  await assert.rejects(db.exec(`insert into public.music_tracks (path, title) values ('../x.mp3', 'Bad')`), /check/, 'paths are checked');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      assert.deepEqual((await db.query('select path from public.music_tracks where enabled order by position')).rows.map(r => r.path), ['one.mp3', 'Two by Two.mp3']);
      assert.deepEqual((await db.query('select name from storage.objects')).rows.map(r => r.name), ['song.mp3'], 'players see the music bucket only');
      assert.deepEqual((await db.query('select public.music_manifest() as v')).rows[0].v.map(r => r.path), ['song.mp3'], 'manifest cannot expose another bucket or tracks with no file');
      for (const write of [`insert into public.music_tracks (path, title) values ('x.mp3', 'X')`, `update public.music_tracks set title = 'Hacked'`, 'delete from public.music_tracks']) await assert.rejects(db.exec(write), /permission denied/, `${role}: ${write}`);
    } finally { await db.exec('reset role'); }
  }
});

test('static manifest shares concurrent reads, caches successes and retries errors', async () => {
  let calls = 0;
  const load = createMusicLoader(async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ version: 1, folders: { Rock: [{ name: 'Song.mp3' }] } }) };
  });
  await assert.rejects(load(), /503/);
  const [a, b] = await Promise.all([load(), load()]);
  assert.equal(a, b); assert.equal(calls, 2);
  await load(); assert.equal(calls, 2);
  const broken = createMusicLoader(async () => ({ ok: true, json: async () => ({ folders: [] }) }));
  await assert.rejects(broken(), /invalid/);
});
