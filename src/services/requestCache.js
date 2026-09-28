// Share concurrent reads and reuse successful results. Failures remain retryable.
export function cachedRead(read, ttl, now = Date.now) {
  let pending = null, value, expires = 0, generation = 0;
  const load = () => {
    if (pending) return pending;
    if (now() < expires) return Promise.resolve(value);
    const current = generation;
    const request = Promise.resolve().then(read).then(result => {
      if (current === generation) { value = result; expires = now() + ttl; }
      return result;
    }).finally(() => { if (pending === request) pending = null; });
    pending = request;
    return pending;
  };
  load.clear = () => { expires = 0; pending = null; generation++; };
  return load;
}
