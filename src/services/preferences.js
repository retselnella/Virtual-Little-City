import { STORAGE_KEYS } from '../config/storageKeys.js';
import { readJson, writeJson } from './storage.js';

export function readBloodPreference(storage) { return readJson(STORAGE_KEYS.effects, storage).value?.blood !== false; }
export function writeBloodPreference(blood, storage) { return typeof blood === 'boolean' && writeJson(STORAGE_KEYS.effects, { blood }, storage); }
