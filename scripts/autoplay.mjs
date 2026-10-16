#!/usr/bin/env node
// Plays one stage with a scripted policy at an iPhone viewport and reports the outcome.
// Used for balance runs and demo recordings; not part of CI.
//
// Usage: node scripts/autoplay.mjs <url> [--stage N] [--levels barracks,armory,lab] [--hq N]
//        [--hero sarge|doc|blaze] [--tutorial] [--video dir] [--shots dir] [--timeout s] [--json]
// Levels default to 1. The save in the browser profile is seeded so the stage is unlocked.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('usage: node scripts/autoplay.mjs <url> [--stage N] [--levels b,a,l] [--hq N] [--hero id] [--tutorial] [--video dir] [--shots dir]');
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const stage = Number(opt('stage', '1'));
const [barracks = 1, armory = 1, lab = 1] = opt('levels', '1,1,1').split(',').map(Number);
const hq = Number(opt('hq', String(Math.max(barracks, armory, lab))));
const hero = opt('hero', 'sarge');
const walkTutorial = flag('tutorial');
const videoDir = opt('video', null);
const shotsDir = opt('shots', null);
const timeoutS = Number(opt('timeout', '200'));
const jsonOnly = flag('json');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
if (videoDir) mkdirSync(videoDir, { recursive: true });

const log = (...parts) => {
  if (!jsonOnly) console.log(...parts);
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  ...devices['iPhone 15'],
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: shotsDir ? 3 : 1,
  isMobile: true,
  hasTouch: true,
  ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: 393, height: 852 } } } : {}),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const SCALE = 393 / 540;
const tapDesign = (x, y) => page.touchscreen.tap(x * SCALE, y * SCALE);
const waitForScene = (key, timeout = 20_000) => page.waitForFunction((k) => window.__lastz?.game?.scene.isActive(k) === true, key, { timeout });
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
      const obj = scene ? find(scene.children.list) : null;
      if (!obj) return null;
      const m = obj.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty };
    },
    [sceneKey, name],
  );
  if (!pos) return false;
  await tapDesign(pos.x, pos.y);
  return true;
};

await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
await waitForScene('Menu');
// Seed the save: unlock the stage, set buildings and hero, silence the tutorial unless asked for.
await page.evaluate(
  ({ stage, hq, barracks, armory, lab, hero, walkTutorial }) => {
    window.__lastz.save.update((s) => ({
      ...s,
      highestUnlocked: Math.max(s.highestUnlocked, stage),
      buildings: { ...s.buildings, hq, barracks, armory, lab },
      hero,
      settings: { ...s.settings, tutorialDone: !walkTutorial, installHintDismissed: true },
    }));
    document.getElementById('install-hint')?.remove();
  },
  { stage, hq, barracks, armory, lab, hero, walkTutorial },
);
await tapDesign(270, 600);
await waitForScene('Shelter');
await tapNamed('Shelter', 'toStages');
await waitForScene('StageSelect');
await tapNamed('StageSelect', `stage-${stage}`);
const started = await waitForScene('Stage', 2_000).then(
  () => true,
  () => false,
);
if (!started) {
  await tapNamed('StageSelect', 'play');
  await waitForScene('Stage');
}

// The policy runs inside the page so one evaluate per tick is enough.
await page.evaluate(() => {
  const W = 540;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const gateValue = (effect, soldiers) => {
    if (!effect) return 0;
    if (effect.kind === 'troops') return soldiers >= 18 && effect.amount > 0 ? 1 : effect.amount;
    return effect.multiplier > 1 ? 4 : -4;
  };
  window.__bot = {
    lastSkill: 0,
    reason: 'hold',
    tick() {
      const game = window.__lastz.game;
      const s = game.scene.getScene('Stage');
      if (!s || !s.scene.isActive() || !s.squad) return null;
      const sx = s.squad.x;
      const sy = s.squad.y;
      const soldiers = s.squad.count;
      const now = s.time.now;
      let target = sx;
      let reason = 'hold';
      const active = (group) => group.getChildren().filter((o) => o.active);
      const enemies = active(s.enemies);
      const gates = active(s.gates).filter((g) => !g.triggered && g.y + 32 < sy);
      const barriers = active(s.barriers).filter((b) => b.y + 35 < sy);
      const pickups = active(s.pickups).filter((p) => p.y < sy);
      const globs = active(s.projectiles);
      const boss = s.boss && s.boss.active && s.boss.phase !== 'dead' ? s.boss : null;
      // Rough damage output per second for "can we shoot this barrier down in time".
      const dps = (soldiers * s.loadout.bulletDamage * s.squad.stats.fireRate) / 0.38;

      // Enemies: stand under the closest one so the narrow aim cone can hit it.
      if (enemies.length) {
        const sorted = enemies.slice().sort((a, b) => b.y - a.y);
        const near = sorted.slice(0, 3).filter((e) => e.y > sorted[0].y - 200);
        target = near.reduce((acc, e) => acc + e.x, 0) / near.length;
        reason = 'enemies';
      }
      if (boss && boss.phase === 'fight') {
        target = boss.x + boss.velocityX * 0.25;
        reason = 'boss';
        // Walkers summoned next to the boss come first when close.
        const close = enemies.filter((e) => e.y > sy - 330);
        if (close.length) {
          target = close.sort((a, b) => b.y - a.y)[0].x;
          reason = 'boss-adds';
        }
      }
      // Pickups: worth a detour when near.
      const pickup = pickups.find((p) => p.y > sy - 420);
      if (pickup && (!enemies.length || enemies.every((e) => e.y < sy - 380))) {
        target = pickup.x;
        reason = 'pickup';
      }
      // Gates: pick the better half of the nearest approaching row.
      if (gates.length) {
        const rowY = Math.max(...gates.map((g) => g.y));
        if (rowY > sy - 520) {
          const row = gates.filter((g) => Math.abs(g.y - rowY) < 12);
          const left = row.find((g) => g.side === 'left');
          const right = row.find((g) => g.side === 'right');
          const sideBarrier = (side) =>
            barriers.find((b) => Math.abs(b.y - rowY) < 80 && (b.side === side || b.side === 'full'));
          const secondsToReach = (sy - rowY) / 150;
          const blockPenalty = (side) => {
            const b = sideBarrier(side);
            if (!b) return 0;
            return b.hp > dps * secondsToReach * 0.7 ? -100 : -2;
          };
          const leftValue = gateValue(left?.effect, soldiers) + blockPenalty('left');
          const rightValue = gateValue(right?.effect, soldiers) + blockPenalty('right');
          const side = leftValue >= rightValue ? 'left' : 'right';
          target = side === 'left' ? W * 0.25 : W * 0.75;
          // Wiggle within the half toward the current target so firing stays useful.
          const lo = side === 'left' ? 60 : W / 2 + 40;
          const hi = side === 'left' ? W / 2 - 40 : W - 60;
          target = clamp(reason === 'enemies' || reason === 'boss-adds' ? clamp(target, lo, hi) : target, lo, hi);
          reason = `gate-${side}`;
        }
      }
      // Barriers: steer off a half-width wall we cannot shoot down; stand under a full one.
      for (const b of barriers) {
        if (b.y < sy - 520) continue;
        const secondsToReach = (sy - b.y) / 150;
        const canBreak = b.hp <= dps * secondsToReach * 0.7;
        if (b.side === 'full') {
          if (!canBreak || b.y > sy - 260) {
            target = clamp(target, b.x - 80, b.x + 80);
            reason = 'wall';
          }
        } else if (!canBreak && !reason.startsWith('gate')) {
          const onIt = b.side === 'left' ? target < W / 2 : target >= W / 2;
          if (onIt) {
            target = b.side === 'left' ? W * 0.75 : W * 0.25;
            reason = 'avoid-barrier';
          }
        }
      }
      // Acid: step aside from globs that will cross our line.
      for (const g of globs) {
        const vy = g.body.velocity.y;
        if (vy <= 0) continue;
        const t = (sy - g.y) / vy;
        if (t < 0 || t > 1.1) continue;
        const px = g.x + g.body.velocity.x * t;
        if (Math.abs(px - target) < 90) {
          target = px < W / 2 ? px + 150 : px - 150;
          reason = 'dodge';
        }
      }
      s.touch.targetX = clamp(target, 50, W - 50);
      this.reason = reason;

      // Hero skill when it pays off.
      const skill = s.skillState();
      if (skill.cooldownRemainingMs <= 0 && now - this.lastSkill > 500) {
        const threat = enemies.filter((e) => e.y > sy - 500).length;
        if (threat >= 5 || boss || (soldiers <= 2 && threat > 0)) {
          if (s.useSkill()) this.lastSkill = now;
        }
      }
      return {
        elapsed: s.elapsed,
        kills: s.kills,
        soldiers,
        fireRate: s.squad.stats.fireRate,
        result: s.result,
        boss: boss ? { hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase } : null,
        powerUps: s.powerUps,
        tutorial: s.tutorial.active,
        fps: game.loop.actualFps,
        reason,
      };
    },
  };
});

const shots = [];
const takeShot = async (name) => {
  if (!shotsDir) return;
  const file = join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
};

let minSoldiers = Infinity;
let last = null;
let fpsSum = 0;
let fpsCount = 0;
let bossSeen = false;
let grenadeSeen = false;
let spreadSeen = false;
const started_at = Date.now();
while (Date.now() - started_at < timeoutS * 1000) {
  const stats = await page.evaluate(() => window.__bot.tick()).catch(() => null);
  if (!stats) {
    const scenes = await page.evaluate(() => window.__lastz.game.scene.getScenes(true).map((s) => s.scene.key));
    if (scenes.includes('Results')) break;
    await page.waitForTimeout(100);
    continue;
  }
  last = stats;
  minSoldiers = Math.min(minSoldiers, stats.soldiers);
  if (stats.fps > 1) {
    fpsSum += stats.fps;
    fpsCount++;
  }
  if (stats.tutorial) {
    // Let the card sit for a moment, then continue, so demos show it.
    await page.waitForTimeout(walkTutorial ? 1800 : 100);
    await takeShot(`tutorial-${stats.tutorial}`);
    await tapNamed('Hud', 'tutorialNext');
  }
  if (stats.boss && !bossSeen) {
    bossSeen = true;
    await page.waitForTimeout(2500);
    await takeShot('boss');
  }
  if (stats.powerUps.grenades > 0 && !grenadeSeen) {
    grenadeSeen = true;
    await page.waitForTimeout(900);
    await takeShot('grenade');
  }
  if (stats.powerUps.spreadUntil > 0 && !spreadSeen) {
    spreadSeen = true;
    await page.waitForTimeout(400);
    await takeShot('spread');
  }
  if (stats.result) {
    await page.waitForTimeout(600);
    await takeShot(`end-${stats.result}`);
    break;
  }
  await page.waitForTimeout(60);
}
await waitForScene('Results', 10_000).catch(() => {});
await page.waitForTimeout(800);
await takeShot('results');

const outcome = {
  stage,
  levels: { hq, barracks, armory, lab },
  hero,
  result: last?.result ?? 'timeout',
  timeS: last ? Math.round(last.elapsed * 10) / 10 : null,
  kills: last?.kills ?? 0,
  soldiersLeft: last?.soldiers ?? 0,
  minSoldiers: Number.isFinite(minSoldiers) ? minSoldiers : null,
  avgFps: fpsCount ? Math.round(fpsSum / fpsCount) : null,
  bossReached: bossSeen,
  errors,
  shots,
};
if (videoDir) {
  const video = page.video();
  await context.close();
  outcome.video = video ? await video.path() : null;
}
await browser.close();
console.log(JSON.stringify(outcome));
process.exit(errors.length ? 1 : 0);
