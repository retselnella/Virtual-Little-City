import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readWorldSave, serializeWorldSave, writeWorldSave } from '../../src/services/worldStorage.js';
import { readCharacter, writeCharacter } from '../../src/services/characterStorage.js';
import { readJson, writeJson } from '../../src/services/storage.js';
import { STORAGE_KEYS } from '../../src/config/storageKeys.js';
import { CHARACTER_OPTIONS, DEFAULT_CHARACTER, MAX_NAME_LENGTH, cleanCharacter, displayName, randomCharacter } from '../../src/models/worldTour/characterProfile.js';
import { CONTENT_SECURITY_POLICY, PREVIEW_HEADERS } from '../../src/config/security.js';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test('world saves validate cities, cash and contract IDs and keep their own key', () => {
  const storage = memory();
  assert(writeWorldSave(serializeWorldSave({ city: 'tokyo', cash: 85, completed: ['tokyo:courier', 'bad', 'tokyo:courier'], owned: ['rifle', 'bazooka', '__proto__'] }), storage));
  assert.deepEqual(readWorldSave(storage), { city: 'tokyo', cash: 85, completed: ['tokyo:courier'], owned: ['pistol', 'rifle'] }, 'only real guns are kept, and the pistol always');
  assert.equal(storage.getItem(STORAGE_KEYS.character), null, 'world saves never touch the character save');
});
test('character saves are rebuilt from known options; names stay bounded plain text', () => {
  const storage = memory();
  assert.equal(readCharacter(storage), null, 'no save means the creator opens');
  const tampered = { name: '  <img src=x onerror=alert(1)>\u0000\u0007 extra words that go on and on  ', skin: 'url(javascript:alert(1))', hair: '#161616', hairStyle: 'mohawk', shirt: '#c95b5b', build: 'giant', admin: true };
  const clean = cleanCharacter(tampered);
  assert.equal(clean.skin, DEFAULT_CHARACTER.skin); assert.equal(clean.hairStyle, DEFAULT_CHARACTER.hairStyle); assert.equal(clean.build, DEFAULT_CHARACTER.build);
  assert.equal(clean.hair, '#161616'); assert.equal(clean.shirt, '#c95b5b'); assert.equal('admin' in clean, false);
  assert.ok(clean.name.length <= MAX_NAME_LENGTH); assert.doesNotMatch(clean.name, /[\u0000-\u001f]/); assert.equal(clean.name, clean.name.trim());
  for (const bad of [null, 'text', 7, []]) assert.equal(cleanCharacter(bad), null);
  assert(writeCharacter(tampered, storage));
  assert.deepEqual(readCharacter(storage), clean);
  storage.setItem(STORAGE_KEYS.character, '{'); assert.equal(readCharacter(storage), null, 'a corrupt save reopens the creator');
  const random = randomCharacter(() => 0.999, 'Ada');
  for (const [field, options] of Object.entries(CHARACTER_OPTIONS)) assert(options.some(([id]) => id === random[field]), field);
  assert.equal(displayName({ name: '   ' }), 'Newcomer');
});
test('unavailable, corrupt and oversized storage fail without breaking play', () => {
  const blocked = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  assert.equal(readCharacter(blocked), null); assert.equal(writeCharacter(DEFAULT_CHARACTER, blocked), false);
  assert.deepEqual(readWorldSave(blocked), { city: 'miami', cash: 0, completed: [], owned: ['pistol'] });
  const storage = memory(); storage.setItem('bad', '{'); assert.equal(readJson('bad', storage).value, null);
  storage.setItem('large', 'x'.repeat(1_000_001)); assert.equal(readJson('large', storage).value, null);
  const cycle = {}; cycle.self = cycle; assert.equal(writeJson('cycle', cycle, storage), false);
});
test('the production policy allows only this origin plus WebAssembly compilation for Rapier', () => {
  assert(CONTENT_SECURITY_POLICY.includes("script-src 'self' 'wasm-unsafe-eval'"));
  assert(!CONTENT_SECURITY_POLICY.includes("'unsafe-eval'"));
  // The only remote hosts are Supabase Realtime's, and only for connections (never scripts, styles or frames).
  const directives = Object.fromEntries(CONTENT_SECURITY_POLICY.split('; ').map(d => [d.split(' ')[0], d.split(' ').slice(1)]));
  for (const [name, sources] of Object.entries(directives)) {
    const remote = sources.filter(source => /^(https?|wss?):/.test(source));
    assert.deepEqual(remote, name === 'connect-src' ? ['https://*.supabase.co', 'wss://*.supabase.co'] : [], name);
  }
  assert.match(PREVIEW_HEADERS['Permissions-Policy'], /geolocation=\(\)/);
});
test('the Vercel deployment sends exactly the production security headers and caches only hashed assets', () => {
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.outputDirectory, 'dist'); assert.equal(vercel.buildCommand, 'npm run build'); assert.equal(vercel.installCommand, 'npm ci');
  const site = vercel.headers.find(rule => rule.source === '/(.*)');
  // vercel.json cannot import src/config/security.js, so this keeps the two copies of the policy identical.
  assert.deepEqual(Object.fromEntries(site.headers.map(({ key, value }) => [key, value])), PREVIEW_HEADERS);
  assert.match(PREVIEW_HEADERS['Content-Security-Policy'], /frame-ancestors 'none'/);
  const immutable = vercel.headers.filter(rule => rule.headers.some(h => h.key === 'Cache-Control' && /immutable/.test(h.value)));
  assert.deepEqual(immutable.map(rule => rule.source), ['/assets/(.*)'], 'index.html must not be cached as immutable');
});
