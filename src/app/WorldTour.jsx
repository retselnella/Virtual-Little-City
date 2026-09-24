import { useWorldController } from '../controllers/useWorldController.js';
import WorldView from '../views/worldTour/WorldView.jsx';
export default function WorldTour({ character, suspended, onEditCharacter }) { return <WorldView controller={useWorldController(character, suspended)} onEditCharacter={onEditCharacter} />; }
