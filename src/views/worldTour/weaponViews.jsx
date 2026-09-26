import { useState } from 'react';
import { GUN_SHOP, SHOP_WEAPONS, WEAPONS, inventory } from '../../models/worldTour/weapons.js';
import { BOSS_NAME, KAIJU_DAMAGE, kaijuDps } from '../../models/worldTour/bossRules.js';

// The inventory bar: fists and every gun you own, with its number key and rounds left. Click (or press 1–9) to equip.
export function WeaponBar({ hud, onEquip }) {
  return <div className="weapon-bar" role="toolbar" aria-label="Weapons">
    {inventory(hud.owned).map(id => {
      const w = WEAPONS[id], selected = hud.weapon === id;
      return <button key={id} aria-pressed={selected} onClick={() => onEquip(id)} title={`${w.name} (${w.slot})`}>
        <kbd>{w.slot}</kbd><span>{w.name}</span>{w.gun && <small>{selected && hud.reload > 0 ? '…' : hud.mags[id]}</small>}
      </button>;
    })}
  </div>;
}

const money = n => `$${n.toLocaleString()}`, short = n => n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}k`;
// Stat bars on a 0–1 scale against the best gun in the shop (and fists, for the kaiju).
const best = key => Math.max(...['fists', ...SHOP_WEAPONS].map(id => key(WEAPONS[id])));
const STATS = [
  [`${BOSS_NAME} damage / s`, w => kaijuDps(w.id), w => short(kaijuDps(w.id))],
  ['Street damage', w => w.damage, w => w.damage],
  ['Fire rate', w => 1 / w.cooldown, w => `${+(1 / w.cooldown).toFixed(1)}/s`],
  ['Range', w => w.range, w => `${w.range} m`],
  ['Magazine', w => w.magazine || 0, w => w.magazine],
];
// The gun counter: every gun with its price and kaiju damage on the left; the one you pick in detail on the right.
export function ShopPanel({ hud, onBuy, onEquip }) {
  const here = hud.city === GUN_SHOP.city, [picked, pick] = useState(() => SHOP_WEAPONS.find(id => !hud.owned.includes(id)) || 'pistol');
  const w = WEAPONS[picked], owned = hud.owned.includes(picked), need = w.price - hud.cash, kaiju = KAIJU_DAMAGE[picked];
  return <div className="gun-shop">
    <p>{here ? <>Cash: <b>{money(hud.cash)}</b>. Guns are yours for good, in every city. Switch with Q or 1–9; ammunition is free (R reloads). Point at the {BOSS_NAME} with the mouse and click, or hold the right button, to fire.</> : 'The only gun shop is in Miami.'}</p>
    <div className="gun-counter">
      <ul className="gun-list" aria-label="Guns for sale">
        {SHOP_WEAPONS.map(id => {
          const g = WEAPONS[id], mine = hud.owned.includes(id);
          return <li key={id}><button aria-pressed={picked === id} className={mine ? 'owned' : ''} onClick={() => pick(id)}>
            <kbd>{g.slot}</kbd><span>{g.name}</span><small>{short(kaijuDps(id))}/s</small><b>{mine ? 'Owned' : g.price ? money(g.price) : 'Free'}</b>
          </button></li>;
        })}
      </ul>
      <article className={`gun-detail${owned ? ' owned' : ''}`} aria-label={w.name}>
        <header><h3>{w.name}</h3><b>{owned ? 'Owned' : money(w.price)}</b></header>
        <p>{w.blurb}</p>
        <div className="kaiju-damage">
          <span>Against the {BOSS_NAME}</span>
          <strong>{kaiju.damage.toLocaleString()}</strong><small>per {w.pellets ? 'blast' : w.blast ? 'rocket' : 'hit'}</small>
          <strong>{short(kaijuDps(picked))}</strong><small>per second, reloads included</small>
          <strong>{w.reach} m</strong><small>reach</small>
        </div>
        <dl>{STATS.map(([label, value, text]) => <div key={label}><dt>{label}</dt><dd><i style={{ width: `${Math.round(value(w) / best(value) * 100)}%` }} /></dd><span>{text(w)}</span></div>)}</dl>
        {owned
          ? <button onClick={() => onEquip(picked)} disabled={hud.weapon === picked}>{hud.weapon === picked ? 'Equipped' : `Equip (${w.slot})`}</button>
          : <button onClick={() => onBuy(picked)} disabled={!here || need > 0}>{need > 0 ? `Need ${money(need)} more` : `Buy for ${money(w.price)}`}</button>}
      </article>
    </div>
  </div>;
}
