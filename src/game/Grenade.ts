import Phaser from 'phaser';
import { TEXTURES } from './textures';

/**
 * A lobbed grenade. Not a physics body: it is tweened from the thrower to the impact
 * point, swelling and shrinking on the way to fake the arc, then calls back to explode.
 */
export class Grenade extends Phaser.GameObjects.Image {
  private shadow: Phaser.GameObjects.Image;
  private flying = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.grenade);
    this.shadow = scene.add.image(x, y, TEXTURES.smoke).setTint(0x000000).setAlpha(0).setDepth(2);
    this.setDepth(6).setVisible(false);
  }

  get inFlight(): boolean {
    return this.flying;
  }

  throwTo(fromX: number, fromY: number, toX: number, toY: number, flightMs: number, onLand: (x: number, y: number) => void): void {
    this.flying = true;
    this.setPosition(fromX, fromY).setScale(1).setVisible(true).setActive(true);
    this.shadow.setPosition(fromX, fromY + 8).setScale(0.8).setAlpha(0.35);
    this.scene.tweens.add({
      targets: this,
      x: toX,
      y: toY,
      angle: 540,
      duration: flightMs,
      ease: 'Linear',
      onUpdate: (tween) => {
        const t = tween.progress;
        // Peak at the midpoint of the arc.
        const height = 1 + Math.sin(t * Math.PI) * 1.2;
        this.setScale(height);
        this.shadow.setPosition(this.x, this.y + 8 + height * 6).setScale(0.8 - height * 0.15);
      },
      onComplete: () => {
        this.flying = false;
        this.setVisible(false).setActive(false);
        this.shadow.setAlpha(0);
        onLand(toX, toY);
      },
    });
  }
}
