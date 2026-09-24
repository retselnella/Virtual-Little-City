import { STORAGE_KEYS } from '../config/storageKeys.js';
import { cleanWorldSave } from '../models/worldTour/worldAdventure.js';
import { readJson, writeText } from './storage.js';

export function readWorldSave(storage) { return cleanWorldSave(readJson(STORAGE_KEYS.world, storage).value); }
export function serializeWorldSave(session) { return JSON.stringify(cleanWorldSave(session)); }
export function writeWorldSave(serialized, storage) { return writeText(STORAGE_KEYS.world, serialized, storage); }
