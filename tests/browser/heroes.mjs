import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { cleanCharacter } from '../../src/models/worldTour/characterProfile.js';
import { BOSS_HP, KAIJU_POWERS, eventForDay, phDay } from '../../src/models/worldTour/bossRules.js';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
let browser;
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(45000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  mkdirSync('test-results', { recursive: true });
  await page.goto(base);
  const button = name => page.getByRole('button', { name, exact: true });
  for (const kind of ['Hulk', 'Superman', 'Flash', 'Iron Man']) {
    await button(kind).click();
    assert.equal(await button(kind).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: `test-results/hero-${kind.toLowerCase().replaceAll(' ', '-')}.png` });
  }
  await button('Superman').click();
  await page.getByRole('button', { name: /^Start playing/ }).click();
  await page.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
  const flight = button('Superpower: Flight'); await flight.waitFor();
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => document.querySelector('.hero-power button')?.getAttribute('aria-pressed') === 'true');
  await button('Fly up').waitFor();
  await page.keyboard.down('Space'); await page.waitForTimeout(1200); await page.keyboard.up('Space');
  await page.screenshot({ path: 'test-results/hero-flight.png' });
  // Power state must survive pausing, but must not be toggled by keyboard input inside a dialog.
  await button('Controls and pause menu').click(); await page.keyboard.press('KeyG');
  assert.equal(await flight.getAttribute('aria-pressed'), 'true');
  await button('Edit character').click(); await button('Flash').click(); await button('Save look').click();
  await button('Superpower: Speed burst').click();
  await page.waitForFunction(() => document.querySelector('.hero-power button')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await button('Fly up').count(), 0, 'editing clears flight');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.screenshot({ path: 'test-results/hero-speed.png' });
  await page.reload(); await page.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
  assert.equal(await button('Superpower: Speed burst').getAttribute('aria-pressed'), 'false');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('little-city-character-v1')));
  assert.equal(saved.kind, 'flash');
  // A real touch viewport gets the same activation and flight controls, with no keyboard required.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.setDefaultTimeout(45000); mobile.on('pageerror', e => errors.push(e.message));
  await mobile.addInitScript(look => localStorage.setItem('little-city-character-v1', JSON.stringify(look)), cleanCharacter({ kind: 'ironman' }));
  await mobile.goto(`${base}/?touch=1`);
  await mobile.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
  await mobile.getByRole('button', { name: 'Superpower: Flight', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Fly up', exact: true }).waitFor();
  for (const name of ['Superpower: Flight', 'Fly up', 'Fly down']) {
    const bounds = await mobile.getByRole('button', { name, exact: true }).boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845, `${name} fits the touch screen`);
  }
  await mobile.screenshot({ path: 'test-results/hero-touch.png' });
  const panel = await mobile.locator('.cheat-console').boundingBox(), weapons = await mobile.locator('.weapon-bar').boundingBox();
  assert.ok(panel.y + panel.height <= weapons.y, 'power controls do not cover touch weapons');
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.screenshot({ path: 'test-results/hero-touch-landscape.png' });
  const landscape = await mobile.locator('.cheat-console').boundingBox();
  assert.ok(landscape.y >= 0 && landscape.y + landscape.height <= 391, 'power controls fit landscape');
  await page.close(); await mobile.close();
  // End-to-end boss damage through actual controls and the local event service, without injecting session state.
  const fight = await browser.newPage({ viewport: { width: 1440, height: 960 } }), event = eventForDay(phDay(Date.now()));
  fight.setDefaultTimeout(60000); fight.on('pageerror', e => errors.push(e.message));
  await fight.clock.setFixedTime(new Date(event.startsAt + 200000)); // holds the boss on an open avenue
  await fight.addInitScript(({ look, city }) => {
    localStorage.setItem('little-city-character-v1', JSON.stringify(look));
    localStorage.setItem('little-city-world-v1', JSON.stringify({ city }));
  }, { look: cleanCharacter({ kind: 'superman' }), city: event.city });
  await fight.goto(`${base}/?weather=clear`);
  await fight.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
  const strike = fight.getByRole('button', { name: 'Kaiju power: Heat vision', exact: true });
  await strike.waitFor(); assert.equal(await strike.isDisabled(), true, 'spawn is out of range');
  await fight.keyboard.press('KeyG');
  await fight.keyboard.down('Space'); await fight.waitForTimeout(1800); await fight.keyboard.up('Space');
  await fight.keyboard.down('KeyD'); await fight.keyboard.down('ShiftLeft');
  await fight.waitForFunction(() => document.querySelector('.hero-kaiju') && !document.querySelector('.hero-kaiju').disabled);
  await fight.keyboard.up('KeyD'); await fight.keyboard.up('ShiftLeft');
  await fight.keyboard.press('KeyH');
  await fight.waitForFunction(({ id, damage }) => {
    const store = JSON.parse(localStorage.getItem('little-city-boss-v1') || '{}');
    return Object.values(store.events?.[id]?.players || {}).some(p => p.damage >= damage);
  }, { id: event.id, damage: KAIJU_POWERS.superman.damage });
  const hp = await fight.evaluate(id => JSON.parse(localStorage.getItem('little-city-boss-v1')).events[id].hp, event.id);
  assert.equal(hp, BOSS_HP - KAIJU_POWERS.superman.damage, 'one power strike removes the server-balanced HP');
  await fight.screenshot({ path: 'test-results/hero-kaiju-damage.png' });
  await fight.setViewportSize({ width: 390, height: 844 });
  await fight.screenshot({ path: 'test-results/hero-kaiju-phone.png' });
  await fight.close();
  assert.deepEqual(errors, []);
  console.log('Hero browser checks passed: creator, keyboard powers, edit/reset, saved hero, touch flight, and real Kaiju damage.');
} finally {
  await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
