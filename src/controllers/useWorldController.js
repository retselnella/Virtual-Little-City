import { useEffect, useRef, useState } from 'react';
import { CITIES, CONTRACTS, actor, attack, cancelCourse, createSession, guidePoint, interact, nearAirport, notify, promptFor, recover, setAppearance, setCourse, setWaypoint, startContract, startReload, toggleVehicle } from '../models/worldTour/worldAdventure.js';
import { mountAdventure } from '../scenes/worldTour/adventureScene.js';
import { disposePhysics } from '../models/worldTour/physicsEngine.js';

import { readWorldSave, serializeWorldSave, writeWorldSave } from '../services/worldStorage.js';
import { readBloodPreference, writeBloodPreference } from '../services/preferences.js';
import { useWorldInput } from '../hooks/useWorldInput.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';
import { policeStatus, snapshot } from '../models/worldTour/presentation.js';
import { displayName } from '../models/worldTour/characterProfile.js';
import { parseEnvironmentOverride, weatherLabel, worldConditions } from '../models/worldTour/worldClock.js';
import { islandFor } from '../models/worldTour/worldIsland.js';

function sessionFor(city, save, blood = true, appearance = null, arrival = null) { return { ...createSession(city, save, appearance, arrival), cityInfo: city, blood }; }

// `character` is the creator's appearance; `suspended` pauses play while the creator is open over the game.
export function useWorldController(character = null, suspended = false) {
  const [initial] = useState(readWorldSave), [blood, setBlood] = useState(readBloodPreference), session = useRef(null);
  if (!session.current) session.current = sessionFor(CITIES.find(c => c.id === initial.city), initial, blood, character);
  const [hud, setHud] = useState(() => snapshot(session.current)), [panel, setPanel] = useState(null), [ready, setReady] = useState(false), [error, setError] = useState(false), [storage, setStorage] = useState(true);
  const host = useRef(null), paused = useRef(false), lastSave = useRef('');
  const { input, clear, touchControl } = useWorldInput(paused, action, setPanel);
  paused.current = !!panel || error || suspended;
  useEffect(() => { if (suspended) clear(); }, [suspended]);
  useEffect(() => { setAppearance(session.current, character); setHud(snapshot(session.current)); }, [character]);
  const online = useMultiplayer(session, character, hud.city);
  // One clock and weather for everyone: Philippine time and the shared world weather (?clock=HH:MM&weather=rain previews).
  const override = useRef(null); if (!override.current) override.current = parseEnvironmentOverride(location.search, Date.now());
  const environment = useRef(() => worldConditions(Date.now() + override.current.offset, override.current.weather));
  const [sky, setSky] = useState(() => environment.current()), lastWeather = useRef(sky.kind);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = environment.current(); setSky(next);
      if (next.kind === lastWeather.current) return;
      const was = lastWeather.current; lastWeather.current = next.kind;
      const news = { rain: 'Rain is falling across the whole world.', storm: 'A thunderstorm is rolling over every city.', cloudy: was === 'rain' || was === 'storm' ? 'The rain is easing off everywhere.' : 'Clouds are gathering over the world.', clear: 'The skies are clearing all over the world.' }[next.kind];
      if (!paused.current) { notify(session.current, news); setHud(snapshot(session.current)); }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const city = hud.cityInfo, current = CONTRACTS.find(m => m.id === hud.mission?.id), p = actor(hud), point = guidePoint(hud);
  function open(value) { clear(); setPanel(value); }
  function save(s) {
    const value = serializeWorldSave(s);
    if (lastSave.current === value) return;
    if (writeWorldSave(value)) { lastSave.current = value; setStorage(true); } else setStorage(false);
  }
  useEffect(() => {
    document.title = 'Little City: World Tour';
    let dispose;
    try { dispose = mountAdventure(host.current, session, input, paused, s => { if (s.arrival) { travel(s.arrival, 'boat'); return; } setHud(snapshot(s)); save(s); setReady(true); }, () => setError(true), online.roster, environment); }
    catch (e) { console.error('World scene could not start', e); setError(true); }
    // The Rapier world lives in WebAssembly memory, so it is freed explicitly (it is rebuilt if the scene remounts).
    return () => { dispose?.(); disposePhysics(session.current); };
  }, []);
  function action(key) {
    if (paused.current || !ready) return;
    const s = session.current;
    if (key === 'vehicle') toggleVehicle(s);
    if (key === 'attack') attack(s);
    if (key === 'interact') interact(s);
    if (key === 'weapon') { s.weapon = s.weapon === 'pistol' ? 'fists' : 'pistol'; notify(s, s.weapon === 'pistol' ? 'Pistol equipped. J to fire.' : 'Fists equipped. Get close and press J.'); }
    if (key === 'reload') startReload(s);
    if (key === 'map') { open('world'); return; }
    setHud(snapshot(s));
  }
  function toggleBlood() {
    const next = !blood; setBlood(next); session.current.blood = next;
    writeBloodPreference(next);
  }
  // Travel between islands: by boat when a sea crossing ends, or by air from the airport terminal.
  function travel(id, mode = 'flight') {
    const old = session.current;
    if (old.heat > 0 || old.mission || old.down || !CITIES.some(city => city.id === id)) return;
    if (mode === 'flight' && !nearAirport(old)) { notify(old, 'Flights leave from the airport terminal on the west side of the city.'); setHud(snapshot(old)); return; }
    session.current = sessionFor(CITIES.find(c => c.id === id), old, old.blood, old.appearance, mode); disposePhysics(old); save(session.current); setHud(snapshot(session.current)); open(null);
  }
  const [dispatchTitle, dispatchHint] = policeStatus(hud);
  const task = !current ? 'The world is yours.' : hud.mission.stage === 0 ? current.id === 'crew' ? `Eliminate the crew · ${hud.enemies.filter(e => e.kind === 'gang' && e.health <= 0).length}/4` : 'Collect the marked package' : hud.heat > 0 ? 'Lose the police' : 'Reach the drop-off';
  function acceptContract(id) { startContract(session.current, id); setHud(snapshot(session.current)); open(null); }
  function abandonContract() { session.current.mission = null; session.current.enemies = session.current.enemies.filter(e => e.kind !== 'gang'); notify(session.current, 'Contract abandoned. You can accept it again.'); setHud(snapshot(session.current)); open(null); }
  function recoverToSafehouse() { recover(session.current); setHud(snapshot(session.current)); open(null); }
  function sail(id) { if (setCourse(session.current, id)) { setHud(snapshot(session.current)); open(null); } }
  function stopSailing() { cancelCourse(session.current); setHud(snapshot(session.current)); }
  function guide(point) { setWaypoint(session.current, point); setHud(snapshot(session.current)); open(null); }
  const island = islandFor(city.id), playerName = displayName(character), region = island.regionAt(p.x, p.z, city.district), weather = weatherLabel(sky);
  return { online, playerName, sky, weather, region, island, prompt: promptFor(hud), canFly: nearAirport(hud), sail, stopSailing, guide, hud, panel, ready, error, storage, host, city, current, p, point, open, action, toggleBlood, touchControl, travel, dispatchTitle, dispatchHint, task, blood, acceptContract, abandonContract, recoverToSafehouse };
}
