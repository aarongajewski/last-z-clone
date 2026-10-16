import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from './config';
import { saveStore } from './meta/saveStore';
import { registerServiceWorker } from './pwa';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ShelterScene } from './scenes/ShelterScene';
import { StageScene } from './scenes/StageScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { installTouchGuards } from './ui/TouchInput';

installTouchGuards();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scene: [BootScene, MenuScene, ShelterScene, StageSelectScene, StageScene, HudScene, ResultsScene],
});

// A new build may only take over outside a stage, so a deploy never interrupts a run.
registerServiceWorker(() => !game.scene.isActive(SCENES.stage) && !game.scene.isActive(SCENES.results));

window.__lastz = { game, save: saveStore };
