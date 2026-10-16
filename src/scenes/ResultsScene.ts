import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import type { Resources } from '../data/buildings';
import { audio } from '../audio/AudioEngine';
import { FACING_DOWN, FACING_UP, FRAMES, SPRITE_SCALE, TEXTURES } from '../game/textures';
import { formatNumber } from '../ui/widgets';

export interface ResultsData {
  won: boolean;
  stageNumber: number;
  stageName: string;
  kills: number;
  soldiers: number;
  timeMs: number;
  reward: Resources | null;
  firstClear: boolean;
  unlockedStage: number | null;
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
    const { won, stageName, kills, soldiers, timeMs, reward, firstClear, unlockedStage } = this.results;

    this.add.tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road).setAlpha(0.4);
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, won ? 0x0f2a1a : 0x2a0f12, 0.55);

    this.add
      .text(cx, 230, stageName, { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: COLORS.textDim, letterSpacing: 4 })
      .setOrigin(0.5);
    this.add
      .text(cx, 320, won ? 'STAGE CLEAR' : 'SQUAD LOST', {
        fontFamily: FONT,
        fontSize: '68px',
        fontStyle: '900',
        color: won ? COLORS.good : COLORS.bad,
        stroke: '#000000',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    if (won) {
      for (const [x, y] of [
        [cx, 450],
        [cx - 44, 484],
        [cx + 44, 484],
      ] as const) {
        this.add.image(x, y, TEXTURES.atlas, FRAMES.soldier).setScale(SPRITE_SCALE.soldier * 1.4).setAngle(FACING_UP);
      }
    } else {
      this.add.image(cx, 470, TEXTURES.atlas, FRAMES.walker).setScale(1.3).setAngle(FACING_DOWN);
    }

    const seconds = Math.round(timeMs / 1000);
    const lines = [`Kills  ${kills}`, `Soldiers left  ${soldiers}`, `Time  ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`];
    this.add
      .text(cx, 620, lines.join('\n'), { fontFamily: FONT, fontSize: '32px', fontStyle: '700', color: COLORS.text, align: 'center', lineSpacing: 12 })
      .setOrigin(0.5);

    if (reward) {
      const g = this.add.graphics();
      g.fillStyle(0x0b0f14, 0.6);
      g.fillRoundedRect(60, 740, GAME_WIDTH - 120, firstClear || unlockedStage ? 150 : 100, 20);
      this.add
        .text(cx, 782, `+${formatNumber(reward.food)} FOOD     +${formatNumber(reward.steel)} STEEL`, {
          fontFamily: FONT,
          fontSize: '30px',
          fontStyle: '900',
          color: COLORS.accent,
        })
        .setOrigin(0.5);
      const notes = [firstClear ? 'First clear bonus' : 'Repeat reward', unlockedStage ? `Stage ${unlockedStage} unlocked` : null].filter(
        (n): n is string => n !== null,
      );
      this.add
        .text(cx, 836, notes.join('   ·   '), { fontFamily: FONT, fontSize: '22px', fontStyle: '700', color: COLORS.good })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, 790, 'No reward. Upgrade the shelter and try again.', {
          fontFamily: FONT,
          fontSize: '22px',
          fontStyle: '700',
          color: COLORS.textDim,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 100 },
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(cx, 980, 'TAP TO CONTINUE', { fontFamily: FONT, fontSize: '38px', fontStyle: '700', color: COLORS.text })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, duration: 300, delay: INPUT_LOCK_MS });
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 650, yoyo: true, repeat: -1, delay: INPUT_LOCK_MS + 300 });

    audio.playMusic('calm');
    this.time.delayedCall(INPUT_LOCK_MS, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
        audio.play('tap');
        this.scene.start(SCENES.shelter);
      });
    });
  }
}
