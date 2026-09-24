const MAX_SAVE_LENGTH = 1_000_000;

// Storage is an untrusted, optional browser boundary, never an authentication service.
// An injected Storage-compatible object makes failure paths testable without a browser.
export function readText(key, storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(key);
    if (typeof value === 'string' && value.length > MAX_SAVE_LENGTH) return { value: null, found: true, available: true };
    return { value, found: value !== null, available: true };
  } catch { return { value: null, found: false, available: false }; }
}
export function readJson(key, storage) {
  const result = readText(key, storage);
  try { return { ...result, value: JSON.parse(result.value) }; }
  catch { return { ...result, value: null }; }
}
export function writeText(key, value, storage) {
  try {
    if (typeof value !== 'string' || value.length > MAX_SAVE_LENGTH) return false;
    (storage ?? globalThis.localStorage).setItem(key, value); return true;
  } catch { return false; }
}
export function writeJson(key, value, storage) {
  try { return writeText(key, JSON.stringify(value), storage); } catch { return false; }
}
