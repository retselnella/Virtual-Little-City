import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { PREVIEW_HEADERS, contentSecurityPolicy, realtimeOrigins } from './src/config/security.js';
import { resolveSupabaseEnv } from './src/config/supabaseEnv.js';

export default defineConfig(({ mode }) => {
  // Reads .env files and the host's variables (e.g. Vercel). Only the two resolved Supabase values reach the bundle;
  // a secret/service-role key stops the build instead of being published.
  const supabase = resolveSupabaseEnv({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  if (mode === 'production') console.log(supabase.url && supabase.key ? `Multiplayer: online via ${supabase.urlName} + ${supabase.keyName}` : 'Multiplayer: Supabase not configured (same-browser tabs only)');
  return {
    define: { __SUPABASE_CONFIG__: JSON.stringify({ url: supabase.url, key: supabase.key }) },
    plugins: [react(), {
      name: 'production-content-security-policy',
      apply: 'build',
      // The build's own policy allows only the configured Supabase project (none when multiplayer is not configured).
      transformIndexHtml() {
        return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(realtimeOrigins(supabase.url)) }, injectTo: 'head-prepend' }];
      },
    }],
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1', headers: PREVIEW_HEADERS },
    build: { rollupOptions: { output: { manualChunks: { three: ['three'], rapier: ['@dimforge/rapier3d-compat'], supabase: ['@supabase/supabase-js'] } } } },
  };
});
