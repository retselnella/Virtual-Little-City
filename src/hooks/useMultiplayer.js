import { useEffect, useRef, useState } from 'react';
import { connectMultiplayer } from '../services/multiplayerClient.js';
import { HEARTBEAT_INTERVAL, SEND_INTERVAL, cityCounts, clearRoster, createRoster, encodeProfile, encodeState, pruneRoster, receiveProfile, receiveState, removePlayer } from '../models/worldTour/multiplayer.js';

// Shared-world presence for the game. The roster lives in a ref (the renderer reads it every frame); React state only
// carries what the HUD shows: connection status, the players here, and online counts per city.
export function useMultiplayer(session, character, city) {
  const roster = useRef(createRoster()), transport = useRef(null), last = useRef({ key: '', at: 0 });
  const [status, setStatus] = useState({ mode: 'offline', state: 'connecting' });
  const [peers, setPeers] = useState([]), [lobby, setLobby] = useState({}), [selfId, setSelfId] = useState(null);
  useEffect(() => {
    let alive = true, current = null;
    const handlers = {
      onState: (id, raw) => receiveState(roster.current, id, raw, performance.now()),
      onProfile: (id, raw) => receiveProfile(roster.current, id, raw, performance.now()),
      onLeave: id => removePlayer(roster.current, id),
      onLobby: presence => alive && setLobby(presence),
      onStatus: next => alive && setStatus(next),
    };
    connectMultiplayer(handlers).then(client => {
      if (!alive) { client.close(); return; }
      current = transport.current = client; setSelfId(client.selfId);
      client.setProfile(encodeProfile(character, session.current.city)); client.join(session.current.city);
    }).catch(error => { console.warn('Multiplayer unavailable', error); if (alive) setStatus({ mode: 'online', state: 'error' }); });
    // Send this player's state: every SEND_INTERVAL while it changes, at least every HEARTBEAT_INTERVAL.
    const sender = setInterval(() => {
      const client = transport.current; if (!client) return;
      const now = performance.now(), state = encodeState(session.current, now), key = JSON.stringify({ ...state, t: 0 });
      if (key !== last.current.key || now - last.current.at >= HEARTBEAT_INTERVAL) { client.send(state); last.current = { key, at: now }; }
    }, SEND_INTERVAL);
    const housekeeping = setInterval(() => {
      pruneRoster(roster.current, performance.now());
      if (alive) setPeers([...roster.current.players.values()].filter(p => p.profile && p.snapshots.length).map(p => { const at = p.snapshots[p.snapshots.length - 1]; return { id: p.id, name: p.profile.name, x: at.x, z: at.z }; }));
    }, 500);
    return () => { alive = false; clearInterval(sender); clearInterval(housekeeping); current?.close(); transport.current = null; };
  }, []);
  // Travelling switches to the new city's channel; nobody from the old city is drawn any more.
  useEffect(() => { clearRoster(roster.current); transport.current?.join(city); transport.current?.setProfile(encodeProfile(character, city)); }, [city]);
  useEffect(() => { transport.current?.setProfile(encodeProfile(character, city)); }, [character]);
  return { roster, status, peers, counts: cityCounts(lobby, selfId) };
}
