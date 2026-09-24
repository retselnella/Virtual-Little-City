import { GUN_SHOP, SHOP_WEAPONS, WEAPONS, inventory } from '../../models/worldTour/weapons.js';

// The inventory bar: fists and every gun you own, with its number key and rounds left. Click (or press 1–5) to equip.
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

// Stat bars on a 0–1 scale against the best gun in the shop.
const best = key => Math.max(...SHOP_WEAPONS.map(id => key(WEAPONS[id])));
const STATS = [
  ['Damage', w => w.damage], ['Fire rate', w => 1 / w.cooldown], ['Range', w => w.range], ['Magazine', w => w.magazine],
];
export function ShopPanel({ hud, onBuy, onEquip }) {
  const here = hud.city === GUN_SHOP.city;
  return <div className="gun-shop">
    <p>{here ? `Cash: $${hud.cash.toLocaleString()}. Guns you buy are yours for good, in every city. Switch with Q or the number keys; ammunition is free (reload with R, or restock at the City Hub).` : 'The only gun shop is in Miami.'}</p>
    <div className="gun-list">
      {SHOP_WEAPONS.map(id => {
        const w = WEAPONS[id], owned = hud.owned.includes(id), short = w.price - hud.cash;
        return <article key={id} className={owned ? 'owned' : ''} aria-label={w.name}>
          <header><h3>{w.name}</h3><b>{owned ? 'Owned' : `$${w.price.toLocaleString()}`}</b></header>
          <p>{w.blurb}</p>
          <dl>{STATS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><i style={{ width: `${Math.round(value(w) / best(value) * 100)}%` }} /></dd></div>)}</dl>
          {owned
            ? <button onClick={() => onEquip(id)} disabled={hud.weapon === id}>{hud.weapon === id ? 'Equipped' : `Equip (${w.slot})`}</button>
            : <button onClick={() => onBuy(id)} disabled={!here || short > 0}>{short > 0 ? `Need $${short.toLocaleString()} more` : `Buy for $${w.price.toLocaleString()}`}</button>}
        </article>;
      })}
    </div>
  </div>;
}
