import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { TEXTURES } from '../game/textures';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road).setAlpha(0.5);

    this.add
      .text(cx, 360, 'LAST Z', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '120px',
        fontStyle: '900',
        color: COLORS.accent,
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 450, 'SURVIVAL SHOOTER (CLONE)', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: '700',
        color: COLORS.text,
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    this.add.image(cx, 700, TEXTURES.squad).setScale(1.6);
    for (const [x, y] of [
      [cx - 140, 560],
      [cx + 150, 540],
      [cx + 30, 500],
    ] as const) {
      this.add.image(x, y, TEXTURES.zombie).setAlpha(0.9);
    }

    const prompt = this.add
      .text(cx, 900, 'TAP TO START', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: '700',
        color: COLORS.text,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });

    this.add
      .text(cx, GAME_HEIGHT - 90, 'Drag to steer. Your squad fires on its own.\nGreen gates help, red gates hurt. Shoot the walls.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#8b949e',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      this.scene.start(SCENES.stage);
    });
  }
}
