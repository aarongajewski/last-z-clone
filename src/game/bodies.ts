import type Phaser from 'phaser';

/**
 * Gives a (possibly rotated and scaled) sprite a centred circular body. Arcade
 * bodies are axis-aligned and sized in unscaled texture pixels, so this works from
 * the frame size and the display scale rather than the rotated on-screen box.
 */
export function fitCircleBody(sprite: Phaser.Physics.Arcade.Image, fraction = 0.4): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  const w = sprite.frame.width;
  const h = sprite.frame.height;
  const radius = Math.min(w, h) * fraction;
  body.setCircle(radius, w / 2 - radius, h / 2 - radius);
}
