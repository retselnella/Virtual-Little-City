import { useEffect, useRef, useState } from 'react';
import { connectMultiplayer } from '../services/multiplayerClient.js';
import { HEARTBEAT_INTERVAL, SEND_INTERVAL, cityCounts, clearRoster, createRoster, encodeProfile, encodeState, hasProfile, pruneRoster, receiveProfile, receiveState, removePlayer } from '../models/worldTour/multiplayer.js';

// Shared-world presence for the game. The roster lives in a ref (the renderer reads it every frame); React state only
// carries what the HUD shows: connection status, the players here, and online counts per city.
export function useMultiplayer(session, character, city) {
  const roster = useRef(createRoster()), transport = useRef(null), last = useRef({ key: '', at: 0 }), outbox = useRef({ session: null, cursor: 0, seq: 0 });
  const [status, setStatus] = useState({ mode: 'offline', state: 'connecting' });
  const [peers, setPeers] = useState([]), [lobby, setLobby] = useState({}), [selfId, setSelfId] = useState(null);
  useEffect(() => {
    let alive = true, current = null;
    const handlers = {
      // A player forgotten while silent (a background tab, a dropped connection) is recognised again from their presence.
      onState: (id, raw) => {
        const now = performance.now();
        if (receiveState(roster.current, id, raw, now) && !hasProfile(roster.current, id)) receiveProfile(roster.current, id, transport.current?.profileOf(id), now);
      },
      onProfile: (id, raw) => receiveProfile(roster.current, id, raw, performance.now()),
      onLeave: id => removePlayer(roster.current, id),
      onLobby: presence => alive && setLobby(presence),
      onStatus: next => alive && setStatus(next),
    };
    // Signing in can fail for a moment (no network yet, the server busy): keep trying, a little less often each time.
    let wait = 2000, retry = null;
    const connect = () => connectMultiplayer(handlers).then(client => {
      if (!alive) { client.close(); return; }
      current = transport.current = client; setSelfId(client.selfId);
      client.setProfile(encodeProfile(character, session.current.city)); client.join(session.current.city);
    }).catch(error => {
      console.warn('Multiplayer unavailable, retrying', error);
      if (!alive) return;
      setStatus({ mode: 'online', state: 'reconnecting', reason: `sign-in: ${error?.message || error}` }); retry = setTimeout(connect, wait); wait = Math.min(30000, wait * 2);
    });
    connect();
    // Send this player's state: every SEND_INTERVAL while it changes, at least every HEARTBEAT_INTERVAL. Attacks made since
    // the last message go with it, renumbered so the sequence keeps rising when travel or recovery starts a new session.
    const sender = setInterval(() => {
      const client = transport.current; if (!client) return;
      const s = session.current, out = outbox.current;
      if (out.session !== s) { out.session = s; out.cursor = 0; }
      const fresh = s.actions.filter(a => a.id > out.cursor); if (fresh.length) out.cursor = fresh.at(-1).id;
      const now = performance.now(), state = encodeState(s, now, fresh.map(a => ({ ...a, id: ++out.seq }))), key = JSON.stringify({ ...state, t: 0 });
      if (key !== last.current.key || now - last.current.at >= HEARTBEAT_INTERVAL) { client.send(state); last.current = { key, at: now }; }
    }, SEND_INTERVAL);
    const housekeeping = setInterval(() => {
      pruneRoster(roster.current, performance.now());
      if (alive) setPeers([...roster.current.players.values()].filter(p => p.profile && p.snapshots.length).map(p => { const at = p.snapshots[p.snapshots.length - 1]; return { id: p.id, name: p.profile.name, x: at.x, z: at.z }; }));
    }, 500);
    return () => { alive = false; clearTimeout(retry); clearInterval(sender); clearInterval(housekeeping); current?.close(); transport.current = null; };
  }, []);
  // Travelling switches to the new city's channel; nobody from the old city is drawn any more.
  useEffect(() => { clearRoster(roster.current); transport.current?.join(city); transport.current?.setProfile(encodeProfile(character, city)); }, [city]);
  useEffect(() => { transport.current?.setProfile(encodeProfile(character, city)); }, [character]);
  return { roster, status, peers, counts: cityCounts(lobby, selfId) };
}
