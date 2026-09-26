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
      if (mapping[e.code] || ['KeyF', 'KeyE', 'KeyQ', 'KeyR', 'KeyM', 'KeyL', 'KeyB', 'KeyN', 'KeyV', 'Escape'].includes(e.code)) e.preventDefault();
      held.current.add(e.code); update(); if (e.repeat) return;
      const key = { KeyF: 'vehicle', KeyE: 'interact', KeyQ: 'weapon', KeyR: 'reload', KeyJ: 'attack', KeyV: 'minimap', ...(/^Digit[1-9]$/.test(e.code) ? { [e.code]: `slot${e.code.slice(5)}` } : {}) }[e.code]; if (key) actions.current(key);
      if (e.code === 'KeyM') { clear(); setPanel('world'); }
      if (e.code === 'KeyL') { clear(); setPanel('contracts'); }
      if (e.code === 'KeyB') { clear(); setPanel('boss'); }
      if (e.code === 'KeyN') { clear(); setPanel('music'); }
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
  // The on-screen joystick: x to the right, y forward, each -1…1. Direction keys are set too (cars, boats and menus that
  // read them), and pushing the stick to its edge sprints. `null` releases it.
  function setStick(x, y) {
    const t = touch.current;
    if (x === null) { delete t.stick; t.forward = t.backward = t.left = t.right = t.run = false; }
    else Object.assign(t, { stick: { x, y }, forward: y > 0.3, backward: y < -0.3, right: x > 0.3, left: x < -0.3, run: Math.hypot(x, y) > 0.92 });
    refreshControls();
  }
  return { input, clear, touchControl, setStick };
}
