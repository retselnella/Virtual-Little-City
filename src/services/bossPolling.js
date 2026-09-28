// Keep hit batches inside the server's eight-second fire-time window, including immediately after city travel.
export function bossPollDelay(event, now) {
  if (!event) return 5000;
  let delay = event.phase === 'active' ? 5000 : 60000;
  const boundary = event.phase === 'scheduled' ? event.startsAt - 3600000
    : event.phase === 'countdown' ? event.startsAt : event.endsAt;
  if (event.phase === 'countdown') delay = 15000;
  return Math.max(1000, Math.min(delay, boundary - now));
}

// A single request at a time, with jitter and failure backoff. Hidden tabs stop polling and resume on visibility.
export function startPolling(task, delay, {
  document = globalThis.document, events = globalThis, random = Math.random,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  let stopped = false, busy = false, timer, failures = 0;
  const run = async () => {
    if (stopped || busy || document?.hidden) return;
    clearTimer(timer); busy = true;
    try { await task(); failures = 0; } catch { failures = Math.min(6, failures + 1); }
    finally {
      busy = false;
      if (!stopped && !document?.hidden) {
        const wait = failures ? Math.min(120000, 5000 * 2 ** (failures - 1)) : delay();
        timer = setTimer(run, Math.round(wait * (0.9 + random() * 0.2)));
      }
    }
  };
  const wake = () => {
    clearTimer(timer);
    if (!document?.hidden) void run();
  };
  document?.addEventListener?.('visibilitychange', wake);
  events?.addEventListener?.('online', wake);
  void run();
  return () => {
    stopped = true; clearTimer(timer);
    document?.removeEventListener?.('visibilitychange', wake);
    events?.removeEventListener?.('online', wake);
  };
}
