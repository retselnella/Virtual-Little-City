import { useEffect, useRef, useState } from 'react';
import { CHEAT_CODES } from '../../models/worldTour/cheatCodes.js';

export function CheatConsole({ hud, run, clearControls, touchControl, disabled }) {
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
    {hud.cheats?.fly && !hud.driving && !hud.boating && !hud.riding && <div className="cheat-flight"><span>Flight · Space / Ctrl</span><button disabled={disabled || !!hud.down} aria-label="Fly up" {...touchControl('jump')}>↑ Rise</button><button disabled={disabled || !!hud.down} aria-label="Fly down" {...touchControl('descend')}>↓ Descend</button></div>}
  </section>;
}
