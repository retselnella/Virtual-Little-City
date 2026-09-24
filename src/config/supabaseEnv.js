// Resolves the Supabase settings for a build from environment variables (used by vite.config.js).
// Accepted names, first match wins:
//   URL: VITE_SUPABASE_URL, SUPABASE_URL
//   key: VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY
// The key is embedded in public JavaScript, so a secret or service-role key is rejected rather than shipped.
const URL_NAMES = ['VITE_SUPABASE_URL', 'SUPABASE_URL'];
const KEY_NAMES = ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'];

function jwtRole(key) {
  try {
    const part = key.split('.')[1]; if (!part) return null;
    const json = typeof atob === 'function' ? atob(part.replace(/-/g, '+').replace(/_/g, '/')) : Buffer.from(part, 'base64url').toString('utf8');
    return JSON.parse(json).role ?? null;
  } catch { return null; }
}
export function isSecretKey(key) { return /^sb_secret_/.test(key) || jwtRole(key) === 'service_role'; }

export function resolveSupabaseEnv(env = {}) {
  const pick = names => names.map(name => ({ name, value: typeof env[name] === 'string' ? env[name].trim() : '' })).find(item => item.value) || { name: null, value: '' };
  const url = pick(URL_NAMES), key = pick(KEY_NAMES);
  if (key.value && isSecretKey(key.value)) {
    throw new Error(`${key.name} holds a Supabase secret/service-role key. It would be published in the game's JavaScript. Use the publishable (or anon public) key from Project Settings -> API Keys, and rotate the secret key if it was exposed anywhere public.`);
  }
  return { url: url.value, key: key.value, urlName: url.name, keyName: key.name };
}
