import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { TEXTURES } from './textures';

export class Bullet extends Phaser.Physics.Arcade.Image {
  damage = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.bullet);
  }

  fire(x: number, y: number, vx: number, vy: number, damage: number): void {
    this.damage = damage;
    this.enableBody(true, x, y, true, true);
    this.setDepth(3);
    this.setVelocity(vx, vy);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
  }

  despawn(): void {
    this.disableBody(true, true);
  }

  override update(): void {
    if (this.y < -40 || this.x < -40 || this.x > GAME_WIDTH + 40) this.despawn();
  }
}
