import { ONLINE_CONFIGURED } from '../config/online.js';
import { STORAGE_KEYS } from '../config/storageKeys.js';
import { claimRewards, createBossStore, eventState, reportDeath, submitHits, weeklyState } from '../models/worldTour/bossRules.js';
import { kaijuPose } from '../models/worldTour/worldBoss.js';
import { guestClient, localGuestId } from './guestSession.js';
import { readJson, writeJson } from './storage.js';

// The world boss server. Online, every call is a Postgres function on Supabase (supabase/world-boss.sql) that decides
// the schedule, HP, damage and rankings; the browser only reports what the player did. Without Supabase, the same rules
// (bossRules.js) run in this browser, shared by its tabs through storage, so the event still works for solo testing.
//   { mode, playerId, state(), hit({ event, shots, punches, x, z, city, name }), death(event), weekly(), claim() }
export async function connectBoss({ configured = ONLINE_CONFIGURED, clock = () => Date.now(), storage } = {}) {
  if (!configured) return localBoss(clock, storage);
  const { client, session } = await guestClient();
  const rpc = async (name, args) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  return {
    mode: 'online', playerId: session.user.id,
    state: () => rpc('boss_state'),
    hit: ({ event, shots, punches, x, z, city, name }) => rpc('boss_hit', { p_event: event, p_shots: shots, p_punches: punches, p_x: x, p_z: z, p_city: city, p_name: name }),
    death: event => rpc('boss_death', { p_event: event }),
    weekly: () => rpc('boss_weekly_state'),
    claim: () => rpc('boss_claim_rewards'),
  };
}
function localBoss(clock, storage) {
  const playerId = localGuestId(storage);
  const load = () => { const value = readJson(STORAGE_KEYS.boss, storage).value; return value && typeof value === 'object' && value.events ? value : createBossStore(); };
  // Keep about a week of events and five weeks of leaderboards in this browser.
  const save = store => {
    const day = Math.floor((clock() + 8 * 3_600_000) / 86_400_000);
    for (const id of Object.keys(store.events)) if (store.events[id].day < day - 8) delete store.events[id];
    for (const week of Object.keys(store.weekly)) if (+week < day - 35 && store.closedWeeks.includes(+week)) delete store.weekly[week];
    return writeJson(STORAGE_KEYS.boss, store, storage);
  };
  const withStore = fn => { const store = load(), result = fn(store); save(store); return result; };
  return {
    mode: 'local', playerId,
    state: async () => withStore(store => eventState(store, clock(), playerId)),
    hit: async ({ event, shots, punches, x, z, city, name }) => withStore(store => {
      const now = clock(), record = store.events[event], pose = record ? kaijuPose((now - record.startsAt) / 1000) : { x: 0, z: 0 };
      return submitHits(store, { playerId, name, eventId: event, shots, punches, x, z, city, bossX: pose.x, bossZ: pose.z, now });
    }),
    death: async event => withStore(store => reportDeath(store, { playerId, eventId: event, now: clock() })),
    weekly: async () => withStore(store => weeklyState(store, clock(), playerId)),
    claim: async () => withStore(store => claimRewards(store, playerId)),
  };
}
