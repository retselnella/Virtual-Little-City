import { ONLINE, ONLINE_CONFIGURED } from '../config/online.js';
import { LOBBY_CHANNEL, cityChannel } from '../models/worldTour/multiplayer.js';
import { AUTH_OPTIONS, guestClient, signInGuest } from './guestSession.js';

// Network transport for shared-world presence. Two interchangeable transports expose the same interface:
//   { mode, selfId, join(city), send(state), setProfile(profile), profileOf(id), close() }
// and report through handlers: onState(id, raw), onProfile(id, raw), onLeave(id), onLobby(presence), onStatus(status).
// Payloads are passed on raw: callers validate them with models/worldTour/multiplayer.js. profileOf(id) returns the
// last profile a player announced in the current city, so a player who went quiet can be recognised again.
//  - 'online': Supabase Realtime (anonymous sign-in, private channels, presence per city plus a lobby). It reconnects by
//    itself: status goes 'connecting' → 'online', and 'reconnecting' while a lost channel is being rebuilt.
//  - 'local': a BroadcastChannel between tabs of this browser, used when Supabase is not configured.

export async function connectMultiplayer(handlers, { config = ONLINE, configured = ONLINE_CONFIGURED, createClient } = {}) {
  if (!configured) return localTransport(handlers);
  return supabaseTransport(handlers, config, createClient);
}

async function supabaseTransport(handlers, config, createClient) {
  handlers.onStatus?.({ mode: 'online', state: 'connecting' });
  // Anonymous sign-in gives each browser a stable, server-issued identity without accounts or passwords; the session is
  // saved in this browser and shared with the world boss (guestSession.js). Tests inject their own client.
  let client, session;
  try {
    if (createClient) { client = createClient(config.url, config.key, AUTH_OPTIONS); session = await signInGuest(client); }
    else ({ client, session } = await guestClient(config));
  } catch (error) { handlers.onStatus?.({ mode: 'online', state: 'reconnecting', reason: `sign-in: ${error?.message || error}` }); throw error; }
  // Tabs of one browser share the anonymous session, so each tab gets its own presence key or they would hide each other.
  const selfId = session.user.id + '-' + tabNonce();
  await client.realtime.setAuth();
  let profile = null, city = null, cityRoom = null, lobby = null, closed = false, roomReady = false;
  const status = (state, reason) => handlers.onStatus?.({ mode: 'online', state, ...(reason ? { reason } : {}) });
  // Why a channel failed, as Supabase reports it (shown on the connection chip so the site owner can fix the setup).
  const why = (state, error) => { const text = error?.message || String(error || '') || (state === 'TIMED_OUT' ? 'timed out' : 'channel error'); console.warn(`Shared world: ${state}`, error || ''); return text; };
  const presenceIds = channel => new Set(Object.keys(channel.presenceState()));
  // Staying online: a channel that errors or times out (a dropped network, a laptop waking up, a sign-in token that
  // expired while the tab slept) is rebuilt after a short, growing pause, with the session refreshed first. Coming
  // back to the tab or the network retries at once.
  const retries = { lobby: { timer: null, delay: RETRY_FIRST }, room: { timer: null, delay: RETRY_FIRST } };
  function retry(which, build) {
    if (closed || retries[which].timer) return;
    const r = retries[which];
    r.timer = setTimeout(async () => {
      r.timer = null; if (closed) return;
      try { await client.auth.getSession?.(); await client.realtime.setAuth(); } catch { /* the rebuilt channel reports any problem */ }
      build();
    }, r.delay);
    r.delay = Math.min(RETRY_MAX, r.delay * 2);
  }
  const healthy = which => { clearTimeout(retries[which].timer); retries[which] = { timer: null, delay: RETRY_FIRST }; };
  function buildLobby() {
    if (lobby) client.removeChannel(lobby);
    const channel = lobby = client.channel(LOBBY_CHANNEL, { config: { private: true, presence: { key: selfId, enabled: true } } })
      .on('presence', { event: 'sync' }, () => handlers.onLobby?.(Object.fromEntries(Object.entries(channel.presenceState()).map(([id, metas]) => [id, metas[0]]))))
      .subscribe((state, error) => {
        if (channel !== lobby) return;
        if (state === 'SUBSCRIBED') { healthy('lobby'); if (profile) channel.track(profile); }
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') { why(state, error); retry('lobby', buildLobby); } // only the city counts are missing meanwhile
      });
  }
  function buildRoom() {
    if (cityRoom) client.removeChannel(cityRoom);
    roomReady = false;
    const room = cityRoom = client.channel(cityChannel(city), { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: selfId, enabled: true } } });
    room.on('broadcast', { event: 'state' }, ({ payload }) => {
      // Only accept positions from players currently present in this city's channel.
      if (payload && payload.id !== selfId && presenceIds(room).has(payload.id)) handlers.onState?.(payload.id, payload);
    })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => { if (key !== selfId) handlers.onProfile?.(key, newPresences?.[0]); })
      // Re-tracking a changed profile arrives as a join plus a leave of the old entry: only an empty key has left.
      .on('presence', { event: 'leave' }, ({ key, currentPresences }) => { if (key !== selfId && !currentPresences?.length) handlers.onLeave?.(key); })
      .subscribe((state, error) => {
        if (room !== cityRoom) return;
        if (state === 'SUBSCRIBED') { roomReady = true; healthy('room'); status('online'); if (profile) room.track(profile); }
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') { roomReady = false; status('reconnecting', why(state, error)); retry('room', buildRoom); }
        else if (state === 'CLOSED') roomReady = false;
      });
  }
  function wake() {
    if (closed || globalThis.document?.hidden) return;
    if (city && !roomReady) { healthy('room'); retry('room', buildRoom); }
  }
  globalThis.addEventListener?.('online', wake); globalThis.document?.addEventListener?.('visibilitychange', wake);
  buildLobby();
  return {
    mode: 'online', selfId,
    join(next) { if (closed || next === city) return; city = next; healthy('room'); buildRoom(); },
    send(state) { if (roomReady) cityRoom.send({ type: 'broadcast', event: 'state', payload: { ...state, id: selfId } }); },
    setProfile(next) { profile = next; lobby?.track(next); if (roomReady) cityRoom.track(next); },
    profileOf(id) { return cityRoom?.presenceState()[id]?.at(-1) || null; },
    close() {
      closed = true; clearTimeout(retries.lobby.timer); clearTimeout(retries.room.timer);
      globalThis.removeEventListener?.('online', wake); globalThis.document?.removeEventListener?.('visibilitychange', wake);
      client.removeAllChannels(); client.realtime.disconnect?.();
    },
  };
}
export const RETRY_FIRST = 1000, RETRY_MAX = 15000;

// Same-browser fallback: tabs announce themselves, answer each other's hellos and share states over BroadcastChannel.
const tabNonce = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
function localTransport(handlers) {
  const selfId = 'tab-' + tabNonce();
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
    profileOf(id) { const known = lobby.get(id); return known?.city === city ? known : null; },
    close() { bye(); closed = true; globalThis.removeEventListener?.('pagehide', bye); bus.close(); },
  };
}
