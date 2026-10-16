# Last Z Clone

Browser-based clone of *Last Z: Survival Shooter*, built to be played on an iPhone from
GitHub Pages.

Live URL: https://aarongajewski.github.io/last-z-clone/

Stack: Phaser 3 + TypeScript + Vite + `vite-plugin-pwa`. Fixed 540x1170 portrait design
resolution scaled with `Scale.FIT`; installable to the Home Screen as a standalone PWA.

## Play on the iPhone

1. Open the URL above in Safari.
2. Share > **Add to Home Screen**.
3. Launch it from the Home Screen for fullscreen portrait play.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm test           # Vitest
npm run build      # production build into dist/
npm run icons      # regenerate public/icons from scripts/make-icons.mjs
npm run smoke -- <url> [out-dir]   # Playwright smoke check at an iPhone viewport
```

Pushing to `main` runs `.github/workflows/pages.yml`, which typechecks, tests, builds, and
deploys `dist/` to GitHub Pages, then smoke-tests the live URL at an iPhone viewport and
uploads the screenshots as the `iphone-smoke` artifact.

## How to play

Title -> Shelter -> Stages -> a stage -> Results -> Shelter.

- **Stages**: drag left or right to steer the squad; it fires on its own. Steer through
  green gates (`+N TROOPS`, `x2 FIRE`) and away from red ones (`-N TROOPS`, `x0.5 FIRE`).
  Barriers show their HP and must be shot down or they cost soldiers. Zombies that reach
  the squad kill soldiers; at zero soldiers the stage is lost. Kill the boss to clear the
  stage and unlock the next of 20. First clears pay a bonus; repeats pay less.
- **Heroes**: pick one before a stage. The round button in the HUD fires their skill
  (Sarge: airstrike, Doc: shield, Blaze: rapid fire) with a 30 s cooldown.
- **Shelter**: Farm and Steel Mill produce over time (tap to collect; production keeps
  accruing while the app is closed, up to a cap). HQ caps every other building's level.
  Barracks sets the starting squad, Armory the bullet damage, Lab the fire rate. One
  upgrade builds at a time, on a visible timer. Later stages need these upgrades.
- Progress is saved in `localStorage` (versioned, with a migration hook). Settings in the
  Shelter has a reset.

## Layout

```
index.html                 iPhone meta tags, no-scroll / no-zoom CSS, rotate overlay
vite.config.ts             base '/last-z-clone/', PWA manifest + service worker
src/main.ts                Phaser.Game config
src/pwa.ts                 service worker registration + update-on-next-open handling
src/config.ts              design resolution, palette, scene keys
src/data/                  stages (curve + generator), enemies, squad, buildings, heroes, rewards
src/meta/                  save (versioned JSON + migrations), economy, progress, timers, saveStore
src/scenes/                Boot, Menu, Shelter, StageSelect, Stage, Hud (overlay), Results
src/game/                  Squad, Enemy, Bullet, Gate, Barrier, Boss, Projectile + pure logic
                           (gateMath, waveSchedule, formation, squadMath are Phaser-free)
src/ui/                    TouchInput (drag steering + iOS touch guards), widgets (Button, panels)
scripts/                   icon generator, Playwright smoke check
public/icons/              generated icon set
tests/                     Vitest suites
```

Stage 1 is hand-authored in `src/data/stages.ts` as a list of timed events (waves, gates,
barriers, boss); stages 2-20 come from `makeStage(n)` driven by `curveRow(n)` in the same
file. `validateStage` in `src/game/waveSchedule.ts` checks a stage definition and the test
suite runs it over every shipped stage. All balance numbers live in `src/data/`.
