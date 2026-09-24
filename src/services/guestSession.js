import { ONLINE } from '../config/online.js';
import { STORAGE_KEYS } from '../config/storageKeys.js';
import { readText, writeText } from './storage.js';

// One guest per browser. Online, that is Supabase's anonymous sign-in: the session is kept in this browser's storage
// ('little-city-auth') and reused on every visit, so a returning guest keeps the same identity (and their boss damage
// and weekly rank) without an account. One client is shared by multiplayer and the world boss.
export const AUTH_OPTIONS = Object.freeze({ auth: { persistSession: true, autoRefreshToken: true, storageKey: 'little-city-auth' } });
export async function signInGuest(client) {
  let session = (await client.auth.getSession()).data?.session;
  if (!session) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }
  return session;
}
let shared = null;
export function guestClient(config = ONLINE) {
  if (!shared) shared = (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(config.url, config.key, AUTH_OPTIONS);
    return { client, session: await signInGuest(client) };
  })().catch(error => { shared = null; throw error; });
  return shared;
}
// Offline (same-browser) play also keeps one guest id per browser, so local rankings follow the same player.
export function localGuestId(storage) {
  const saved = readText(STORAGE_KEYS.guest, storage).value;
  if (typeof saved === 'string' && /^guest-[A-Za-z0-9]{8,32}$/.test(saved)) return saved;
  const id = 'guest-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  writeText(STORAGE_KEYS.guest, id, storage);
  return id;
}
