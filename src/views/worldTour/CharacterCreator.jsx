import { CHARACTER_OPTIONS, MAX_NAME_LENGTH } from '../../models/worldTour/characterProfile.js';
import { useCharacterPreview } from '../../hooks/useCharacterPreview.js';
import { ExperienceDialog } from '../shared/ExperienceDialog.jsx';

const SWATCHES = [['skin', 'Skin tone'], ['hair', 'Hair colour'], ['shirt', 'Shirt'], ['pants', 'Trousers'], ['shoes', 'Shoes']];
const CHOICES = [['hairStyle', 'Hair style'], ['build', 'Build']];

function OptionGroup({ field, label, value, onPick, swatch }) {
  return <fieldset className="creator-group"><legend>{label}</legend>
    <div className={swatch ? 'creator-swatches' : 'creator-chips'}>{CHARACTER_OPTIONS[field].map(([id, name]) =>
      <button key={id} type="button" aria-pressed={value === id} aria-label={swatch ? `${label}: ${name}` : undefined} title={name} style={swatch ? { '--swatch': id } : undefined} onClick={() => onPick(field, id)}>{swatch ? null : name}</button>)}</div>
  </fieldset>;
}

export default function CharacterCreator({ controller }) {
  const { draft, creating, set, setName, randomize, reset, confirm, cancel } = controller;
  const { host, failed } = useCharacterPreview(draft);
  const [first, ...rest] = SWATCHES;
  return <ExperienceDialog title={creating ? 'Who are you in the city?' : 'Update your look'} className="adventure-dialog creator-dialog" onClose={creating ? undefined : cancel}>
    <p>{creating ? 'Create your character before your first flight. You can change your look any time from the pause menu.' : 'Changes apply as soon as you save. Your progress, cash and contracts stay as they are.'}</p>
    <div className="creator">
      <div className="creator-stage">
        <div className="creator-preview" ref={host} />
        {failed ? <p className="creator-fallback">The 3D preview needs WebGL, but you can still choose your look.</p> : <small>Drag to turn</small>}
      </div>
      <form className="creator-options" onSubmit={event => { event.preventDefault(); confirm(); }}>
        <label className="creator-name"><span>Name</span><input value={draft.name} maxLength={MAX_NAME_LENGTH} placeholder="Newcomer" autoComplete="nickname" onChange={event => setName(event.target.value)} /></label>
        <OptionGroup field={first[0]} label={first[1]} value={draft[first[0]]} onPick={set} swatch />
        {CHOICES.map(([field, label]) => <OptionGroup key={field} field={field} label={label} value={draft[field]} onPick={set} />)}
        {rest.map(([field, label]) => <OptionGroup key={field} field={field} label={label} value={draft[field]} onPick={set} swatch />)}
        <div className="creator-actions">
          <button type="button" onClick={randomize}>Randomize</button>
          <button type="button" onClick={reset}>Reset</button>
          {!creating && <button type="button" onClick={cancel}>Cancel</button>}
          <button type="submit" className="creator-primary">{creating ? 'Start playing ↗' : 'Save look'}</button>
        </div>
      </form>
    </div>
  </ExperienceDialog>;
}
