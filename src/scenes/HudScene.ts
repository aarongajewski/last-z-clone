import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SAFE_TOP, SCENES } from '../config';
import type { HeroDef } from '../data/heroes';
import { POWERUPS } from '../data/powerups';
import { FACING_DOWN, FACING_UP, FRAMES, TEXTURES } from '../game/textures';
import { TUTORIAL_STEPS, TUTORIAL_TEXT, type TutorialStep } from '../game/tutorial';
import { Button, drawPanel } from '../ui/widgets';
import { SKILL_BUTTON, type StageScene } from './StageScene';

export interface SkillState {
  hero: HeroDef;
  cooldownRemainingMs: number;
  activeRemainingMs: number;
}

export interface PowerUpHud {
  spreadMs: number;
  spreadTotalMs: number;
  grenades: number;
}

export interface HudState {
  stageName: string;
  progress: number;
  soldiers: number;
  maxSoldiers: number;
  fireRate: number;
  kills: number;
  boss: { hp: number; maxHp: number } | null;
  skill: SkillState;
  powerUps: PowerUpHud;
}

const BAR_X = 70;
const BAR_WIDTH = GAME_WIDTH - 2 * BAR_X;
const BAR_Y = SAFE_TOP + 14;
const BAR_HEIGHT = 16;
const BOSS_BAR_Y = BAR_Y + 86;
const BOSS_BAR_HEIGHT = 14;
/** Power-up chips sit bottom-left, clear of the skill button. */
const CHIP_X = 24;
const CHIP_Y = GAME_HEIGHT - 150;
const CHIP_W = 200;
const CHIP_H = 44;

const SKILL_LABEL: Record<HeroDef['skill'], string> = { airstrike: 'STRIKE', shield: 'SHIELD', rapidFire: 'RAPID' };

/** Overlay drawn above the stage: progress bar, headcount, kills, fire rate, boss health, hero skill button, power-ups, tutorial cards. */
export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private soldiersText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private fireRateText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private bossMarker!: Phaser.GameObjects.Image;
  private skillGfx!: Phaser.GameObjects.Graphics;
  private skillIcon!: Phaser.GameObjects.Image;
  private skillText!: Phaser.GameObjects.Text;
  private skillTimer!: Phaser.GameObjects.Text;
  private chipGfx!: Phaser.GameObjects.Graphics;
  private spreadChip!: Phaser.GameObjects.Container;
  private spreadText!: Phaser.GameObjects.Text;
  private grenadeChip!: Phaser.GameObjects.Container;
  private grenadeText!: Phaser.GameObjects.Text;
  private tutorialCard: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    this.tutorialCard = null;
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
    this.bossMarker = this.add
      .image(BAR_X + BAR_WIDTH, BAR_Y + BAR_HEIGHT / 2, TEXTURES.atlas, FRAMES.boss)
      .setScale(0.22)
      .setAngle(FACING_DOWN)
      .setDepth(1);

    this.add.image(40, BAR_Y + 54, TEXTURES.atlas, FRAMES.soldier).setScale(0.32).setAngle(FACING_UP);
    this.soldiersText = this.add.text(62, BAR_Y + 54, '', style).setOrigin(0, 0.5);
    this.killsText = this.add.text(GAME_WIDTH - 24, BAR_Y + 54, '', style).setOrigin(1, 0.5);
    this.fireRateText = this.add.text(GAME_WIDTH / 2, BAR_Y + 54, '', { ...style, fontSize: '24px' }).setOrigin(0.5);
    this.bossText = this.add
      .text(GAME_WIDTH / 2, BOSS_BAR_Y + BOSS_BAR_HEIGHT / 2, 'BOSS', { ...style, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false);

    // Hero skill button, bottom-right. The stage ignores drags that start on it.
    this.skillGfx = this.add.graphics().setDepth(2);
    this.skillIcon = this.add.image(SKILL_BUTTON.x, SKILL_BUTTON.y - 8, TEXTURES.heroSarge).setDepth(3).setScale(0.7);
    this.skillText = this.add
      .text(SKILL_BUTTON.x, SKILL_BUTTON.y + 30, '', { ...style, fontSize: '16px' })
      .setOrigin(0.5)
      .setDepth(3);
    this.skillTimer = this.add
      .text(SKILL_BUTTON.x, SKILL_BUTTON.y - 8, '', { ...style, fontSize: '34px' })
      .setOrigin(0.5)
      .setDepth(4);
    this.add
      .zone(SKILL_BUTTON.x, SKILL_BUTTON.y, SKILL_BUTTON.radius * 2 + 24, SKILL_BUTTON.radius * 2 + 24)
      .setInteractive()
      .setName('skill')
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        const stage = this.scene.get(SCENES.stage) as StageScene | null;
        if (stage?.useSkill()) this.cameras.main.flash(120, 255, 255, 255, false);
      });

    // Power-up chips: icon, label, and a timer bar or ammo count.
    this.chipGfx = this.add.graphics().setDepth(2);
    const chipStyle = { ...style, fontSize: '20px' };
    this.spreadChip = this.add.container(CHIP_X, CHIP_Y).setDepth(3).setVisible(false).setName('powerup-spread');
    this.spreadText = this.add.text(52, CHIP_H / 2, '', { ...chipStyle, color: POWERUPS.spread.textColor }).setOrigin(0, 0.5);
    this.spreadChip.add([this.add.image(26, CHIP_H / 2, TEXTURES.pickupSpread).setScale(0.5), this.spreadText]);
    this.grenadeChip = this.add.container(CHIP_X, CHIP_Y + CHIP_H + 10).setDepth(3).setVisible(false).setName('powerup-grenade');
    this.grenadeText = this.add.text(52, CHIP_H / 2, '', { ...chipStyle, color: POWERUPS.grenade.textColor }).setOrigin(0, 0.5);
    this.grenadeChip.add([this.add.image(26, CHIP_H / 2, TEXTURES.pickupGrenade).setScale(0.5), this.grenadeText]);
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
      this.fireRateText.setText(`x${Number(s.fireRate.toFixed(1))} FIRE`).setColor(s.fireRate > 1 ? COLORS.good : COLORS.bad).setVisible(true);
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

    this.drawSkill(s.skill);
    this.drawPowerUps(s.powerUps);
  }

  // ---- Tutorial cards ------------------------------------------------------------

  showTutorial(step: TutorialStep): void {
    this.hideTutorial();
    const stage = this.scene.get(SCENES.stage) as StageScene;
    const text = TUTORIAL_TEXT[step];
    const index = TUTORIAL_STEPS.indexOf(step) + 1;
    const cx = GAME_WIDTH / 2;
    const top = 320;
    const height = 370;
    const container = this.add.container(0, 0).setDepth(20).setName('tutorial');

    const dim = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setInteractive();
    dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => stage.dismissTutorial());
    const panel = this.add.graphics();
    drawPanel(panel, 40, top, GAME_WIDTH - 80, height, 0x1b232e, 0xffd166, 24);
    const label = { fontFamily: FONT, color: COLORS.text };
    const stepText = this.add
      .text(cx, top + 26, `TUTORIAL ${index}/${TUTORIAL_STEPS.length}`, { ...label, fontSize: '18px', fontStyle: '700', color: COLORS.textDim })
      .setOrigin(0.5, 0);
    const title = this.add.text(cx, top + 58, text.title, { ...label, fontSize: '40px', fontStyle: '900', color: COLORS.accent }).setOrigin(0.5, 0);
    const body = this.add
      .text(cx, top + 118, text.body, { ...label, fontSize: '23px', fontStyle: '600', align: 'center', wordWrap: { width: GAME_WIDTH - 130 }, lineSpacing: 6 })
      .setOrigin(0.5, 0);
    const next = new Button(this, cx + 80, top + height - 52, 'GOT IT', { width: 200, height: 60, fontSize: 24, fill: 0x2ecc71, textColor: '#06240f' }, () =>
      stage.dismissTutorial(),
    ).setName('tutorialNext');
    const skip = new Button(this, cx - 130, top + height - 52, 'SKIP ALL', { width: 180, height: 60, fontSize: 20, fill: 0x2a3340 }, () =>
      stage.skipTutorial(),
    ).setName('tutorialSkip');

    container.add([dim, panel, stepText, title, body, skip, next]);
    container.setAlpha(0).setScale(0.96);
    this.tweens.add({ targets: container, alpha: 1, scale: 1, duration: 180, ease: 'Quad.easeOut' });
    this.tutorialCard = container;
  }

  hideTutorial(): void {
    this.tutorialCard?.destroy(true);
    this.tutorialCard = null;
  }

  // ---- Widgets -------------------------------------------------------------------

  private drawPowerUps(p: PowerUpHud): void {
    const g = this.chipGfx;
    g.clear();
    const spreadOn = p.spreadMs > 0;
    this.spreadChip.setVisible(spreadOn);
    if (spreadOn) {
      const fraction = Math.min(1, p.spreadMs / p.spreadTotalMs);
      drawPanel(g, CHIP_X, CHIP_Y, CHIP_W, CHIP_H, 0x0b0f14, undefined, 22);
      g.fillStyle(POWERUPS.spread.tint, 0.35);
      g.fillRoundedRect(CHIP_X, CHIP_Y, Math.max(CHIP_H, CHIP_W * fraction), CHIP_H, 22);
      g.lineStyle(3, POWERUPS.spread.tint, 0.9);
      g.strokeRoundedRect(CHIP_X, CHIP_Y, CHIP_W, CHIP_H, 22);
      this.spreadText.setText(`SPREAD ${(p.spreadMs / 1000).toFixed(1)}s`);
    }
    const grenadesOn = p.grenades > 0;
    this.grenadeChip.setVisible(grenadesOn);
    if (grenadesOn) {
      const y = CHIP_Y + CHIP_H + 10;
      drawPanel(g, CHIP_X, y, CHIP_W, CHIP_H, 0x0b0f14, undefined, 22);
      g.lineStyle(3, POWERUPS.grenade.tint, 0.9);
      g.strokeRoundedRect(CHIP_X, y, CHIP_W, CHIP_H, 22);
      this.grenadeText.setText(`GRENADES x${p.grenades}`);
    }
  }

  private drawSkill(skill: SkillState): void {
    const { x, y, radius } = SKILL_BUTTON;
    const hero = skill.hero;
    const ready = skill.cooldownRemainingMs <= 0;
    const active = skill.activeRemainingMs > 0;
    const g = this.skillGfx;
    g.clear();
    g.fillStyle(0x0b0f14, 0.7);
    g.fillCircle(x, y, radius + 6);
    g.fillStyle(hero.tint, ready ? 1 : 0.35);
    g.fillCircle(x, y, radius);
    if (!ready) {
      // Cooldown sweep: dark wedge shrinking clockwise from 12 o'clock.
      const fraction = skill.cooldownRemainingMs / hero.cooldownMs;
      g.fillStyle(0x000000, 0.55);
      g.slice(x, y, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * fraction), false);
      g.fillPath();
    }
    if (active) {
      const fraction = skill.activeRemainingMs / Math.max(1, hero.durationMs);
      g.lineStyle(6, 0xffffff, 1);
      g.beginPath();
      g.arc(x, y, radius + 3, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * fraction), false);
      g.strokePath();
    }
    g.lineStyle(4, ready ? 0xffffff : 0x3a4452, 1);
    g.strokeCircle(x, y, radius);

    this.skillIcon.setTexture(heroTexture(hero)).setAlpha(ready ? 1 : 0.4);
    this.skillText.setText(SKILL_LABEL[hero.skill]);
    this.skillTimer.setText(ready ? '' : String(Math.ceil(skill.cooldownRemainingMs / 1000)));
  }
}

function heroTexture(hero: HeroDef): string {
  switch (hero.id) {
    case 'sarge':
      return TEXTURES.heroSarge;
    case 'doc':
      return TEXTURES.heroDoc;
    case 'blaze':
      return TEXTURES.heroBlaze;
  }
}