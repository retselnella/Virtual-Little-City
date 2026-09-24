import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES, createSession, stepWorld } from '../../src/models/worldTour/worldAdventure.js';
import { LOBBY_CHANNEL, MAX_REMOTE, RENDER_DELAY, STALE_AFTER, cityChannel, cityCounts, cleanProfile, cleanState, createRoster, encodeProfile, encodeState, pruneRoster, receiveProfile, receiveState, samplePlayer, visiblePlayers } from '../../src/models/worldTour/multiplayer.js';
import { connectMultiplayer } from '../../src/services/multiplayerClient.js';
import { contentSecurityPolicy, realtimeOrigins } from '../../src/config/security.js';

const look = { name: 'Ada', skin: '#6d452e', hair: '#161616', hairStyle: 'bun', shirt: '#e0b04b', pants: '#2f3338', shoes: '#e8e2d6', build: 'tall' };

test('states round-trip from a session and hostile values are clamped or rejected', () => {
  const s = createSession(CITIES[0]); stepWorld(s, { forward: true }, 0.05);
  const state = cleanState(encodeState(s, 1000));
  assert.ok(Math.abs(state.x - s.player.x) < 0.01 && Math.abs(state.z - s.player.z) < 0.01 && state.d === false);
  s.driving = true; const driving = cleanState(encodeState(s, 1100)); assert.equal(driving.d, true); assert.equal(driving.q.length, 4);
  for (const bad of [null, 'x', { v: 2 }, { v: 1, x: NaN, z: 0, y: 0, h: 0, s: 0 }, { v: 1, x: '1', z: 0, y: 0, h: 0, s: 0 }]) assert.equal(cleanState(bad), null);
  const wild = cleanState({ v: 1, x: 1e9, z: -1e9, y: -5, h: 99, s: 1e6, d: 1, q: [9, 9, 9, 9] });
  assert.equal(wild.x, 440); assert.equal(wild.z, -440); assert.equal(wild.y, 0); assert.equal(wild.s, 80); assert.ok(Math.abs(wild.h) <= Math.PI);
  assert.ok(Math.abs(Math.hypot(...wild.q) - 1) < 1e-9);
});

test('profiles keep only valid looks and plain-text names', () => {
  const profile = cleanProfile({ ...encodeProfile({ ...look, name: '<b>Ada</b>\u0000' }, 'tokyo'), extra: 'x' });
  assert.equal(profile.name, '<b>Ada</b>'); assert.equal(profile.city, 'tokyo'); assert.equal(profile.look.hairStyle, 'bun'); assert.ok(profile.scale > 1);
  const hostile = cleanProfile({ v: 1, name: 42, look: { skin: 'red; background:url(x)' }, city: 'atlantis' });
  assert.equal(hostile.name, 'Traveller'); assert.equal(hostile.city, null); assert.equal(hostile.look.skin, '#d6a07d');
  assert.equal(cleanProfile({ v: 9 }), null);
  assert.deepEqual(cityCounts({ me: encodeProfile(look, 'miami'), a: encodeProfile(look, 'miami'), b: encodeProfile(look, 'rio'), c: { v: 1, city: 'nowhere' } }, 'me'), { miami: 1, rio: 1 });
});

test('the roster interpolates smoothly, snaps across gaps, rate-limits floods and forgets silent players', () => {
  const roster = createRoster(), base = { v: 1, y: 0, h: 0, s: 5 };
  assert.equal(receiveState(roster, 'bad id!', { ...base, x: 0, z: 0 }, 0), false);
  receiveProfile(roster, 'p1', encodeProfile(look, 'miami'), 0);
  receiveState(roster, 'p1', { ...base, x: 0, z: 0 }, 1000); receiveState(roster, 'p1', { ...base, x: 10, z: 0 }, 1100);
  const player = roster.players.get('p1');
  assert.equal(samplePlayer(player, 1050 + RENDER_DELAY).x, 5, 'halfway between snapshots');
  assert.equal(samplePlayer(player, 5000).x, 10, 'holds the newest pose, never extrapolates');
  receiveState(roster, 'p1', { ...base, x: 100, z: 0 }, 3000);
  assert.equal(samplePlayer(player, 2500 + RENDER_DELAY).x, 100, 'a long gap snaps instead of sliding');
  let accepted = 0; for (let i = 0; i < 60; i++) if (receiveState(roster, 'p1', { ...base, x: i, z: 0 }, 5000 + i)) accepted++;
  assert.ok(accepted <= 25, 'floods are capped per second: ' + accepted);
  for (let i = 0; i < 40; i++) { receiveProfile(roster, 'q' + i, encodeProfile(look, 'miami'), 6000); receiveState(roster, 'q' + i, { ...base, x: i, z: 0 }, 6000); }
  assert.equal(visiblePlayers(roster, { x: 0, z: 0 }, 6200).length, MAX_REMOTE, 'only the nearest players are drawn');
  pruneRoster(roster, 6000 + STALE_AFTER + 1); assert.equal(roster.players.size, 0);
});

test('the Supabase transport signs in anonymously and uses private, presence-keyed channels', async () => {
  const log = { channels: [], sent: [], tracked: [], signIns: 0, auth: 0 };
  function channel(topic, options) {
    const listeners = [];
    const ch = { topic, options, presence: {}, on(type, filter, callback) { listeners.push({ type, filter, callback }); return ch; },
      subscribe(callback) { ch.status = callback; setTimeout(() => callback('SUBSCRIBED')); return ch; },
      presenceState: () => ch.presence, track: payload => log.tracked.push({ topic, payload }), send: message => log.sent.push({ topic, message }),
      emit(type, event, payload) { for (const l of listeners) if (l.type === type && l.filter.event === event) l.callback(payload); } };
    log.channels.push(ch); return ch;
  }
  const client = { auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously: async () => { log.signIns++; return { data: { session: { user: { id: 'user-1' } } }, error: null }; } },
    realtime: { setAuth: async () => { log.auth++; }, disconnect() { log.disconnected = true; } }, channel, removeChannel() {}, removeAllChannels() { log.removed = true; } };
  const events = { states: [], profiles: [], statuses: [] };
  const transport = await connectMultiplayer({ onState: (id, raw) => events.states.push([id, raw]), onProfile: (id, raw) => events.profiles.push([id, raw]), onStatus: s => events.statuses.push(s.state) },
    { configured: true, config: { url: 'https://example.supabase.co', key: 'anon' }, createClient: (url, key) => { assert.equal(url, 'https://example.supabase.co'); return client; } });
  assert.equal(transport.mode, 'online'); assert.equal(transport.selfId, 'user-1'); assert.equal(log.signIns, 1); assert.equal(log.auth, 1);
  transport.setProfile(encodeProfile(look, 'miami')); transport.join('miami');
  await new Promise(resolve => setTimeout(resolve, 5));
  const [lobby, room] = log.channels;
  assert.equal(lobby.topic, LOBBY_CHANNEL); assert.equal(room.topic, cityChannel('miami'));
  for (const ch of [lobby, room]) { assert.equal(ch.options.config.private, true); assert.equal(ch.options.config.presence.key, 'user-1'); }
  assert.equal(room.options.config.broadcast.self, false);
  transport.send({ v: 1, x: 1 }); assert.deepEqual(log.sent.at(-1).message.payload, { v: 1, x: 1, id: 'user-1' });
  room.presence = { 'user-2': [{}] };
  room.emit('broadcast', 'state', { payload: { id: 'user-2', v: 1 } }); room.emit('broadcast', 'state', { payload: { id: 'ghost', v: 1 } });
  assert.deepEqual(events.states.map(([id]) => id), ['user-2'], 'states are accepted only from players present in the channel');
  room.emit('presence', 'join', { key: 'user-2', newPresences: [{ v: 1, name: 'Bo' }] });
  assert.deepEqual(events.profiles, [['user-2', { v: 1, name: 'Bo' }]]);
  assert.ok(events.statuses.includes('online'));
  transport.close(); assert.ok(log.removed && log.disconnected);
});

test('without Supabase configured, tabs of one browser share the world over BroadcastChannel', async () => {
  const seen = { a: [], b: [] }, handlers = key => ({ onState: (id, raw) => seen[key].push(['state', id, raw.x]), onProfile: (id, raw) => seen[key].push(['profile', id, raw.city]), onLeave: id => seen[key].push(['leave', id]) });
  const a = await connectMultiplayer(handlers('a'), { configured: false }), b = await connectMultiplayer(handlers('b'), { configured: false });
  assert.equal(a.mode, 'local');
  a.setProfile(encodeProfile(look, 'miami')); a.join('miami'); b.setProfile(encodeProfile(look, 'miami')); b.join('miami');
  await new Promise(resolve => setTimeout(resolve, 30));
  a.send({ v: 1, x: 7 });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(seen.b.some(([kind, id, x]) => kind === 'state' && id === a.selfId && x === 7), 'b sees a move');
  assert.ok(seen.a.some(([kind, id]) => kind === 'profile' && id === b.selfId), 'a learns who b is');
  b.setProfile(encodeProfile(look, 'tokyo')); b.join('tokyo');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(seen.a.some(([kind, id]) => kind === 'leave' && id === b.selfId), 'b left miami for tokyo');
  a.close(); b.close();
});

test('the build policy names only the configured Supabase project; the SQL policy allows only game channels', () => {
  assert.deepEqual(realtimeOrigins('https://abc.supabase.co'), ['https://abc.supabase.co', 'wss://abc.supabase.co']);
  assert.deepEqual(realtimeOrigins('http://abc.supabase.co'), []); assert.deepEqual(realtimeOrigins(''), []);
  assert.match(contentSecurityPolicy([]), /connect-src 'self';/);
  assert.match(contentSecurityPolicy(realtimeOrigins('https://abc.supabase.co')), /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co;/);
  const sql = readFileSync(new URL('../../supabase/realtime-policies.sql', import.meta.url), 'utf8');
  const topic = new RegExp(sql.match(/realtime\.topic\(\) ~ '([^']+)'/)[1]);
  for (const city of CITIES) assert.ok(topic.test(cityChannel(city.id)), city.id);
  assert.ok(topic.test(LOBBY_CHANNEL)); assert.ok(!topic.test('little-city:city:atlantis')); assert.ok(!topic.test('other-app:room'));
  assert.equal((sql.match(/to authenticated/g) || []).length, 2); assert.doesNotMatch(sql, /to anon\b/);
});

test('the build accepts Vercel-style names and refuses to publish a secret key', async () => {
  const { resolveSupabaseEnv, isSecretKey } = await import('../../src/config/supabaseEnv.js');
  assert.deepEqual(resolveSupabaseEnv({ SUPABASE_URL: ' https://abc.supabase.co ', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }), { url: 'https://abc.supabase.co', key: 'sb_publishable_x', urlName: 'SUPABASE_URL', keyName: 'SUPABASE_PUBLISHABLE_KEY' });
  assert.equal(resolveSupabaseEnv({ VITE_SUPABASE_URL: 'https://v.supabase.co', SUPABASE_URL: 'https://other.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }).url, 'https://v.supabase.co');
  assert.deepEqual(resolveSupabaseEnv({}), { url: '', key: '', urlName: null, keyName: null });
  const jwt = role => ['e30', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'sig'].join('.');
  assert.equal(isSecretKey(jwt('anon')), false); assert.equal(isSecretKey(jwt('service_role')), true); assert.equal(isSecretKey('sb_secret_abc'), true);
  assert.throws(() => resolveSupabaseEnv({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }), /secret\/service-role key/);
  assert.throws(() => resolveSupabaseEnv({ SUPABASE_ANON_KEY: jwt('service_role') }), /SUPABASE_ANON_KEY/);
});
