import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TEXTURES } from './textures';

/** Boss acid glob: flies in a straight line toward where the squad was. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.acid);
  }

  launch(x: number, y: number, targetX: number, targetY: number, speed: number, damage: number): void {
    this.damage = damage;
    this.enableBody(true, x, y, true, true);
    this.setDepth(4);
    const angle = Math.atan2(targetY - y, targetX - x);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setAngularVelocity(240);
  }

  despawn(): void {
    this.disableBody(true, true);
  }

  override update(): void {
    if (this.y > GAME_HEIGHT + 40 || this.x < -40 || this.x > GAME_WIDTH + 40) this.despawn();
  }
}
