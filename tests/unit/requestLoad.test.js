import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedRead } from '../../src/services/requestCache.js';
import { bossPollDelay, startPolling } from '../../src/services/bossPolling.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('cached reads coalesce requests, expire, retry errors and invalidate in-flight results', async () => {
  let now = 0, calls = 0, next = deferred();
  const load = cachedRead(() => { calls++; return next.promise; }, 100, () => now);
  const first = load(); assert.equal(load(), first);
  next.resolve('first'); assert.equal(await first, 'first');
  assert.equal(await load(), 'first'); assert.equal(calls, 1);
  now = 101; next = deferred(); const failed = load(); next.reject(new Error('offline'));
  await assert.rejects(failed, /offline/);
  next = deferred(); const stale = load(); await settle();
  const old = next; load.clear(); next = deferred(); const fresh = load(); await settle();
  next.resolve('fresh'); assert.equal(await fresh, 'fresh'); old.resolve('stale'); await stale;
  assert.equal(await load(), 'fresh'); assert.equal(calls, 4);
});

test('boss polls slow down off-event without sleeping through a phase boundary', () => {
  const event = { startsAt: 7200000, endsAt: 10800000, phase: 'scheduled' };
  assert.equal(bossPollDelay(event, 0), 60000);
  assert.equal(bossPollDelay(event, 3597000), 3000);
  assert.equal(bossPollDelay({ ...event, phase: 'countdown' }, 7100000), 15000);
  assert.equal(bossPollDelay({ ...event, phase: 'countdown' }, 7198000), 2000);
  assert.equal(bossPollDelay({ ...event, phase: 'active' }, 7300000), 5000);
});

test('polling never overlaps, backs off, pauses while hidden and cleans up', async () => {
  const doc = new EventTarget(), events = new EventTarget(), timers = new Map();
  let sequence = 0, calls = 0, next = deferred(); doc.hidden = false;
  const stop = startPolling(() => { calls++; return next.promise; }, () => 5000, {
    document: doc, events, random: () => 0.5,
    setTimer: (fn, wait) => { timers.set(++sequence, { fn, wait }); return sequence; }, clearTimer: id => timers.delete(id),
  });
  events.dispatchEvent(new Event('online')); assert.equal(calls, 1); assert.equal(timers.size, 0);
  next.reject(new Error('offline')); await settle(); assert.equal([...timers.values()][0].wait, 5000);
  next = deferred(); [...timers.values()][0].fn(); next.reject(new Error('still offline')); await settle();
  assert.equal([...timers.values()][0].wait, 10000);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(timers.size, 0);
  events.dispatchEvent(new Event('online')); assert.equal(calls, 2);
  next = deferred(); doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(calls, 3);
  next.resolve(); await settle(); assert.equal([...timers.values()][0].wait, 5000);
  next = deferred(); [...timers.values()][0].fn(); stop(); next.resolve(); await settle();
  assert.equal(timers.size, 0); events.dispatchEvent(new Event('online')); assert.equal(calls, 4);
});
