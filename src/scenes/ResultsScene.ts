import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { TEXTURES } from '../game/textures';

export interface ResultsData {
  won: boolean;
  stageName: string;
  kills: number;
  soldiers: number;
  timeMs: number;
}

/** Ignore taps for a moment so the tap that was steering the squad does not skip the screen. */
const INPUT_LOCK_MS = 600;

export class ResultsScene extends Phaser.Scene {
  private results!: ResultsData;

  constructor() {
    super(SCENES.results);
  }

  init(data: ResultsData): void {
    this.results = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const { won, stageName, kills, soldiers, timeMs } = this.results;

    this.add.tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road).setAlpha(0.4);
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, won ? 0x0f2a1a : 0x2a0f12, 0.55);

    this.add
      .text(cx, 270, stageName, { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: COLORS.textDim, letterSpacing: 4 })
      .setOrigin(0.5);
    this.add
      .text(cx, 360, won ? 'STAGE CLEAR' : 'SQUAD LOST', {
        fontFamily: FONT,
        fontSize: '68px',
        fontStyle: '900',
        color: won ? COLORS.good : COLORS.bad,
        stroke: '#000000',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    const icon = this.add.image(cx, 540, won ? TEXTURES.squad : TEXTURES.zombie).setScale(won ? 1.8 : 2.4);
    if (!won) icon.setTint(COLORS.zombie);

    const seconds = Math.round(timeMs / 1000);
    const lines = [`Kills  ${kills}`, `Soldiers left  ${soldiers}`, `Time  ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`];
    this.add
      .text(cx, 720, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: '700',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 14,
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 940, won ? 'TAP TO CONTINUE' : 'TAP TO RETRY', {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: '700',
        color: COLORS.text,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, duration: 300, delay: INPUT_LOCK_MS });
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 650, yoyo: true, repeat: -1, delay: INPUT_LOCK_MS + 300 });

    this.time.delayedCall(INPUT_LOCK_MS, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start(SCENES.menu));
    });
  }
}
