import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { eventForDay, phDay, bossTimeText } from '../../src/models/worldTour/bossRules.js';
import { cleanCharacter } from '../../src/models/worldTour/characterProfile.js';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
let browser;
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], ev = eventForDay(phDay(Date.now())), next = eventForDay(ev.day, 1);
  mkdirSync('test-results', { recursive: true });
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: touch, hasTouch: touch, timezoneId: 'America/Los_Angeles' });
    page.setDefaultTimeout(45000); page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(ev.startsAt - 7200000));
    await page.addInitScript(({ city, look }) => {
      localStorage.setItem('little-city-character-v1', JSON.stringify(look));
      localStorage.setItem('little-city-world-v1', JSON.stringify({ city }));
    }, { city: ev.city, look: cleanCharacter({ kind: 'human' }) });
    await page.goto(`${base}/?weather=clear${touch ? '&touch=1' : ''}`);
    await page.locator('.boss-banner.scheduled').waitFor();
    assert.match(await page.locator('.boss-banner').innerText(), /Aegis Titan[\s\S]*arrives in 2:00:00/);
    await page.getByRole('button', { name: 'Aegis Titan event and rankings', exact: true }).click();
    await page.locator('.boss-panel').waitFor();
    assert.ok((await page.locator('.boss-panel').innerText()).includes(bossTimeText(ev.startsAt)), 'arrival stays in Philippine time even in a US browser');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.screenshot({ path: `test-results/titan-scheduled-${touch ? 'phone' : 'desktop'}.png` });
    const bounds = await page.locator('.boss-banner').evaluate(el => {
      const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, width: innerWidth, overflow: el.scrollWidth > el.clientWidth };
    });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && !bounds.overflow, JSON.stringify(bounds));
    await page.clock.setFixedTime(new Date(ev.startsAt - 120000));
    await page.locator('.boss-banner.countdown').waitFor();
    assert.match(await page.locator('.boss-banner').innerText(), /arrives in 2:00/);
    await page.clock.setFixedTime(new Date(ev.startsAt + 200000));
    await page.locator('.boss-banner.active').waitFor();
    await page.getByRole('progressbar', { name: 'Boss health', exact: true }).waitFor();
    await page.screenshot({ path: `test-results/titan-active-${touch ? 'phone' : 'desktop'}.png` });
    // Seed a completed local fight to verify the between-fights presentation.
    await page.evaluate(id => {
      const store = JSON.parse(localStorage.getItem('little-city-boss-v1'));
      store.events[id].hp = 0; store.events[id].defeatedAt = Date.now();
      localStorage.setItem('little-city-boss-v1', JSON.stringify(store));
    }, ev.id);
    await page.locator('.boss-banner.defeated .boss-next').waitFor();
    assert.match(await page.locator('.boss-next').innerText(), /Next: .* in \d+:\d\d:\d\d/);
    await page.clock.setFixedTime(new Date(ev.endsAt));
    await page.locator('.boss-banner.scheduled').waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('little-city-boss-v1')));
    assert.equal(saved.events[ev.id].hp, 0, 'completed event is retained');
    await page.getByRole('button', { name: 'Aegis Titan event and rankings', exact: true }).click();
    assert.ok((await page.locator('.boss-panel').innerText()).includes(bossTimeText(next.startsAt)));
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Titan browser checks passed: desktop/phone countdown, Philippine time, activation, defeat and next slot.');
} finally {
  await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
