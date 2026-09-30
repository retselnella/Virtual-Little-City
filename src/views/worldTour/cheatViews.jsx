import { useEffect, useRef, useState } from 'react';
import { CHEAT_CODES } from '../../models/worldTour/cheatCodes.js';
import { CITY_POWERS, canUsePower, cityPowerTarget, heroPower, kaijuPower, kaijuPowerTarget } from '../../models/worldTour/heroPowers.js';

export function CheatConsole({ hud, run, clearControls, touchControl, disabled, action }) {
  const power = heroPower(hud), cooldown = Math.ceil(Math.max(hud.player.powerCooldown || 0, power?.combat ? Math.max(hud.heroAttackCooldown || 0, hud.cooldown || 0) : 0, hud.appearance?.kind === 'wonderwoman' ? hud.heroGuardCooldown || 0 : 0));
  const strike = kaijuPower(hud), bossTarget = strike && kaijuPowerTarget(hud), target = bossTarget || (strike && cityPowerTarget(hud));
  const city = CITY_POWERS[hud.appearance?.kind];
  const recovery = Math.ceil(Math.max(hud.heroAttackCooldown || 0, hud.cooldown || 0, power?.combat ? hud.player.powerCooldown || 0 : 0));
  const [open, setOpen] = useState(false), [text, setText] = useState('');
  const [messages, setMessages] = useState([{ from: 'City', text: 'Try a code below. These are local commands, not messages to other players.' }]);
  const log = useRef(null), input = useRef(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, open]);
  function send(value) {
    const code = value.trim(); if (!code || disabled) return;
    const reply = run(code);
    setMessages(old => [...old.slice(-8), { from: 'You', text: code }, { from: 'City', text: reply }]); setText('');
    input.current?.blur();
  }
  return <section className={`cheat-console${open ? ' is-open' : ''}`} aria-label="Local cheat console">
    {power && <div className="hero-power"><button aria-label={`Superpower: ${power.name}`} aria-pressed={!!hud.player.powerActive} disabled={disabled || !canUsePower(hud) || cooldown > 0 || (power.ground && ((!hud.player.grounded && hud.player.height > 0.12) || hud.player.flying))} onClick={() => action('power')}>
      <kbd>G</kbd> {power.name}<strong>{cooldown ? `${cooldown}s` : hud.player.powerActive ? 'ON' : 'Ready'}</strong>
    </button><small>{power.name === 'Flight' ? 'Space: rise · Ctrl: descend · G: land' : power.combat ? 'Ground pulse · Shared attack recovery' : power.name === 'Bracelet guard' ? '40% damage reduction · 5 seconds · 10s recovery' : '3× speed for 4 seconds · Hold Shift to sprint'}</small>
      {strike && <><button className="hero-kaiju" aria-label={`Hero attack: ${strike.name}`} disabled={disabled || !target || recovery > 0} title={`Targets Aegis Titan within ${strike.reach} m or a hostile within ${city.reach} m; clear sight required${strike.ground ? ', while on the ground' : ''}.`} onClick={() => action('kaijuPower')}>
        <kbd>H</kbd> {strike.name}<strong>{recovery ? `${recovery}s` : target ? 'Ready' : 'Get in range'}</strong>
      </button><small>{bossTarget ? `${strike.damage.toLocaleString()} Aegis Titan damage · ${strike.reach} m` : `${city.damage} hostile damage · ${city.reach} m · Also hits Aegis Titan`} · {strike.costMs / 1000}s recovery</small></>}
    </div>}
    <button className="cheat-toggle" aria-expanded={open} aria-controls="cheat-body" onClick={() => { clearControls(); setOpen(!open); }}>
      <span>⌨ City cheats</span><small>{[hud.cheats?.fly && 'FLY', hud.cheats?.speed && 'FLASH', hud.cheats?.jump && 'JUMP'].filter(Boolean).join(' · ') || 'Try a code'}</small><b>{open ? '−' : '+'}</b>
    </button>
    {open && <div id="cheat-body" className="cheat-body">
      <div className="cheat-log" ref={log} role="log" aria-live="polite" aria-label="Command history">{messages.map((m, i) => <p key={i}><b>{m.from}</b><span>{m.text}</span></p>)}</div>
      <div className="cheat-suggestions" aria-label="Suggested cheat codes">{CHEAT_CODES.map(c => <button key={c.code} disabled={disabled} title={c.description} onClick={() => send(c.code)}><b>{c.code}</b><span>{c.description}</span></button>)}</div>
      <form onSubmit={e => { e.preventDefault(); send(text); }}>
        <input ref={input} aria-label="Cheat code" placeholder="Type a code or HELP…" maxLength={80} autoComplete="off" spellCheck={false} value={text} disabled={disabled} onFocus={clearControls} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); input.current.blur(); setOpen(false); } }} />
        <button type="submit" disabled={disabled || !text.trim()}>Run</button>
      </form>
    </div>}
    {(hud.cheats?.fly || hud.player.flying) && !hud.driving && !hud.boating && !hud.riding && <div className="cheat-flight"><span>Flight · Space / Ctrl</span><button disabled={disabled || !!hud.down} aria-label="Fly up" {...touchControl('jump')}>↑ Rise</button><button disabled={disabled || !!hud.down} aria-label="Fly down" {...touchControl('descend')}>↓ Descend</button></div>}
  </section>;
}
