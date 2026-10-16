import Phaser from 'phaser';
import { applyAudioSettings, audio } from './audio/AudioEngine';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from './config';
import { updateSettings } from './meta/save';
import { saveStore } from './meta/saveStore';
import { registerServiceWorker } from './pwa';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ShelterScene } from './scenes/ShelterScene';
import { StageScene } from './scenes/StageScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { currentInstallHintEnv, shouldShowInstallHint, showInstallHint } from './ui/installHint';
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
  // Phaser's own sound system is unused: audio is synthesised in src/audio.
  audio: { noAudio: true },
  scene: [BootScene, MenuScene, ShelterScene, StageSelectScene, StageScene, HudScene, ResultsScene],
});

// iOS only lets a page start audio inside a user gesture; the first touch anywhere unlocks it.
applyAudioSettings(saveStore.get().settings);
const unlockAudio = () => audio.unlock();
for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
  document.addEventListener(type, unlockAudio, { passive: true });
}

// A new build may only take over outside a stage, so a deploy never interrupts a run.
registerServiceWorker(() => !game.scene.isActive(SCENES.stage) && !game.scene.isActive(SCENES.results));

if (shouldShowInstallHint(currentInstallHintEnv(saveStore.get().settings.installHintDismissed))) {
  window.setTimeout(() => {
    const banner = showInstallHint(() => {
      window.clearInterval(watch);
      saveStore.update((s) => updateSettings(s, { installHintDismissed: true }));
    });
    // Only the title screen has room for it; it comes back on the next launch until dismissed.
    const watch = window.setInterval(() => {
      banner.hidden = !game.scene.isActive(SCENES.menu);
    }, 400);
  }, 2000);
}

window.__lastz = { game, save: saveStore, audio };
