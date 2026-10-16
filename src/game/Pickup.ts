import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT } from '../config';
import { POWERUPS, type PowerUpId } from '../data/powerups';
import { PICKUP_SIZE, TEXTURES } from './textures';

/** A power-up badge scrolling down the road. The squad collects it by touching it. */
export class Pickup extends Phaser.Physics.Arcade.Image {
  id: PowerUpId = 'spread';
  readonly label: Phaser.GameObjects.Text;
  private phase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.pickupSpread);
    this.label = scene.add
      .text(x, y + PICKUP_SIZE / 2 + 4, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: '900',
        color: COLORS.text,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(3)
      .setVisible(false);
  }

  spawn(id: PowerUpId, x: number, y: number, speed: number): void {
    this.id = id;
    this.phase = Math.random() * Math.PI * 2;
    this.setTexture(id === 'spread' ? TEXTURES.pickupSpread : TEXTURES.pickupGrenade);
    this.enableBody(true, x, y, true, true);
    this.setDepth(3).setScale(1);
    this.body?.setCircle(PICKUP_SIZE / 2 - 6, 6, 6);
    this.setVelocity(0, speed);
    this.label.setText(POWERUPS[id].label).setColor(POWERUPS[id].textColor).setPosition(x, y + PICKUP_SIZE / 2 + 4).setVisible(true);
  }

  despawn(): void {
    this.disableBody(true, true);
    this.label.setVisible(false);
  }

  override update(time: number): void {
    const pulse = 1 + Math.sin(this.phase + time / 160) * 0.06;
    this.setScale(pulse);
    this.label.setPosition(this.x, this.y + PICKUP_SIZE / 2 + 4);
    if (this.y > GAME_HEIGHT + PICKUP_SIZE) this.despawn();
  }
}
