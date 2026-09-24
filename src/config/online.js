// Multiplayer via Supabase Realtime. vite.config.js resolves the settings at build time (see supabaseEnv.js for the
// accepted variable names) and injects them as __SUPABASE_CONFIG__. Both values are public by design: access is
// enforced by anonymous sign-in plus the Realtime policies in supabase/realtime-policies.sql.
// Without them the game still runs, and tabs in the same browser see each other through a local fallback.
/* global __SUPABASE_CONFIG__ */
const injected = typeof __SUPABASE_CONFIG__ === 'object' && __SUPABASE_CONFIG__ ? __SUPABASE_CONFIG__ : {};
function supabaseUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.pathname.replace('/', '') && !url.search ? url.origin : ''; } catch { return ''; }
}
export const ONLINE = Object.freeze({ url: supabaseUrl(injected.url), key: typeof injected.key === 'string' ? injected.key.trim() : '' });
export const ONLINE_CONFIGURED = !!(ONLINE.url && ONLINE.key);
