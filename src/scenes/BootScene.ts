import Phaser from 'phaser';
import { SCENES } from '../config';
import { generatePlaceholderTextures } from '../game/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    generatePlaceholderTextures(this);
    this.scene.start(SCENES.menu);
  }
}
