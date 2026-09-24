// The player's appearance, chosen in the character creator on first launch and editable from the pause menu.
// Saved data is rebuilt from known fields only, so a tampered or outdated save can never reach the renderer.
export const CHARACTER_OPTIONS = Object.freeze({
  skin: [['#f3cfb0', 'Porcelain'], ['#e0ac85', 'Beige'], ['#d6a07d', 'Honey'], ['#c18b63', 'Tan'], ['#9a6644', 'Bronze'], ['#6d452e', 'Brown'], ['#4d3122', 'Deep brown']],
  hair: [['#161616', 'Black'], ['#46362e', 'Dark brown'], ['#7d532f', 'Chestnut'], ['#c7a266', 'Blonde'], ['#8c3b2b', 'Auburn'], ['#a7a39c', 'Grey'], ['#3d5a8a', 'Blue'], ['#c96b9a', 'Pink']],
  hairStyle: [['short', 'Short'], ['long', 'Long'], ['buzz', 'Buzz cut'], ['bun', 'Bun'], ['cap', 'Cap'], ['bald', 'Bald']],
  shirt: [['#e5ded5', 'Cream'], ['#496b92', 'Denim'], ['#c95b5b', 'Red'], ['#4f8a6b', 'Green'], ['#e0b04b', 'Mustard'], ['#7a5aa6', 'Purple'], ['#2b3240', 'Charcoal'], ['#f08a5d', 'Coral']],
  pants: [['#344653', 'Slate'], ['#2f3338', 'Black'], ['#1f3a5f', 'Navy'], ['#6b5a48', 'Brown'], ['#7b8793', 'Grey'], ['#a38f72', 'Khaki']],
  shoes: [['#e8e2d6', 'White'], ['#2a2a2a', 'Black'], ['#b5523b', 'Red'], ['#3d6fa8', 'Blue']],
  build: [['compact', 'Compact'], ['average', 'Average'], ['tall', 'Tall']],
});
export const BUILD_SCALE = Object.freeze({ compact: 0.93, average: 1, tall: 1.07 });
export const MAX_NAME_LENGTH = 24;
export const DEFAULT_CHARACTER = Object.freeze({ name: '', skin: '#d6a07d', hair: '#46362e', hairStyle: 'short', shirt: '#e5ded5', pants: '#344653', shoes: '#e8e2d6', build: 'average' });
const FIELDS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants', 'shoes', 'build'];

export function cleanName(value) {
  // Text only: control characters removed, whitespace collapsed, length bounded. React renders it as text.
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : '';
}
// Returns a complete, valid character, or null when there is no usable save (the creator is shown then).
export function cleanCharacter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const character = { name: cleanName(value.name) };
  for (const field of FIELDS) {
    const allowed = CHARACTER_OPTIONS[field].map(([id]) => id);
    character[field] = allowed.includes(value[field]) ? value[field] : DEFAULT_CHARACTER[field];
  }
  return character;
}
export function randomCharacter(random = Math.random, name = '') {
  const character = { name: cleanName(name) };
  for (const field of FIELDS) { const options = CHARACTER_OPTIONS[field]; character[field] = options[Math.floor(random() * options.length) % options.length][0]; }
  return character;
}
// What the simulation needs from the appearance: body size drives the physics capsule and ragdoll scale.
export function playerLook(character) { return { scale: BUILD_SCALE[character?.build] ?? 1 }; }
export function displayName(character) { return cleanName(character?.name) || 'Newcomer'; }
