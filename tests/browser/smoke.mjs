import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

// Builds are tested with the real production CSP, on an unused loopback port.
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
let browser;
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [], violations = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) violations.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('data:')) external.push(request.url()); });
  const response = await page.goto(base, { waitUntil: 'networkidle' });
  assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').count(), 1);
  const button = name => page.getByRole('button', { name, exact: true });
  const close = () => button('Close dialog').click();
  const pause = () => button('Controls and pause menu').click();
  // First launch: the character creator comes before the game.
  await page.getByRole('heading', { name: 'Who are you in the city?' }).waitFor();
  assert.equal(await page.locator('.adventure-canvas').count(), 0, 'the game waits for the character');
  assert.equal(await page.locator('.creator-preview canvas').count(), 1, 'live 3D preview');
  await page.getByLabel('Name').fill('<img src=x onerror=1>Ada');
  for (const choice of ['Skin tone: Bronze', 'Hair colour: Auburn', 'Shirt: Green', 'Trousers: Navy', 'Shoes: Red']) await page.getByRole('button', { name: choice }).click();
  await button('Long').click(); await button('Tall').click();
  assert.equal(await button('Long').getAttribute('aria-pressed'), 'true');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/character-creator.png' });
  await button('Start playing ↗').click();
  await page.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
  assert.equal(await page.locator('.adventure-player').innerText(), '<IMG SRC=X ONERROR=1>ADA');
  assert.equal(await page.locator('.adventure-player img').count(), 0, 'the name stays escaped text');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('little-city-character-v1')));
  assert.deepEqual({ ...saved, name: undefined }, { name: undefined, skin: '#9a6644', hair: '#8c3b2b', hairStyle: 'long', shirt: '#4f8a6b', pants: '#1f3a5f', shoes: '#b5523b', build: 'tall' });
  assert.equal(await page.locator('.adventure-canvas canvas').count(), 1);
  const playerMarker = page.locator('.adventure-radar svg > path').last();
  const before = await playerMarker.getAttribute('transform');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(750); await page.keyboard.up('KeyW');
  assert.notEqual(await playerMarker.getAttribute('transform'), before, 'World Tour movement still works');
  await pause(); await button('Blood effects: On').click();
  assert.equal(await button('Blood effects: Off').count(), 1); await close();
  await page.keyboard.press('KeyM');
  await page.getByRole('button', { name: /Japan Tokyo/ }).click();
  await page.waitForFunction(() => document.querySelector('.adventure-location h1')?.textContent.includes('Tokyo'));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => !document.querySelector('.adventure-loading'));
  assert.match(await page.locator('.adventure-location h1').innerText(), /Tokyo/);
  await page.keyboard.press('KeyL'); await page.getByRole('button', { name: 'Accept contract' }).first().click();
  await page.keyboard.press('KeyM'); assert.equal(await page.getByRole('button', { name: /Philippines Manila/ }).isDisabled(), true); await close();
  await page.keyboard.press('KeyL'); await button('Abandon current contract').click();
  await pause(); assert.equal(await button('Blood effects: Off').count(), 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  // Editing mid-game pauses play and reopens the creator with the current look. The original neighborhood is gone.
  assert.equal(await button('Original neighborhood').count(), 0);
  await button('Edit character').click();
  await page.getByRole('heading', { name: 'Update your look' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Shoes: Red' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'test-results/character-edit-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the creator fits a phone');
  await button('Cancel').click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: 'test-results/world-desktop.png' });
  // Shared world: a second tab (no Supabase keys in this build, so the same-browser transport) joins the same city.
  assert.match(await page.locator('.adventure-online').innerText(), /Local · 0 other tabs/);
  const friend = await context.newPage();
  friend.on('pageerror', error => errors.push(error.message));
  await friend.setViewportSize({ width: 1280, height: 800 });
  await friend.goto(base, { waitUntil: 'networkidle' });
  await friend.waitForFunction(() => document.querySelector('.adventure-canvas canvas') && !document.querySelector('.adventure-loading'));
  await page.bringToFront();
  await page.locator('.adventure-online', { hasText: 'Local · 1 other tab' }).waitFor();
  await friend.locator('.adventure-online', { hasText: 'Local · 1 other tab' }).waitFor();
  const ghost = page.locator('.adventure-radar circle.remote-player');
  await ghost.waitFor();
  const start = Number(await ghost.getAttribute('cy'));
  await friend.bringToFront(); await friend.keyboard.down('KeyW'); await friend.waitForTimeout(1500); await friend.keyboard.up('KeyW');
  await page.bringToFront();
  await page.waitForFunction(y => Math.abs(Number(document.querySelector('.adventure-radar circle.remote-player')?.getAttribute('cy')) - y) > 4, start);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/multiplayer-ghost.png' });
  await friend.close();
  await page.locator('.adventure-online', { hasText: 'Local · 0 other tabs' }).waitFor({ timeout: 10000 });
  assert.deepEqual(errors, []); assert.deepEqual(violations, []); assert.deepEqual(external, [], 'no third-party requests');
  console.log('Browser checks passed: production CSP + Rapier, first-launch character creator with live preview, escaped names, saved look, walking, travel/reload, contract restrictions, preferences, editing the character mid-game, a second player joining, moving and leaving, no third-party requests, mobile layouts.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
