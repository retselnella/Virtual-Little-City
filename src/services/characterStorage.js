import { STORAGE_KEYS } from '../config/storageKeys.js';
import { cleanCharacter } from '../models/worldTour/characterProfile.js';
import { readJson, writeJson } from './storage.js';

// Null means no usable character yet, so the app opens the character creator.
export function readCharacter(storage) { return cleanCharacter(readJson(STORAGE_KEYS.character, storage).value); }
export function writeCharacter(character, storage) {
  const clean = cleanCharacter(character);
  return !!clean && writeJson(STORAGE_KEYS.character, clean, storage);
}
