import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH, SAFE_TOP, SCENES } from '../config';
import { TEXTURES } from '../game/textures';
import type { StageScene } from './StageScene';

export interface HudState {
  stageName: string;
  progress: number;
  soldiers: number;
  maxSoldiers: number;
  fireRate: number;
  kills: number;
  boss: { hp: number; maxHp: number } | null;
}

const BAR_X = 70;
const BAR_WIDTH = GAME_WIDTH - 2 * BAR_X;
const BAR_Y = SAFE_TOP + 14;
const BAR_HEIGHT = 16;
const BOSS_BAR_Y = BAR_Y + 86;
const BOSS_BAR_HEIGHT = 14;

/** Overlay drawn above the stage: progress bar, headcount, kills, fire rate, boss health. */
export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private soldiersText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private fireRateText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private bossMarker!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    // Translucent band so gates and zombies scrolling in from the top do not fight the text.
    this.add.rectangle(GAME_WIDTH / 2, SAFE_TOP + 40, GAME_WIDTH, 120, 0x0b0f14, 0.4);
    this.bars = this.add.graphics();

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: '800',
      color: COLORS.text,
      stroke: '#000000',
      strokeThickness: 6,
    };

    this.add.text(BAR_X, BAR_Y - 30, '', { ...style, fontSize: '20px', color: COLORS.textDim }).setName('stage');
    this.bossMarker = this.add.image(BAR_X + BAR_WIDTH, BAR_Y + BAR_HEIGHT / 2, TEXTURES.boss).setScale(0.3).setDepth(1);

    this.add.image(40, BAR_Y + 54, TEXTURES.soldier).setScale(0.8);
    this.soldiersText = this.add.text(62, BAR_Y + 54, '', style).setOrigin(0, 0.5);
    this.killsText = this.add.text(GAME_WIDTH - 24, BAR_Y + 54, '', style).setOrigin(1, 0.5);
    this.fireRateText = this.add.text(GAME_WIDTH / 2, BAR_Y + 54, '', { ...style, fontSize: '24px' }).setOrigin(0.5);
    this.bossText = this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y + BOSS_BAR_HEIGHT / 2, 'BOSS', { ...style, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false);
  }

  update(): void {
    const stage = this.scene.get(SCENES.stage) as StageScene | null;
    if (!stage || !stage.scene.isActive() || !stage.squad) return;
    const s = stage.hudState();

    (this.children.getByName('stage') as Phaser.GameObjects.Text | null)?.setText(s.stageName);
    this.soldiersText.setText(`x${s.soldiers}`);
    this.soldiersText.setColor(s.soldiers <= 2 ? COLORS.bad : COLORS.text);
    this.killsText.setText(`KILLS ${s.kills}`);
    if (s.fireRate !== 1) {
      this.fireRateText.setText(`x${s.fireRate} FIRE`).setColor(s.fireRate > 1 ? COLORS.good : COLORS.bad).setVisible(true);
    } else {
      this.fireRateText.setVisible(false);
    }

    const g = this.bars;
    g.clear();
    g.fillStyle(COLORS.hudBar, 1);
    g.fillRoundedRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2);
    const fill = Math.max(BAR_HEIGHT, BAR_WIDTH * s.progress);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(BAR_X, BAR_Y, fill, BAR_HEIGHT, BAR_HEIGHT / 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(BAR_X + fill - BAR_HEIGHT / 2, BAR_Y + BAR_HEIGHT / 2, BAR_HEIGHT / 2 + 3);
    this.bossMarker.setAlpha(s.progress >= 1 ? 1 : 0.5);

    if (s.boss) {
      g.fillStyle(COLORS.hudBar, 1);
      g.fillRoundedRect(BAR_X, BOSS_BAR_Y, BAR_WIDTH, BOSS_BAR_HEIGHT, BOSS_BAR_HEIGHT / 2);
      const bossFill = Math.max(BOSS_BAR_HEIGHT, (BAR_WIDTH * s.boss.hp) / s.boss.maxHp);
      g.fillStyle(COLORS.bossBar, 1);
      g.fillRoundedRect(BAR_X, BOSS_BAR_Y, bossFill, BOSS_BAR_HEIGHT, BOSS_BAR_HEIGHT / 2);
      this.bossText.setVisible(true);
    } else {
      this.bossText.setVisible(false);
    }
  }
}
