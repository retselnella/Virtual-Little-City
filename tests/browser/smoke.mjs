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
  // An open dialog shows everything without scrolling.
  const fits = async label => { const d = await page.locator('dialog[open]').evaluate(el => [el.scrollHeight, el.clientHeight]); assert.ok(d[0] <= d[1] + 1, `${label} fits without scrolling (${d})`); };
  // First launch: the character creator comes before the game.
  await page.getByRole('heading', { name: 'Who are you in the city?' }).waitFor();
  assert.equal(await page.locator('.adventure-canvas').count(), 0, 'the game waits for the character');
  assert.equal(await page.locator('.creator-preview canvas').count(), 1, 'live 3D preview');
  await page.getByLabel('Name').fill('<img src=x onerror=1>Ada');
  // Character kinds: a wolf offers fur colours and no hair; back to human for the rest of the run.
  await button('Wolf').click(); await page.locator('legend', { hasText: /^Fur$/ }).waitFor();
  assert.equal(await page.locator('legend', { hasText: 'Hair style' }).count(), 0);
  await button('Robot').click(); await page.locator('legend', { hasText: /^Plating$/ }).waitFor();
  await page.screenshot({ path: 'test-results/character-creator-robot.png' });
  await button('Human').click(); await page.locator('legend', { hasText: /^Skin tone$/ }).waitFor();
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
  assert.deepEqual({ ...saved, name: undefined }, { name: undefined, kind: 'human', skin: '#9a6644', hair: '#8c3b2b', hairStyle: 'long', shirt: '#4f8a6b', pants: '#1f3a5f', shoes: '#b5523b', build: 'tall' });
  assert.equal(await page.locator('.adventure-canvas canvas').count(), 1);
  // The sky chip shows Philippine time and the shared weather.
  assert.match(await page.locator('.adventure-sky').innerText(), /\d{1,2}:\d{2} (AM|PM)[\s\S]*PH TIME/);
  // The inventory: fists and the pistol to start with; number keys switch.
  assert.deepEqual(await page.locator('.weapon-bar button span').allInnerTexts(), ['Fists', 'Pistol']);
  await page.keyboard.press('Digit1'); assert.equal(await page.getByRole('button', { name: /Fists/ }).first().getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Digit2'); assert.match(await page.locator('.weapon-status').innerText(), /PISTOL[\s\S]*48 \/ ∞/);
  const playerMarker = page.locator('.adventure-radar svg > path').last();
  const before = await playerMarker.getAttribute('transform');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(750); await page.keyboard.up('KeyW');
  assert.notEqual(await playerMarker.getAttribute('transform'), before, 'World Tour movement still works');
  await pause(); await button('Blood effects: On').click();
  assert.equal(await button('Blood effects: Off').count(), 1); await close();
  // M opens the one map: the whole world, existing city names, and the island you are on. Travel is by sea only:
  // picking an island points you to your boat at the marina on the east waterfront.
  await page.keyboard.press('KeyM');
  assert.match(await page.locator('.world-atlas svg').getAttribute('aria-label'), /World map\. You are in Miami/);
  assert.match(await page.locator('.world-here').innerText(), /You are on Miami island/);
  for (const name of ['Miami', 'Tokyo', 'Manila', 'London', 'Dubai', 'Rio de Janeiro', 'Cape Town']) assert.equal(await page.locator('.world-atlas text', { hasText: name }).count(), 1, name);
  assert.equal(await page.getByRole('tab').count(), 0, 'a single map, no tabs'); assert.equal(await page.locator('.island-map').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Fly' }).count(), 0, 'no flights');
  assert.match(await page.locator('.world-tip').innerText(), /Teleport[\s\S]*Sail[\s\S]*marina on the east side/);
  assert.equal(await page.getByRole('button', { name: 'Teleport', exact: true }).count(), 6, 'teleport to any other island from anywhere');
  assert.equal(await page.getByRole('button', { name: 'Teleporter', exact: true }).count(), 1, 'GPS to the teleporter');
  await fits('world map, desktop');
  const tokyoCard = page.getByRole('article', { name: 'Japan Tokyo' });
  await tokyoCard.getByRole('button', { name: /^Sail/ }).click();
  await page.locator('.adventure-objective', { hasText: 'SEA VOYAGE' }).waitFor();
  assert.match(await page.locator('.adventure-objective h2').innerText(), /marina/);
  assert.match(await page.locator('.adventure-objective p').innerText(), /east waterfront, \d+ m (east|north-east|south-east)/);
  await page.keyboard.press('KeyL'); await fits('contracts, desktop'); await close();
  await pause(); await fits('pause menu, desktop'); await close();
  // The current island is saved: switch the save to Tokyo and reload.
  await page.evaluate(() => { const save = JSON.parse(localStorage.getItem('little-city-world-v1')); localStorage.setItem('little-city-world-v1', JSON.stringify({ ...save, city: 'tokyo' })); });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => !document.querySelector('.adventure-loading'));
  assert.match(await page.locator('.adventure-location h1').innerText(), /Tokyo/);
  await page.keyboard.press('KeyL'); await page.getByRole('button', { name: /^Accept/ }).first().click();
  await page.keyboard.press('KeyM'); assert.equal(await page.getByRole('article', { name: 'Philippines Manila' }).getByRole('button', { name: /^Sail/ }).isDisabled(), true); await close();
  await page.keyboard.press('KeyL'); await button('Abandon current contract').click();
  // The world boss panel: event status, live ranking and the weekly board.
  await page.keyboard.press('KeyB');
  await page.getByRole('heading', { name: 'Live ranking' }).waitFor(); await page.getByRole('heading', { name: 'This week' }).waitFor();
  assert.match(await page.locator('.boss-status').innerText(), /12:00 Philippine time/); await close();
  await pause(); assert.equal(await button('Blood effects: Off').count(), 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  // On a phone too, the pause menu, map and contracts fit without scrolling.
  await page.setViewportSize({ width: 390, height: 844 }); await fits('pause menu, phone'); await close();
  await page.keyboard.press('KeyM'); await fits('world map, phone'); await page.screenshot({ path: 'test-results/map-phone.png' }); await close();
  await page.keyboard.press('KeyL'); await fits('contracts, phone'); await page.screenshot({ path: 'test-results/contracts-phone.png' }); await close();
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const [key, label] of [['KeyM', 'world map'], ['KeyL', 'contracts']]) { await page.keyboard.press(key); await fits(`${label}, 1280x720`); await page.screenshot({ path: `test-results/${key}-720.png` }); await close(); }
  await pause(); await fits('pause menu, 1280x720'); await page.screenshot({ path: 'test-results/pause-720.png' });
  await page.setViewportSize({ width: 320, height: 844 });
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
  // Two software-rendered WebGL tabs run at a few frames per second here, so the friend keeps walking until the first tab
  // sees the ghost move (polled on a timer: background tabs do not get animation frames).
  await friend.bringToFront(); await friend.keyboard.down('KeyW');
  await page.waitForFunction(y => Math.abs(Number(document.querySelector('.adventure-radar circle.remote-player')?.getAttribute('cy')) - y) > 4, start, { polling: 250, timeout: 90000 });
  await friend.keyboard.up('KeyW'); await page.bringToFront();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/multiplayer-ghost.png' });
  await friend.close();
  await page.locator('.adventure-online', { hasText: 'Local · 0 other tabs' }).waitFor({ timeout: 10000 });
  assert.deepEqual(errors, []); assert.deepEqual(violations, []); assert.deepEqual(external, [], 'no third-party requests');
  console.log('Browser checks passed: production CSP + Rapier, first-launch character creator with live preview, escaped names, saved look, PH-time sky, one world map with your island, sailing from the east marina or the City Hub teleporter, dialogs that fit without scrolling, world boss panel, sailing course, teleport from any island, saved island, walking, travel/reload, contract restrictions, preferences, editing the character mid-game, a second player joining, moving and leaving, no third-party requests, mobile layouts.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
