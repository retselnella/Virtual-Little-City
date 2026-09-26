import { useRef, useState } from 'react';

// Touch controls for phones and tablets, laid out like mobile shooters: a floating joystick on the left (put your thumb
// down anywhere in the lower-left area and drag; push to the edge to sprint) and a big fire button on the right with
// the other actions around it (tap the weapon bar to switch guns). Drag anywhere else on the screen to turn the camera.
const DEAD = 0.12;
export function TouchStick({ onMove }) {
  const zone = useRef(null), pointer = useRef(null), [stick, setStick] = useState(null);
  function move(e, center = stick) {
    const r = zone.current.getBoundingClientRect(), max = Math.min(64, r.width * 0.32);
    let dx = e.clientX - center.x, dy = e.clientY - center.y; const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    const x = dx / max, y = -dy / max, push = Math.hypot(x, y);
    setStick({ ...center, dx, dy });
    onMove(push < DEAD ? 0 : x, push < DEAD ? 0 : y);
  }
  function start(e) {
    if (pointer.current !== null) return;
    e.preventDefault(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId);
    const center = { x: e.clientX, y: e.clientY }; setStick({ ...center, dx: 0, dy: 0 }); move(e, center);
  }
  function end(e) { if (e.pointerId !== pointer.current) return; pointer.current = null; setStick(null); onMove(null, null); }
  const r = zone.current?.getBoundingClientRect();
  const at = stick && r ? { left: stick.x - r.left, top: stick.y - r.top } : null;
  return <div className="touch-stick" ref={zone} aria-label="Movement joystick: drag to walk, push to the edge to sprint" onPointerDown={start} onPointerMove={e => e.pointerId === pointer.current && move(e)} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <span className={'touch-stick-base' + (at ? ' active' : '')} style={at ? { left: at.left, top: at.top } : undefined}>
      <span className="touch-stick-knob" style={stick ? { transform: `translate(${stick.dx}px, ${stick.dy}px)` } : undefined} />
    </span>
  </div>;
}

const Icon = ({ d, children }) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d ? <path d={d} /> : children}</svg>;
const ICONS = {
  fire: <Icon><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></Icon>,
  punch: <Icon d="M7 11V7a2 2 0 0 1 4 0v3M11 10V6a2 2 0 0 1 4 0v4M15 10V7.5a2 2 0 0 1 4 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0" />,
  jump: <Icon d="M12 20V5M6 11l6-6 6 6" />,
  brake: <Icon><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></Icon>,
  reload: <Icon d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  use: <Icon d="M8 13V6a2 2 0 0 1 4 0v6M12 11V4a2 2 0 0 1 4 0v8M16 10a2 2 0 0 1 4 0v4a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3.5L3 15a2 2 0 0 1 3.4-2L8 15" />,
  car: <Icon d="M5 16v2M19 16v2M3 16h18v-4l-2-5H5l-2 5v4ZM6 12h12" />,
};
export function TouchActions({ hud, disabled, touchControl, action }) {
  const inside = hud.driving || hud.boating, gun = hud.weapon && hud.weapon !== 'fists';
  const small = (key, icon, label, props) => <button key={key} className={'touch-act touch-' + key} aria-label={label} disabled={disabled} {...props}>{ICONS[icon]}<span>{label}</span></button>;
  return <div className={'touch-actions' + (inside ? ' inside' : '')}>
    {inside
      ? <button className="touch-fire brake" aria-label="Brake" disabled={disabled} {...touchControl('brake')}>{ICONS.brake}<span>Brake</span></button>
      : <button className="touch-fire" aria-label={gun ? 'Fire' : 'Punch'} disabled={disabled || hud.riding} {...touchControl('attack')}>{ICONS[gun ? 'fire' : 'punch']}<span>{gun ? 'Fire' : 'Punch'}</span></button>}
    {small('vehicle', 'car', hud.driving ? 'Exit' : hud.boating ? 'Ashore' : 'Car', { onClick: () => action('vehicle') })}
    {small('interact', 'use', 'Use', { onClick: () => action('interact') })}
    {!inside && small('jump', 'jump', 'Jump', touchControl('brake'))}
    {!inside && small('reload', 'reload', 'Reload', { onClick: () => action('reload') })}
  </div>;
}
