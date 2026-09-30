import { length, random } from './worldPhysics.js';

const NAMES = ['Alex', 'Sam', 'Maya', 'Kai', 'Zoe', 'Leo', 'Robin', 'Aria', 'Nico', 'Jules', 'Rowan', 'Lina', 'Noah', 'Milo', 'Remy', 'Avery'];
export const npcName = person => person.name || NAMES[(Number(person.id?.split('-').at(-1)) || 0) % NAMES.length];
export const npcRole = person => person.home ? 'Street vendor' : person.guide ? 'Neighborhood guide' : ({ business: 'Commuter', jogger: 'Jogger', kid: 'Young explorer' }[person.role] || (person.slot ? 'Out with family & friends' : 'Local resident'));
const available = s => !s.down && !(s.stun > 0) && !s.driving && !s.boating && !s.riding && !s.metro && !s.seated && !(s.player.knockdown > 0);
const healthy = person => person.health > 0 && !person.knockdown && !person.ragdoll;
export function nearbyNpc(s, clearSight) {
  if (!available(s)) return null;
  let best = null, range = 7;
  for (const person of s.pedestrians) {
    const d = length(s.player, person);
    if (d >= range || !healthy(person) || Math.abs((s.player.height || 0) - (person.height || 0)) > 2.5 || !clearSight(s.player, person, s.blocks)) continue;
    best = person; range = d;
  }
  return best;
}
function lines(s, person) {
  if (person.panic || s.heat > 0) return ['Please give us some space! We need to get somewhere safe.', 'Did you hear those sirens? I am heading away from the trouble.', 'Careful! There are people crossing here!'];
  if (s.boss?.alive) return ['That Aegis Titan is enormous! Please keep it away from the neighborhood.', 'Aegis Titan in our city? I picked quite a day to go for a walk.', 'Watch out for the Aegis Titan! Stay clear of its feet.'];
  if (person.child) return ['I am counting all the colorful cars. The blue ones are winning!', 'When I grow up, I want to explore every island!', 'Race you to the next corner! Wait, I have to stay with my family.'];
  const local = ['The waterfront is my favorite place to unwind.', 'You can take the metro across town. Beats getting stuck in traffic!', 'The Lounge has music and a dance floor. Have you been?', 'I came out for a quick walk and stayed for the street food.'];
  if (person.home) return ['Fresh snacks and neighborhood gossip! That is my specialty.', 'The joggers always say they are just looking. Then they smell the food.', 'I get to meet half the neighborhood at this little stall.'];
  if (person.guide) return ['Welcome! Follow the sidewalks to meet the neighbors. Press T to say hello.', 'Looking for a break? There is music and dancing at the Lounge.', 'Your car is outside the City Hub. Or take a stroll and see what you find.'];
  if (person.role === 'business') return ['Just one more meeting, then I am taking the scenic route home.', 'Coffee, train, office. Today I am mixing things up with a walk.', 'I keep saying I should leave the office earlier. Today I actually did!'];
  if (person.role === 'jogger') return ['One more lap! That is what I said two laps ago.', 'A steady pace and a view of the water. Best part of my day.', 'These crossings are my excuse to catch my breath.'];
  if (s.appearance?.kind && s.appearance.kind !== 'human') local.push('That superhero look is impressive! Can you help keep our streets safe?', 'If I could fly, I would still stop here for the snacks.');
  if (person.pose === 'sit') local.push('Best seat in the neighborhood. Sometimes you just need to watch the world go by.');
  return local;
}
export function endNpcDialogue(s) {
  s.npcDialogue = null;
  for (const person of s.pedestrians) { person.talking = false; person.chatUntil = 0; }
}
export function talkToNpc(s, clearSight) {
  if (s.time < (s.nextNpcTalk || 0)) return false;
  const person = nearbyNpc(s, clearSight);
  if (!person) return false;
  const choices = lines(s, person).filter(line => line !== person.lastDialogue);
  const text = choices[Math.floor(random(s) * choices.length)];
  endNpcDialogue(s);
  person.lastDialogue = text;
  s.nextNpcTalk = s.time + 0.65;
  s.npcDialogue = { id: person.id, name: npcName(person), role: npcRole(person), text, until: s.time + 9 };
  // Pause the family together; pedestrians in a crossing keep moving to the sidewalk.
  for (const member of s.pedestrians) if (member.group === person.group) member.chatUntil = s.time + 9;
  person.talking = true;
  return true;
}
export function stepNpcDialogue(s, clearSight) {
  const dialogue = s.npcDialogue;
  if (!dialogue) return;
  const person = s.pedestrians.find(p => p.id === dialogue.id);
  if (!available(s) || s.time >= dialogue.until || !person || !healthy(person) || length(s.player, person) > 10 || Math.abs((s.player.height || 0) - (person.height || 0)) > 3 || !clearSight(s.player, person, s.blocks)) endNpcDialogue(s);
}
