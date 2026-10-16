#!/usr/bin/env node
// Post-deploy smoke check at an iPhone viewport (393x852, DPR 3, touch).
// Usage: node scripts/smoke-check.mjs <url> [out-dir]
// Walks Title -> Shelter (settings toggle) -> Stage Select -> Stage, then checks the stage plays:
// the tutorial cards open and close, the squad follows a horizontal drag, auto-fire scores kills,
// gates scroll in. Writes title.png, shelter.png, stage-select.png, stage.png,
// and results.json into out-dir; exits 1 on any failure.
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

const DESIGN_WIDTH = 540;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const launchOptions = {
  headless: true,
  // SwiftShader gives headless Chromium a WebGL context so Phaser takes the WebGL path.
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
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

const activeScenes = () => page.evaluate(() => window.__lastz?.game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);
const waitForScene = (key, timeout = 15_000) =>
  page.waitForFunction((k) => window.__lastz?.game?.scene.isActive(k) === true, key, { timeout });

try {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  check('page loads with 200', response?.status() === 200, `status ${response?.status()}`);

  await waitForScene('Menu', 20_000);
  check('title screen (Menu scene) renders', (await activeScenes()).includes('Menu'));

  const box = await page.locator('canvas').boundingBox();
  check('canvas fills the viewport', Boolean(box && box.width > 300 && box.height > 600), JSON.stringify(box));
  const scale = box.width / DESIGN_WIDTH;
  const tapDesign = (x, y) => page.touchscreen.tap(x * scale, y * scale);
  // Taps a named game object (searching inside containers) at its world position.
  const tapNamed = async (sceneKey, name) => {
    const pos = await page.evaluate(
      ([k, n]) => {
        const scene = window.__lastz.game.scene.getScene(k);
        const find = (list) => {
          for (const obj of list) {
            if (obj.name === n) return obj;
            if (obj.list) {
              const inner = find(obj.list);
              if (inner) return inner;
            }
          }
          return null;
        };
        const obj = find(scene.children.list);
        if (!obj) return null;
        const m = obj.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      [sceneKey, name],
    );
    if (!pos) throw new Error(`no game object named ${name} in ${sceneKey}`);
    await tapDesign(pos.x, pos.y);
  };

  const renderer = await page.evaluate(() => (window.__lastz?.game?.renderer.type === 2 ? 'webgl' : 'canvas'));
  console.log(`renderer: ${renderer}`);
  check('Kenney sprite atlas loaded', await page.evaluate(() => window.__lastz.game.textures.exists('kenney')));
  await page.screenshot({ path: join(outDir, 'title.png') });

  // Title -> Shelter
  await tapDesign(270, 600);
  await waitForScene('Shelter');
  check('tap on the title opens the Shelter', (await activeScenes()).includes('Shelter'));
  await page.waitForTimeout(300);
  // AudioContext.resume() is asynchronous; give it a moment on slow runners.
  await page.waitForFunction(() => window.__lastz.audio.unlocked, null, { timeout: 5_000 }).catch(() => {});
  const audioState = await page.evaluate(() => ({ unlocked: window.__lastz.audio.unlocked, settings: window.__lastz.save.get().settings }));
  check('first tap unlocked Web Audio', audioState.unlocked, JSON.stringify(audioState));
  const shelter = await page.evaluate(() => {
    const save = window.__lastz.save.get();
    return { food: save.resources.food, steel: save.resources.steel, hq: save.buildings.hq, build: save.build };
  });
  check('shelter shows a fresh save', shelter.hq >= 1 && shelter.food >= 0 && shelter.steel >= 0, JSON.stringify(shelter));
  await page.screenshot({ path: join(outDir, 'shelter.png') });

  // Settings: the sound toggle persists into the save.
  await tapNamed('Shelter', 'settings');
  await page.waitForTimeout(200);
  await tapNamed('Shelter', 'toggleSfx');
  await page.waitForTimeout(150);
  const sfxOff = await page.evaluate(() => window.__lastz.save.get().settings.sfx);
  await tapNamed('Shelter', 'toggleSfx');
  await page.waitForTimeout(150);
  const sfxOn = await page.evaluate(() => window.__lastz.save.get().settings.sfx);
  check('settings sound toggle persists in the save', sfxOff === false && sfxOn === true, `off=${sfxOff} on=${sfxOn}`);
  await page.screenshot({ path: join(outDir, 'settings.png') });
  await tapNamed('Shelter', 'closeSettings');
  await page.waitForTimeout(150);

  // Shelter -> Stage Select
  await tapNamed('Shelter', 'toStages');
  await waitForScene('StageSelect');
  check('TO STAGES opens Stage Select', (await activeScenes()).includes('StageSelect'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'stage-select.png') });

  // Stage Select -> Stage 1. Tapping the already-selected cell starts it; otherwise PLAY does.
  await tapNamed('StageSelect', 'stage-1');
  const startedFromCell = await waitForScene('Stage', 2_000).then(
    () => true,
    (err) => {
      console.log(`cell tap did not start the stage: ${String(err).split('\n')[0]}`);
      return false;
    },
  );
  if (!startedFromCell) {
    await tapNamed('StageSelect', 'play');
    await waitForScene('Stage');
  }
  check('PLAY starts the Stage scene', (await activeScenes()).includes('Stage'));
  check('HUD overlay is running', (await activeScenes()).includes('Hud'));
  const stageNumber = await page.evaluate(() => window.__lastz.game.scene.getScene('Stage').stage.number);
  check('stage 1 is playing', stageNumber === 1, `stage ${stageNumber}`);

  // A fresh save gets the tutorial: the first card pauses the stage until it is dismissed.
  const hasCard = () => page.evaluate(() => Boolean(window.__lastz.game.scene.getScene('Hud')?.children.getByName('tutorial')));
  const tutorialState = () =>
    page.evaluate(() => {
      const s = window.__lastz.game.scene.getScene('Stage');
      return { active: s.tutorial.active, enabled: s.tutorial.enabled, done: window.__lastz.save.get().settings.tutorialDone };
    });
  // Cards animate in over ~200 ms; tap once they have settled and retry if the tap was swallowed.
  const tapCardButton = async (name, until) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.waitForTimeout(250);
      await tapNamed('Hud', name).catch((err) => console.log(`tap ${name}: ${String(err).split('\n')[0]}`));
      await page.waitForTimeout(250);
      if (until(await tutorialState())) return true;
    }
    return false;
  };
  await page.waitForFunction(() => window.__lastz.game.scene.getScene('Stage').tutorial.active !== null, null, { timeout: 10_000 }).catch(() => {});
  const firstCard = (await tutorialState()).active;
  check('tutorial card opens on stage 1', firstCard === 'steer' && (await hasCard()), `card ${firstCard}`);
  await page.screenshot({ path: join(outDir, 'tutorial.png') });
  const closed = await tapCardButton('tutorialNext', (t) => t.active === null);
  check('GOT IT closes the card and resumes', closed && !(await hasCard()));

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

  const readStage = () =>
    page.evaluate(() => {
      const s = window.__lastz.game.scene.getScene('Stage');
      const hud = s.hudState();
      return {
        kills: s.kills,
        leaked: s.leaked,
        soldiers: s.squad.stats.soldiers,
        fireRate: s.squad.stats.fireRate,
        progress: hud.progress,
        gatesOnScreen: s.gates.getChildren().filter((g) => g.active).length,
        elapsed: s.elapsed,
        hero: s.hero.id,
        skillCooldownMs: hud.skill.cooldownRemainingMs,
        powerUps: s.powerUps ?? null,
      };
    });

  await page.waitForFunction(() => window.__lastz.game.scene.getScene('Stage').kills > 0, null, { timeout: 15_000 }).catch(() => {});
  let stats = await readStage();
  check('auto-fire kills zombies', stats.kills > 0, JSON.stringify(stats));
  check('squad starts with the Barracks headcount', stats.soldiers >= 3, `soldiers ${stats.soldiers}`);
  check('stage progress bar is advancing', stats.progress > 0 && stats.progress < 1, `progress ${stats.progress.toFixed(3)}`);

  // Hero skill button fires once and goes on cooldown.
  await tapNamed('Hud', 'skill');
  await page.waitForTimeout(200);
  stats = await readStage();
  check('hero skill button fires and starts its cooldown', stats.skillCooldownMs > 0, `${stats.hero} cooldown ${Math.round(stats.skillCooldownMs)} ms`);

  // The gates card opens when the first row scrolls into view; SKIP ALL ends the tutorial and remembers it.
  await page
    .waitForFunction(() => window.__lastz.game.scene.getScene('Stage').tutorial.active === 'gates', null, { timeout: 12_000 })
    .catch(() => {});
  const gatesCard = (await tutorialState()).active;
  check('gates tutorial card opens when gates appear', gatesCard === 'gates', `card ${gatesCard}`);
  const skipped = await tapCardButton('tutorialSkip', (t) => !t.enabled && t.done);
  check('SKIP ALL disables the tutorial and saves it as done', skipped, JSON.stringify(await tutorialState()));

  // Stage 1 spawns its first gate row at 4 s; wait for it so the screenshot shows gates.
  await page
    .waitForFunction(
      () => window.__lastz.game.scene.getScene('Stage').gates.getChildren().some((g) => g.active && g.y > 150),
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  stats = await readStage();
  check('gates scroll in from the top', stats.gatesOnScreen > 0, `gates ${stats.gatesOnScreen} at ${stats.elapsed.toFixed(1)}s`);
  check('power-up state is tracked', stats.powerUps !== null && typeof stats.powerUps.grenades === 'number', JSON.stringify(stats.powerUps));
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
