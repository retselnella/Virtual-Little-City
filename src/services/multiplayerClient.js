import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { LOBBY_CHANNEL, cityChannel } from '../models/worldTour/multiplayer.js';

// Network transport for shared-world presence. Two interchangeable transports expose the same interface:
//   { mode, selfId, join(city), send(state), setProfile(profile), close() }
// and report through handlers: onState(id, raw), onProfile(id, raw), onLeave(id), onLobby(presence), onStatus(status).
// Payloads are passed on raw: callers validate them with models/worldTour/multiplayer.js.
//  - 'online': Supabase Realtime (anonymous sign-in, private channels, presence per city plus a lobby).
//  - 'local': a BroadcastChannel between tabs of this browser, used when Supabase is not configured.

export async function connectMultiplayer(handlers, { config = ONLINE, configured = ONLINE_CONFIGURED, createClient } = {}) {
  if (!configured) return localTransport(handlers);
  const create = createClient || (await import('@supabase/supabase-js')).createClient;
  return supabaseTransport(handlers, config, create);
}

async function supabaseTransport(handlers, config, createClient) {
  const client = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'little-city-auth' } });
  handlers.onStatus?.({ mode: 'online', state: 'connecting' });
  // Anonymous sign-in gives each browser a stable, server-issued identity without accounts or passwords.
  let session = (await client.auth.getSession()).data?.session;
  if (!session) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) { handlers.onStatus?.({ mode: 'online', state: 'error', reason: 'sign-in' }); throw error; }
    session = data.session;
  }
  const selfId = session.user.id;
  await client.realtime.setAuth();
  let profile = null, city = null, cityRoom = null, closed = false;
  const status = state => handlers.onStatus?.({ mode: 'online', state });
  const presenceIds = channel => new Set(Object.keys(channel.presenceState()));
  const lobby = client.channel(LOBBY_CHANNEL, { config: { private: true, presence: { key: selfId, enabled: true } } })
    .on('presence', { event: 'sync' }, () => handlers.onLobby?.(Object.fromEntries(Object.entries(lobby.presenceState()).map(([id, metas]) => [id, metas[0]]))))
    .subscribe(state => { if (state === 'SUBSCRIBED' && profile) lobby.track(profile); if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') status('error'); });
  function join(next) {
    if (closed || next === city) return;
    if (cityRoom) client.removeChannel(cityRoom);
    city = next; let ready = false;
    const room = client.channel(cityChannel(city), { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: selfId, enabled: true } } });
    room.on('broadcast', { event: 'state' }, ({ payload }) => {
      // Only accept positions from players currently present in this city's channel.
      if (payload && payload.id !== selfId && presenceIds(room).has(payload.id)) handlers.onState?.(payload.id, payload);
    })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => { if (key !== selfId) handlers.onProfile?.(key, newPresences?.[0]); })
      .on('presence', { event: 'leave' }, ({ key }) => { if (key !== selfId) handlers.onLeave?.(key); })
      .subscribe(state => {
        if (room !== cityRoom) return;
        if (state === 'SUBSCRIBED') { ready = true; status('online'); if (profile) room.track(profile); }
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') status('error');
        else if (state === 'CLOSED') ready = false;
      });
    cityRoom = room; cityRoom.isReady = () => ready;
  }
  return {
    mode: 'online', selfId, join,
    send(state) { if (cityRoom?.isReady()) cityRoom.send({ type: 'broadcast', event: 'state', payload: { ...state, id: selfId } }); },
    setProfile(next) { profile = next; lobby.track(next); if (cityRoom?.isReady()) cityRoom.track(next); },
    close() { closed = true; client.removeAllChannels(); client.realtime.disconnect?.(); },
  };
}

// Same-browser fallback: tabs announce themselves, answer each other's hellos and share states over BroadcastChannel.
function localTransport(handlers) {
  const selfId = 'tab-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '');
  const bus = new BroadcastChannel('little-city-local-multiplayer');
  const lobby = new Map();
  let profile = null, city = null, closed = false;
  const post = message => { if (!closed) bus.postMessage({ ...message, from: selfId }); };
  const publishLobby = () => handlers.onLobby?.(Object.fromEntries(lobby));
  bus.onmessage = ({ data }) => {
    if (!data || data.from === selfId || typeof data.from !== 'string') return;
    const id = data.from;
    if (data.kind === 'profile' || data.kind === 'hello') {
      lobby.set(id, data.profile); publishLobby();
      if (data.profile?.city === city) handlers.onProfile?.(id, data.profile);
      else handlers.onLeave?.(id);
      if (data.kind === 'hello' && profile) post({ kind: 'profile', profile });
    } else if (data.kind === 'state' && data.city === city && lobby.get(id)?.city === city) handlers.onState?.(id, data.state);
    else if (data.kind === 'bye') { lobby.delete(id); publishLobby(); handlers.onLeave?.(id); }
  };
  const bye = () => post({ kind: 'bye' });
  globalThis.addEventListener?.('pagehide', bye);
  handlers.onStatus?.({ mode: 'local', state: 'online' });
  return {
    mode: 'local', selfId,
    join(next) { city = next; if (profile) post({ kind: 'hello', profile }); },
    send(state) { if (city) post({ kind: 'state', city, state }); },
    setProfile(next) { const first = !profile; profile = next; post({ kind: first ? 'hello' : 'profile', profile }); },
    close() { bye(); closed = true; globalThis.removeEventListener?.('pagehide', bye); bus.close(); },
  };
}
