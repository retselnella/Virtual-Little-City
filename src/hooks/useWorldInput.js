import { useEffect, useRef } from 'react';
const CONTROL_KEYS = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'brake', KeyJ: 'attack' };

export function useWorldInput(paused, action, setPanel) {
  const input = useRef({}), held = useRef(new Set()), touch = useRef({});
  function clear() { held.current.clear(); touch.current = {}; input.current = {}; }
  function refreshControls() { const next = { ...touch.current }; held.current.forEach(key => { if (CONTROL_KEYS[key]) next[CONTROL_KEYS[key]] = true; if (key === 'Space') next.jump = true; }); input.current = next; }
  const actions = useRef(action); actions.current = action;
  useEffect(() => {
    const mapping = CONTROL_KEYS;
    function update() { refreshControls(); }
    function down(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || paused.current) return;
      if (['BUTTON', 'A'].includes(e.target.tagName) && ['Space', 'Enter'].includes(e.code)) return;
      if (mapping[e.code] || ['KeyF', 'KeyE', 'KeyQ', 'KeyR', 'KeyM', 'KeyL', 'KeyB', 'Escape'].includes(e.code)) e.preventDefault();
      held.current.add(e.code); update(); if (e.repeat) return;
      const key = { KeyF: 'vehicle', KeyE: 'interact', KeyQ: 'weapon', KeyR: 'reload', KeyJ: 'attack', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5' }[e.code]; if (key) actions.current(key);
      if (e.code === 'KeyM') { clear(); setPanel('world'); }
      if (e.code === 'KeyL') { clear(); setPanel('contracts'); }
      if (e.code === 'KeyB') { clear(); setPanel('boss'); }
      if (e.code === 'Escape') { clear(); setPanel('help'); }
    }
    function up(e) { held.current.delete(e.code); update(); }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  function touchControl(key) {
    function set(pressed) { touch.current[key] = pressed; if (key === 'brake') touch.current.jump = pressed; refreshControls(); }
    return { onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set(true); if (key === 'attack') actions.current('attack'); }, onPointerUp: () => set(false), onPointerCancel: () => set(false), onLostPointerCapture: () => set(false) };
  }
  return { input, clear, touchControl };
}
