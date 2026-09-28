import { markCombat, syncEventHealth } from './playerHealth.js';

export const CHEAT_CODES = Object.freeze([
  { code: 'SKYHIGH', description: 'Toggle flight. Space to rise, Ctrl to descend.' },
  { code: 'FLASH', description: 'Toggle triple running speed.' },
  { code: 'MOONBOOTS', description: 'Toggle extra-high jumps.' },
  { code: 'PATCHUP', description: 'Restore your current maximum health.' },
  { code: 'GHOSTED', description: 'Lose your wanted stars; police leave.' },
  { code: 'RESET', description: 'Turn off flight, speed and jump cheats.' },
]);
export const CHEAT_MOVEMENT = Object.freeze({ speed: 3, jump: 2, flySpeed: 22, ceiling: 180 });

// Local commands: no network, storage, executable input, money or leaderboard writes.
export function applyCheat(s, raw) {
  const code = String(raw || '').trim().replace(/^\//, '').toUpperCase();
  if (code === 'HELP') return CHEAT_CODES.map(c => `${c.code}: ${c.description}`).join('\n');
  if (!CHEAT_CODES.some(c => c.code === code)) return 'Unknown code. Try a suggestion below, or type HELP.';
  if (s.down) return 'Wait until you are back on your feet to use a code.';
  s.cheats ||= {};
  if (code === 'RESET') { s.cheats = {}; s.player.flying = false; return 'Cheats off. Gravity and normal movement restored.'; }
  if (code === 'PATCHUP') { syncEventHealth(s); s.health = s.maxHealth; markCombat(s); return `Patched up: ${Math.ceil(s.health)} HP.`; }
  if (code === 'GHOSTED') { s.heat = 0; s.kills = 0; s.arrest = 0; s.incident = false; return 'Wanted stars cleared. Police are standing down.'; }
  if (s.driving || s.boating || s.riding || s.seated) return 'Step out onto the street first to change movement cheats.';
  const flag = { SKYHIGH: 'fly', FLASH: 'speed', MOONBOOTS: 'jump' }[code];
  s.cheats[flag] = !s.cheats[flag];
  if (flag === 'fly') { s.player.flying = s.cheats.fly; s.player.velocityY = 0; }
  return `${code} ${s.cheats[flag] ? 'ON' : 'OFF'}.${flag === 'fly' && s.cheats.fly ? ' Space to rise, Ctrl to descend. Release both to hover.' : ''}`;
}
