import { STORAGE_KEYS } from '../config/storageKeys.js';
import { readJson, writeJson } from './storage.js';

export function readBloodPreference(storage) { return readJson(STORAGE_KEYS.effects, storage).value?.blood !== false; }
export function writeBloodPreference(blood, storage) { return typeof blood === 'boolean' && writeJson(STORAGE_KEYS.effects, { blood }, storage); }
// Music player settings: volume (0–1), shuffle, and whether the music was playing (it resumes on your next click).
export function readMusicPreference(storage) {
  const v = readJson(STORAGE_KEYS.music, storage).value || {};
  return { volume: Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : 0.6, shuffle: v.shuffle === true, on: v.on === true };
}
export function writeMusicPreference(value, storage) { return writeJson(STORAGE_KEYS.music, { volume: value.volume, shuffle: !!value.shuffle, on: !!value.on }, storage); }
