import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { GateEffect, GateSide } from '../data/stages';
import { gateCenterX, gateLabel, gateSideForX, isPenalty } from './gateMath';
import { GATE_HEIGHT, TEXTURES } from './textures';

/**
 * One half of a gate row. It scrolls down with the road and applies its effect
 * when the squad crosses it on this side.
 */
export class Gate extends Phaser.Physics.Arcade.Image {
  side: GateSide = 'left';
  effect: GateEffect = { kind: 'troops', amount: 1 };
  triggered = false;
  readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.gate);
    this.label = scene.add
      .text(x, y, '', {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: '800',
        color: COLORS.text,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);
  }

  spawn(side: GateSide, effect: GateEffect, y: number, roadSpeed: number): void {
    this.side = side;
    this.effect = effect;
    this.triggered = false;
    const x = gateCenterX(side, GAME_WIDTH);
    this.enableBody(true, x, y, true, true);
    this.setDepth(2).setAlpha(0.9).setTint(isPenalty(effect) ? COLORS.gateBad : COLORS.gateGood);
    this.setVelocity(0, roadSpeed);
    this.label.setText(gateLabel(effect)).setPosition(x, y).setAlpha(1).setVisible(true);
  }

  /** The bottom edge, where the squad's front row crosses it. */
  get crossingY(): number {
    return this.y + GATE_HEIGHT / 2;
  }

  coversX(x: number): boolean {
    return gateSideForX(x, GAME_WIDTH) === this.side;
  }

  /** Marks the gate as passed; `taken` fades the untaken half more. */
  markCrossed(taken: boolean): void {
    this.triggered = true;
    this.setAlpha(taken ? 0.6 : 0.25);
    this.label.setAlpha(taken ? 0.8 : 0.3);
  }

  despawn(): void {
    this.disableBody(true, true);
    this.label.setVisible(false);
  }

  override update(): void {
    this.label.setPosition(this.x, this.y);
    if (this.y > GAME_HEIGHT + GATE_HEIGHT) this.despawn();
  }
}
