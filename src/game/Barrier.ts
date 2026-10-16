import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { SQUAD } from '../data/squad';
import type { BarrierSide } from '../data/stages';
import { gateCenterX } from './gateMath';
import { BARRIER_HEIGHT, TEXTURES } from './textures';

const HIT_FLASH_MS = 40;
const HIT_FLASH_GAP_MS = 120;
/** How far below the front row a wall's leading edge may be before it stops colliding. */
const PASS_MARGIN = 10;

/** A wall across part of the road. Shows its remaining HP and must be shot down. */
export class Barrier extends Phaser.Physics.Arcade.Image {
  side: BarrierSide = 'left';
  hp = 0;
  maxHp = 0;
  readonly label: Phaser.GameObjects.Text;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.barrierHalf);
    this.label = scene.add
      .text(x, y, '', {
        fontFamily: FONT,
        fontSize: '40px',
        fontStyle: '900',
        color: COLORS.text,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);
  }

  spawn(side: BarrierSide, hp: number, y: number, roadSpeed: number): void {
    this.side = side;
    this.hp = hp;
    this.maxHp = hp;
    const x = side === 'full' ? GAME_WIDTH / 2 : gateCenterX(side, GAME_WIDTH);
    this.setTexture(side === 'full' ? TEXTURES.barrierFull : TEXTURES.barrierHalf);
    this.enableBody(true, x, y, true, true);
    this.clearTint().setDepth(2).setAlpha(1);
    this.label.setAlpha(1);
    // Pooled walls switch between the half and full textures; the body must follow the frame.
    this.body?.setSize(this.frame.width, this.frame.height, true);
    this.setVelocity(0, roadSpeed);
    this.label.setText(String(hp)).setPosition(x, y).setVisible(true);
  }

  /** Applies damage; returns true when the barrier is destroyed. */
  hit(damage: number, now: number): boolean {
    this.hp -= damage;
    this.label.setText(String(Math.max(0, Math.ceil(this.hp))));
    if (this.hp <= 0) return true;
    if (now >= this.flashUntil + HIT_FLASH_GAP_MS) {
      this.setTintFill(0xffffff);
      this.flashUntil = now + HIT_FLASH_MS;
    }
    return false;
  }

  despawn(): void {
    this.disableBody(true, true);
    this.label.setVisible(false);
  }

  /** True once the wall's leading edge is past the squad's front row; it can no longer hurt anyone. */
  get passed(): boolean {
    return this.y + BARRIER_HEIGHT / 2 > SQUAD.y + PASS_MARGIN;
  }

  override update(time: number): void {
    this.label.setPosition(this.x, this.y);
    if (this.tintFill && time >= this.flashUntil) this.clearTint();
    if (this.passed && this.body?.enable) {
      // Side-stepping into a wall that is already behind the front line should not cost soldiers.
      this.body.enable = false;
      this.setAlpha(0.45);
      this.label.setAlpha(0.45);
    }
    if (this.y > GAME_HEIGHT + BARRIER_HEIGHT) this.despawn();
  }
}
