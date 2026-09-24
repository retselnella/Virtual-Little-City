import { useState } from 'react';
import { CHARACTER_OPTIONS, DEFAULT_CHARACTER, MAX_NAME_LENGTH, cleanCharacter, cleanName, randomCharacter, skinOptions } from '../models/worldTour/characterProfile.js';
import { readCharacter, writeCharacter } from '../services/characterStorage.js';

// First launch opens the creator (no saved character); afterwards it opens from the pause menu to edit.
export function useCharacterController() {
  const [character, setCharacter] = useState(readCharacter), [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => character || { ...DEFAULT_CHARACTER });
  const [saved, setSaved] = useState(true);
  const creating = !character;
  // Option fields accept only listed values; the name keeps spaces while typing and is cleaned on confirm.
  // Changing kind keeps the name and clothes and picks that kind's colours (fur, plating...) for the skin.
  function set(field, value) {
    if (field === 'kind' && CHARACTER_OPTIONS.kind.some(([id]) => id === value)) { setDraft(current => ({ ...current, kind: value, skin: skinOptions(value).some(([id]) => id === current.skin) ? current.skin : skinOptions(value)[2][0] })); return; }
    const options = field === 'skin' ? skinOptions(draft.kind) : CHARACTER_OPTIONS[field];
    if (options?.some(([id]) => id === value)) setDraft(current => ({ ...current, [field]: value }));
  }
  function setName(value) { setDraft(current => ({ ...current, name: value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MAX_NAME_LENGTH) })); }
  function randomize() { setDraft(current => randomCharacter(Math.random, current.name)); }
  function reset() { setDraft(current => ({ ...DEFAULT_CHARACTER, name: current.name })); }
  function confirm() {
    const clean = cleanCharacter({ ...draft, name: cleanName(draft.name) });
    // Storage can be unavailable (private mode, quota); the character still applies for this session.
    setSaved(writeCharacter(clean)); setCharacter(clean); setDraft(clean); setEditing(false);
  }
  function edit() { setDraft(character || { ...DEFAULT_CHARACTER }); setEditing(true); }
  function cancel() { if (character) { setDraft(character); setEditing(false); } }
  return { character, draft, creating, open: creating || editing, saved, set, setName, randomize, reset, confirm, edit, cancel };
}
