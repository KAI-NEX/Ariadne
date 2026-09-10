// Isolated browser context; no user data writes or model requests.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ARIADNE_QA_URL || 'http://127.0.0.1:8000';
const out = `.cache/two-line-composer-20260910/${Date.now()}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [1280, 390]) for (const route of ['personal-understanding', 'job-overview']) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], posts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await page.goto(`${base}/${route}.html`);
    await page.locator('.understanding-intro').waitFor({ state: 'visible' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).opacity === '1');
    const input = page.locator('.v1-conversation-form textarea'), handle = page.locator('.v1-composer-resize');
    const geometry = await input.evaluate(element => {
      const style = getComputedStyle(element), back = document.querySelector('.v1-back').getBoundingClientRect();
      const intro = document.querySelector('.understanding-intro-copy').getBoundingClientRect();
      const prompts = document.querySelector('.personal-prompts').getBoundingClientRect();
      return { height: element.getBoundingClientRect().height, rows: (element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight),
        aligned: Math.abs(intro.top - back.bottom) < 1, promptsAfter: prompts.top >= intro.bottom,
        gap: innerHeight - document.querySelector('.v1-composer-dock').getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(geometry.height, 64); assert.equal(geometry.rows, 2);
    assert.equal(geometry.aligned, true); assert.equal(geometry.promptsAfter, true); assert.equal(geometry.overflow, false);
    assert.ok(geometry.gap >= 7 && geometry.gap <= 9);
    await input.fill('第一行文字\nSecond line');
    assert.equal(await input.evaluate(e => e.scrollHeight === e.clientHeight), true, 'two lines fit without scrolling');
    await handle.focus(); await page.keyboard.press('ArrowUp');
    assert.equal(await input.evaluate(e => e.getBoundingClientRect().height), 84);
    await page.keyboard.press('Home'); assert.equal(await input.evaluate(e => e.getBoundingClientRect().height), 64);
    const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 100, { steps: 8 }); await page.mouse.up();
    assert.ok(await input.evaluate(e => e.getBoundingClientRect().height) >= 160, 'pointer drag expands input');
    const large = await handle.boundingBox();
    await page.mouse.move(x, large.y + large.height / 2); await page.mouse.down();
    await page.mouse.move(x, large.y + 350, { steps: 8 }); await page.mouse.up();
    assert.equal(await input.evaluate(e => e.getBoundingClientRect().height), 64, 'drag clamps to two-line minimum');
    assert.equal(await input.inputValue(), '第一行文字\nSecond line');
    await input.fill('');
    const controls = await page.evaluate(() => {
      const field = document.querySelector('.v1-composer-field').getBoundingClientRect(), text = document.querySelector('textarea').getBoundingClientRect();
      return [...document.querySelectorAll('.v1-attachment-add,.v1-model-trigger,.v1-conversation-form button[type=submit]')].every(e => {
        const r = e.getBoundingClientRect(); return r.top >= text.bottom && r.bottom <= field.bottom && r.left >= field.left && r.right <= field.right;
      });
    });
    assert.equal(controls, true, 'toolbar remains inside field below text');
    await page.screenshot({ path: `${out}/${route}-${width}.png` });
    assert.deepEqual(errors, []); assert.deepEqual(posts, []);
    results.push({ route, width, geometry, pointerAndKeyboardResize: true, controls, errors, posts });
    await context.close();
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(out);
} finally { await browser.close(); }
