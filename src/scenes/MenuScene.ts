import Phaser from 'phaser';
import { audio } from '../audio/AudioEngine';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { FACING_DOWN, FACING_UP, FRAMES, SPRITE_SCALE, TEXTURES } from '../game/textures';
import { saveStore } from '../meta/saveStore';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road).setAlpha(0.5);

    this.add
      .text(cx, 360, 'LAST Z', {
        fontFamily: FONT,
        fontSize: '120px',
        fontStyle: '900',
        color: COLORS.accent,
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 450, 'SURVIVAL SHOOTER (CLONE)', {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: '700',
        color: COLORS.text,
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    // A small squad facing a few zombies shuffling in from above.
    for (const [x, y] of [
      [cx, 690],
      [cx - 44, 724],
      [cx + 44, 724],
    ] as const) {
      this.add.image(x, y, TEXTURES.atlas, FRAMES.soldier).setScale(SPRITE_SCALE.soldier * 1.4).setAngle(FACING_UP);
    }
    for (const [x, y, frame, scale] of [
      [cx - 150, 560, FRAMES.walker, 1],
      [cx + 160, 540, FRAMES.runner, 0.85],
      [cx + 20, 510, FRAMES.brute, 0.8],
    ] as const) {
      const zombie = this.add.image(x, y, TEXTURES.atlas, frame).setScale(scale).setAngle(FACING_DOWN).setAlpha(0.95);
      this.tweens.add({ targets: zombie, y: y + 14, angle: FACING_DOWN + 5, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const save = saveStore.get();
    const cleared = Object.values(save.stages).filter((r) => r.clears > 0).length;
    this.add
      .text(cx, 820, cleared > 0 ? `Stage ${save.highestUnlocked} unlocked  ·  ${cleared} cleared` : 'A new shelter awaits', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: '700',
        color: '#8b949e',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 900, 'TAP TO START', {
        fontFamily: FONT,
        fontSize: '40px',
        fontStyle: '700',
        color: COLORS.text,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });

    this.add
      .text(cx, GAME_HEIGHT - 90, 'Drag to steer. Your squad fires on its own.\nGreen gates help, red gates hurt. Shoot the walls.', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#8b949e',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      // The first tap is the gesture iOS needs before any sound can play.
      audio.unlock();
      audio.play('tap');
      this.scene.start(SCENES.shelter);
    });
  }
}
