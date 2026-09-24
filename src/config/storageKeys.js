// Changing these keys requires an explicit migration.
// Saves from the removed neighborhood mode (little-city-guests-v2, city-studio-guests-v1, city-lighting-v2) are left
// untouched in players' browsers; nothing reads them any more.
export const STORAGE_KEYS = Object.freeze({
  world: 'little-city-world-v1', effects: 'little-city-world-effects-v1', character: 'little-city-character-v1',
});
