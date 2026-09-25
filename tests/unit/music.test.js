import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { audioType, buildPlaylist, buildPlaylists, cleanTracks, playOrder, stepTrack, storagePath, trackFromFile } from '../../src/models/worldTour/playlist.js';
import { loadPlaylists } from '../../src/services/musicService.js';
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

test('each folder in the bucket is a playlist; URLs are built from the project address', async () => {
  const calls = [];
  // Storage lists folders as entries without an id.
  const tree = { '': [{ name: 'Classic Rock', id: null }, { name: 'Worship Song', id: null }, { name: '.emptyFolderPlaceholder', id: 'p' }, { name: 'Loose Song.mp3', id: 'a' }],
    'Classic Rock': [{ name: 'Queen - Bohemian Rhapsody (Official Video).mp3', id: 'b' }, { name: 'ABBA - Dancing Queen.mp3', id: 'c' }], 'Worship Song': [{ name: 'Cebuano Worship Song.mp3', id: 'd' }] };
  const client = {
    storage: { from(bucket) { calls.push(['bucket', bucket]); return { list: async folder => { calls.push(['list', folder]); return { data: tree[folder], error: null }; } }; } },
    from(name) { calls.push(['from', name]); return { select: async () => ({ data: null, error: { message: 'relation "music_tracks" does not exist' } }) }; },
  };
  const playlists = await loadPlaylists({ configured: true, client });
  assert.deepEqual(playlists.map(p => [p.name, p.tracks.map(t => t.title)]), [['Classic Rock', ['Dancing Queen', 'Bohemian Rhapsody (Official Video)']], ['Worship Song', ['Cebuano Worship Song']], ['Music', ['Loose Song']]]);
  assert.equal(playlists[0].tracks[1].artist, 'Queen', 'no table needed: titles and artists come from file names');
  assert.match(playlists[0].tracks[1].url, /\/storage\/v1\/object\/public\/music\/Classic%20Rock\/Queen%20-%20Bohemian%20Rhapsody%20\(Official%20Video\)\.mp3$/, 'names are URL-encoded under the project address');
  await assert.rejects(loadPlaylists({ configured: true, client: { ...client, storage: { from: () => ({ list: async () => ({ data: null, error: new Error('Bucket not found') }) }) } } }), /Bucket not found/);
  assert.equal(await loadPlaylists({ configured: false }), null, 'no Supabase: no playlists and no requests');
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
      for (const write of [`insert into public.music_tracks (path, title) values ('x.mp3', 'X')`, `update public.music_tracks set title = 'Hacked'`, 'delete from public.music_tracks']) await assert.rejects(db.exec(write), /permission denied/, `${role}: ${write}`);
    } finally { await db.exec('reset role'); }
  }
});
