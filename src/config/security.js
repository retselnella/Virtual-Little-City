// Production policy: Rapier needs WebAssembly compilation, not JavaScript eval.
// Inline CSS is used for live city colors, minimaps and canvas dimensions.
// Multiplayer talks to Supabase Realtime (HTTPS for anonymous sign-in, WSS for channels). Browsers enforce every policy
// they receive, so the result is the intersection: the HTTP header (vercel.json, identical for every deployment) allows
// Supabase hosts in general, and the build's meta tag names only the configured project (or no remote host at all).
export const SUPABASE_HOSTS = ['https://*.supabase.co', 'wss://*.supabase.co'];
export function realtimeOrigins(url) {
  try { const { protocol, host } = new URL(url); return protocol === 'https:' ? [`https://${host}`, `wss://${host}`] : []; } catch { return []; }
}
export function contentSecurityPolicy(connect = SUPABASE_HOSTS) {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    ["connect-src 'self'", ...connect].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
export const CONTENT_SECURITY_POLICY = contentSecurityPolicy();
export const PREVIEW_HEADERS = {
  'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
