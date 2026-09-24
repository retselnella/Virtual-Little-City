import { lazy, Suspense } from 'react';
import { useCharacterController } from '../controllers/useCharacterController.js';
const WorldTour = lazy(() => import('./WorldTour.jsx'));
const CharacterCreator = lazy(() => import('../views/worldTour/CharacterCreator.jsx'));

// First launch shows only the character creator; after that the game loads, and the creator can reopen over it
// (paused) from the pause menu.
export default function App() {
  const character = useCharacterController();
  return <Suspense fallback={<div className="mode-loading">Loading Little City…</div>}>
    {character.character && <WorldTour character={character.character} suspended={character.open} onEditCharacter={character.edit} />}
    {character.open && <CharacterCreator controller={character} />}
  </Suspense>;
}
