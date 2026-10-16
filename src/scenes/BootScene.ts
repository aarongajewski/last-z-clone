import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { TEXTURES, generateTextures } from '../game/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.clear();
      bar.fillStyle(COLORS.hudBar, 1);
      bar.fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2 - 6, 240, 12, 6);
      bar.fillStyle(0xffd166, 1);
      bar.fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2 - 6, Math.max(12, 240 * value), 12, 6);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`asset failed to load: ${file.key}`);
    });
    this.load.setPath(`${import.meta.env.BASE_URL}assets/kenney/`);
    this.load.atlas(TEXTURES.atlas, 'atlas.png', 'atlas.json');
  }

  create(): void {
    generateTextures(this);
    this.scene.start(SCENES.menu);
  }
}
