import { CHARACTER_OPTIONS, KINDS, MAX_NAME_LENGTH, skinOptions } from '../../models/worldTour/characterProfile.js';
import { useCharacterPreview } from '../../hooks/useCharacterPreview.js';
import { ExperienceDialog } from '../shared/ExperienceDialog.jsx';

const KIND_ICONS = { human: '🧍', wolf: '🐺', brute: '💪', robot: '🤖' };
// Only the parts each kind's model actually shows: wolves walk on paws, so they have no shoes.
const CLOTHES = {
  human: [['shirt', 'Shirt'], ['pants', 'Trousers'], ['shoes', 'Shoes']],
  wolf: [['shirt', 'Shirt'], ['pants', 'Trousers']],
  brute: [['shirt', 'Vest'], ['pants', 'Trousers'], ['shoes', 'Boots']],
  robot: [['shirt', 'Chest panel'], ['pants', 'Leg plating'], ['shoes', 'Feet']],
};
const nameOf = (options, value) => options.find(([id]) => id === value)?.[1] || '';

function OptionGroup({ field, label, value, onPick, swatch, options = CHARACTER_OPTIONS[field] }) {
  return <fieldset className="creator-group"><legend>{label}</legend><span className="creator-value" aria-hidden="true">{nameOf(options, value)}</span>
    <div className={swatch ? 'creator-swatches' : 'creator-chips'}>{options.map(([id, name]) =>
      <button key={id} type="button" aria-pressed={value === id} aria-label={swatch ? `${label}: ${name}` : undefined} title={name} style={swatch ? { '--swatch': id } : undefined} onClick={() => onPick(field, id)}>{swatch ? null : name}</button>)}</div>
  </fieldset>;
}

function KindPicker({ value, onPick }) {
  return <fieldset className="creator-group"><legend>Character</legend>
    <div className="creator-kinds">{Object.entries(KINDS).map(([id, kind]) =>
      <button key={id} type="button" aria-pressed={value === id} onClick={() => onPick('kind', id)}>
        <span className="creator-kind-icon" aria-hidden="true">{KIND_ICONS[id]}</span><strong>{kind.name}</strong>
      </button>)}</div>
  </fieldset>;
}

export default function CharacterCreator({ controller }) {
  const { draft, creating, set, setName, randomize, reset, confirm, cancel } = controller;
  const { host, failed } = useCharacterPreview(draft);
  const kind = KINDS[draft.kind] || KINDS.human;
  return <ExperienceDialog title={creating ? 'Who are you in the city?' : 'Update your look'} className="adventure-dialog creator-dialog" onClose={creating ? undefined : cancel}>
    <p>{creating ? 'Create your character before you set off. You can change your look any time from the pause menu.' : 'Changes apply as soon as you save. Your progress, cash and contracts stay as they are.'}</p>
    <div className="creator">
      <div className="creator-stage">
        <div className="creator-preview" ref={host} />
        <div className="creator-badge"><strong>{draft.name.trim() || 'Newcomer'}</strong><span>{kind.name} · {nameOf(CHARACTER_OPTIONS.build, draft.build)}</span></div>
        {failed ? <p className="creator-fallback">The 3D preview needs WebGL, but you can still choose your look.</p> : <small>Drag to turn</small>}
      </div>
      <form className="creator-options" onSubmit={event => { event.preventDefault(); confirm(); }}>
        <label className="creator-name"><span>Name</span><input value={draft.name} maxLength={MAX_NAME_LENGTH} placeholder="Newcomer" autoComplete="nickname" onChange={event => setName(event.target.value)} /></label>
        <KindPicker value={draft.kind} onPick={set} />
        <p className="creator-perk">{kind.perk}</p>
        <section className="creator-section"><h3>Body</h3>
          <OptionGroup field="skin" label={kind.skinLabel} value={draft.skin} onPick={set} options={skinOptions(draft.kind)} swatch />
          <OptionGroup field="build" label="Build" value={draft.build} onPick={set} />
          {kind.hair && <OptionGroup field="hairStyle" label="Hair style" value={draft.hairStyle} onPick={set} />}
          {kind.hair && draft.hairStyle !== 'bald' && <OptionGroup field="hair" label={draft.hairStyle === 'cap' ? 'Cap colour' : 'Hair colour'} value={draft.hair} onPick={set} swatch />}
        </section>
        <section className="creator-section"><h3>{draft.kind === 'robot' ? 'Paint' : 'Clothes'}</h3>
          {(CLOTHES[draft.kind] || CLOTHES.human).map(([field, label]) => <OptionGroup key={field} field={field} label={label} value={draft[field]} onPick={set} swatch />)}
        </section>
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
