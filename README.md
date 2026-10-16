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

Drag left or right to steer the squad; it fires on its own. Steer through green gates
(`+N TROOPS`, `x2 FIRE`) and away from red ones (`-N TROOPS`, `x0.5 FIRE`). Barriers
show their HP and must be shot down or they cost soldiers. Zombies that reach the squad
kill soldiers; at zero soldiers the stage is lost. Survive the waves and kill the boss.

## Layout

```
index.html                 iPhone meta tags, no-scroll / no-zoom CSS, rotate overlay
vite.config.ts             base '/last-z-clone/', PWA manifest + service worker
src/main.ts                Phaser.Game config
src/config.ts              design resolution, palette, scene keys
src/data/                  stage timeline, enemy types, squad tuning (balance lives here)
src/scenes/                Boot, Menu, Stage, Hud (overlay), Results
src/game/                  Squad, Enemy, Bullet, Gate, Barrier, Boss, Projectile + pure logic
                           (gateMath, waveSchedule, formation, squadMath are Phaser-free)
src/ui/TouchInput.ts       drag steering + iOS touch guards
scripts/                   icon generator, Playwright smoke check
public/icons/              generated icon set
tests/                     Vitest suites
```

Stage 1 is defined in `src/data/stages.ts` as a list of timed events (waves, gates,
barriers, boss). `validateStage` in `src/game/waveSchedule.ts` checks a stage definition
and the test suite runs it over every shipped stage.
