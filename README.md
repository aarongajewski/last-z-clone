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
npm run icons      # regenerate public/icons and public/splash from scripts/make-icons.mjs
npm run art        # rebuild public/assets/kenney/atlas.* from the Kenney pack (needs network + Chromium)
npm run smoke -- <url> [out-dir]   # Playwright smoke check at an iPhone viewport
npm run bot -- <url> --stage 8 --levels 4,4,3 --hq 5   # autoplay one stage and print the outcome as JSON
```

`npm run bot` drives `scripts/autoplay.mjs`, the policy bot used for the balance pass (it reads
the stage through `window.__lastz` and steers via `StageScene.touch`). `--tutorial` walks the
tutorial cards, `--video dir` records a webm, `--shots dir` saves screenshots at key moments.

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
- **Power-ups** drop every 15 kills and at two fixed points of each stage; steer into them.
  *Spread Shot* fans every bullet into three for 8 s (pickups extend the timer); *Grenades*
  give three grenades that are lobbed automatically at the thickest crowd, wall, or the boss.
  Both show in the HUD bottom-left.
- **Tutorial**: stage 1 shows five short cards (steer, gates, barriers, hero skill, boss) the
  first time; the stage pauses while a card is open. Replay it from Settings.
- **Settings** (in the Shelter): sound effects and music toggles (saved), replay tutorial,
  reset progress.
- **Install**: in iPhone Safari a one-time banner on the title screen points at Share > Add to
  Home Screen; it never shows once the game runs from the Home Screen.
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
src/data/                  stages (curve + generator), enemies, squad, buildings, heroes, rewards,
                           powerups, balance (expected upgrade path + power model)
src/meta/                  save (versioned JSON + migrations + settings), economy, progress, timers, saveStore
src/audio/                 AudioEngine: Web Audio synthesis for every SFX and the music loop
src/scenes/                Boot (atlas preload), Menu, Shelter, StageSelect, Stage, Hud (overlay), Results
src/game/                  Squad, Enemy, Bullet, Gate, Barrier, Boss, Projectile, Pickup, Grenade,
                           StageFx (pooled particles + damage numbers), textures (generated art)
                           + pure logic (gateMath, waveSchedule, formation, squadMath, powerups, tutorial)
src/ui/                    TouchInput (drag steering + iOS touch guards), widgets (Button, panels), installHint
scripts/                   icon + splash generator, Kenney atlas importer, Playwright smoke check, autoplay bot
public/assets/kenney/      sprite atlas built from Kenney's CC0 Topdown Shooter pack (see CREDITS.md)
public/icons/, public/splash/   generated icon set and iOS launch screens
tests/                     Vitest suites
```

Stage 1 is hand-authored in `src/data/stages.ts` as a list of timed events (waves, gates,
barriers, boss); stages 2-20 come from `makeStage(n)` driven by `curveRow(n)` in the same
file. `validateStage` in `src/game/waveSchedule.ts` checks a stage definition and the test
suite runs it over every shipped stage. All balance numbers live in `src/data/`.
