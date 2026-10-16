#!/usr/bin/env node
// Post-deploy smoke check at an iPhone viewport (393x852, DPR 3, touch).
// Usage: node scripts/smoke-check.mjs <url> [out-dir]
// Checks: page loads, title screen renders, a tap advances to the stage,
// the squad follows a horizontal drag, auto-fire scores kills. Writes
// title.png, stage.png, and results.json into out-dir; exits 1 on any failure.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';

const [url, outDirArg] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/smoke-check.mjs <url> [out-dir]');
  process.exit(2);
}
const outDir = outDirArg ?? 'smoke';
mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const launchOptions = {
  headless: true,
  // SwiftShader gives headless Chromium a WebGL context so Phaser takes the WebGL path.
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH;

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  ...devices['iPhone 15'],
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

try {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  check('page loads with 200', response?.status() === 200, `status ${response?.status()}`);

  const activeScenes = () =>
    page.evaluate(() => window.__lastz?.game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);

  await page.waitForFunction(() => window.__lastz?.game?.scene.isActive('Menu') === true, null, { timeout: 20_000 });
  check('title screen (Menu scene) renders', (await activeScenes()).includes('Menu'));

  const box = await page.locator('canvas').boundingBox();
  check('canvas fills the viewport', Boolean(box && box.width > 300 && box.height > 600), JSON.stringify(box));

  const renderer = await page.evaluate(() => (window.__lastz?.game?.renderer.type === 2 ? 'webgl' : 'canvas'));
  console.log(`renderer: ${renderer}`);
  await page.screenshot({ path: join(outDir, 'title.png') });

  await page.touchscreen.tap(196, 500);
  await page.waitForFunction(() => window.__lastz?.game?.scene.isActive('Stage') === true, null, { timeout: 10_000 });
  check('tap advances to Stage scene', (await activeScenes()).includes('Stage'));

  const squadX = () => page.evaluate(() => window.__lastz.game.scene.getScene('Stage').squad.x);
  const client = await context.newCDPSession(page);
  const touch = (type, x, y) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const drag = async (fromX, toX, steps = 12) => {
    await touch('touchStart', fromX, 700);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', fromX + ((toX - fromX) * i) / steps, 700);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(400);
    const x = await squadX();
    await touch('touchEnd', toX, 700);
    return x;
  };

  const startX = await squadX();
  const rightX = await drag(196, 316);
  check('squad follows drag right', rightX > startX + 60, `x ${startX.toFixed(1)} -> ${rightX.toFixed(1)}`);
  const leftX = await drag(300, 100, 20);
  check('squad follows drag left', leftX < rightX - 60, `x ${rightX.toFixed(1)} -> ${leftX.toFixed(1)}`);

  await page.waitForTimeout(2500);
  const stats = await page.evaluate(() => {
    const s = window.__lastz.game.scene.getScene('Stage');
    return { kills: s.kills, leaked: s.leaked };
  });
  check('auto-fire kills zombies', stats.kills > 0, JSON.stringify(stats));
  await page.screenshot({ path: join(outDir, 'stage.png') });

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (err) {
  check('smoke check ran to completion', false, String(err).split('\n')[0]);
  await page.screenshot({ path: join(outDir, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ url, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
