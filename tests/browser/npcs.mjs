import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { cleanCharacter } from '../../src/models/worldTour/characterProfile.js';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  mkdirSync('test-results', { recursive: true });
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: mobile, hasTouch: mobile });
    page.setDefaultTimeout(45000); page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-30T04:00:00Z'));
    await page.addInitScript(look => localStorage.setItem('little-city-character-v1', JSON.stringify(look)), cleanCharacter({}));
    await page.goto(`${base}/?weather=clear`);
    await page.waitForFunction(() => !document.querySelector('.adventure-loading') && document.querySelector('.adventure-canvas canvas'));
    const prompt = page.getByRole('button', { name: /Talk to Alex/ });
    await prompt.waitFor();
    if (mobile) await prompt.tap(); else await page.keyboard.press('KeyT');
    const bubble = page.getByRole('complementary', { name: 'Resident conversation' });
    await bubble.waitFor();
    const before = await bubble.locator('p').textContent();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Chat again', exact: true }).click();
    await page.waitForFunction(text => document.querySelector('.npc-dialogue p')?.textContent !== text, before);
    for (const size of mobile ? [{ width: 390, height: 844 }, { width: 844, height: 390 }] : [{ width: 1440, height: 960 }]) {
      await page.setViewportSize(size);
      const bounds = await bubble.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= size.width + 1 && bounds.y + bounds.height <= size.height + 1, 'conversation fits screen');
      // Verify buttons are actually reachable, not merely inside the viewport underneath other HUD controls.
      for (const name of ['Chat again', 'Say goodbye']) await page.getByRole('button', { name, exact: true }).click({ trial: true });
      await page.screenshot({ path: `test-results/npcs-${size.width}.png` });
    }
    await page.getByRole('button', { name: 'Say goodbye', exact: true }).click();
    await bubble.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyT'); await bubble.waitFor();
    if (!mobile) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2400); await page.keyboard.up('KeyW');
      await bubble.waitFor({ state: 'hidden' });
    } else await bubble.waitFor({ state: 'hidden', timeout: 30000 });
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('NPC browser checks passed: keyboard and touch conversations, varied lines, accessible controls, portrait/landscape, goodbye, walking away and expiry.');
} finally {
  await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
